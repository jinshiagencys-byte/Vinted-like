import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import { DomainError } from '../../../../common/errors/domain-error';
import { OutboxService } from '../../../../common/outbox/outbox.service';
import type { AnnonceAvecPhotos } from '../../domain/entities';
import { MODERATION_TEXTE, COMPTES_QUERY, REFERENTIEL_REPOSITORY } from '../../domain/ports';
import type {
  ComptesQueryPort,
  ModerationTextePort,
  ReferentielRepository,
} from '../../domain/ports';
import { estQuasiDoublon } from '../../domain/politiques/politique-doublon';
import {
  deciderPublication,
  verifierPrealablesPublication,
  type IssuePublication,
  type SignauxPublication,
} from '../../domain/politiques/politique-publication';
import { verifierQuotaActif } from '../../domain/politiques/politique-quota';
import { versAnnonceAvecPhotos } from '../../infrastructure/persistance/prisma/mappers';
import { AccesAnnonce } from '../services/acces-annonce';
import { ecrireEvenements, evenement } from '../services/evenements';
import type { EvenementOutbox } from '../../../../common/outbox/outbox.types';
import { ProjectionAnnonce } from '../services/projection-annonce';

export interface PublicationResultat {
  id: string;
  statut: 'publiee' | 'en_revue' | 'refusee';
  version: number;
  motifRefus?: string;
  publieeLe?: string;
}

const STATUTS_PUBLIABLES = ['brouillon', 'archivee', 'refusee'] as const;
const SEUIL_QUASI_DOUBLON = 6;

@Injectable()
export class PublierAnnonce {
  constructor(
    @Inject(COMPTES_QUERY) private readonly comptes: ComptesQueryPort,
    @Inject(REFERENTIEL_REPOSITORY) private readonly referentiels: ReferentielRepository,
    @Inject(MODERATION_TEXTE) private readonly moderation: ModerationTextePort,
    private readonly acces: AccesAnnonce,
    private readonly projection: ProjectionAnnonce,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async executer(
    utilisateurId: string,
    annonceId: string,
    version: number,
  ): Promise<PublicationResultat> {
    const annonce = await this.acces.proprietaire(annonceId, utilisateurId);
    this.acces.verifierVersion(version, annonce.version);

    const vendeur = await this.comptes.profilVendeur(utilisateurId);

    if (!vendeur) {
      throw new DomainError('annonce_introuvable', 'Annonce introuvable.', 404);
    }

    if (vendeur.statut !== 'actif') {
      throw new DomainError(
        'compte_non_actif',
        'Votre compte ne permet pas de publier une annonce.',
        403,
      );
    }

    if (!vendeur.emailVerifie) {
      throw new DomainError('email_non_verifie', 'Vérifiez votre e-mail avant de publier.', 403);
    }

    verifierPrealablesPublication(annonce, annonce.photos);
    const issue = await this.decider(annonce, vendeur.emailVerifie);

    return this.appliquer(annonce, version, issue);
  }

  private async decider(
    annonce: AnnonceAvecPhotos,
    _emailVerifie: boolean,
  ): Promise<IssuePublication> {
    const categorie = annonce.categorieId
      ? await this.referentiels.trouverCategorie(annonce.categorieId)
      : null;
    const enfants = categorie ? await this.referentiels.compterEnfantsActifs(categorie.id) : 0;
    const tailleRequise = categorie?.tailleObligatoire ?? true;
    const tailleDansGrille =
      !tailleRequise ||
      (annonce.taille !== null &&
        categorie !== null &&
        (await this.referentiels.tailleExiste(categorie.id, annonce.taille)));

    const texte = await this.moderation.analyser(
      `${annonce.titre ?? ''} ${annonce.description ?? ''}`,
    );

    let doublonExact = false;
    let quasiDoublon = false;

    for (const photo of annonce.photos) {
      if (!photo.perceptHash) continue;

      if (await this.photosHashPublieAilleurs(photo.perceptHash, annonce.id)) {
        doublonExact = true;
      }

      const hashes = await this.photosHashesVendeur(annonce.vendeurId, photo.id);
      if (estQuasiDoublon(photo.perceptHash, hashes, SEUIL_QUASI_DOUBLON)) {
        quasiDoublon = true;
      }
    }

    const signaux: SignauxPublication = {
      contientContact: texte.contientContact,
      motsInterdits: texte.motsInterdits,
      doublonExact,
      quasiDoublon,
      categorieValide: categorie !== null && categorie.actif && enfants === 0,
      tailleRequise,
      tailleDansGrille,
    };

    return deciderPublication(signaux);
  }

  private async appliquer(
    annonce: AnnonceAvecPhotos,
    version: number,
    issue: IssuePublication,
  ): Promise<PublicationResultat> {
    const resultat = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${annonce.vendeurId}))`,
      );

      const actives = await tx.annonce.count({
        where: {
          vendeurId: annonce.vendeurId,
          statut: { in: ['en_revue', 'publiee', 'reservee'] },
        },
      });

      verifierQuotaActif(actives);

      const publieeLe = issue.statut === 'publiee' ? new Date() : null;
      const motifRefus = issue.statut === 'refusee' ? issue.motif : null;
      const maj = await tx.annonce.updateMany({
        where: {
          id: annonce.id,
          version,
          statut: { in: [...STATUTS_PUBLIABLES] },
        },
        data: {
          statut: issue.statut,
          ...(publieeLe ? { publieeLe } : {}),
          motifRefus,
          archiveeLe: null,
          version: { increment: 1 },
        },
      });

      if (maj.count === 0) return null;

      const ligne = await tx.annonce.findUnique({
        where: { id: annonce.id },
        include: { photos: { orderBy: { ordre: 'asc' } } },
      });

      if (!ligne) return null;

      const actualisee = versAnnonceAvecPhotos(ligne);
      const evenements: EvenementOutbox[] = [];

      if (issue.statut === 'publiee') {
        evenements.push(
          evenement(
            'annonce.publiee',
            'annonce',
            annonce.id,
            await this.projection.construire(actualisee, actualisee.photos),
          ),
        );
      } else if (issue.statut === 'en_revue') {
        evenements.push(
          evenement('moderation.demande', 'annonce', annonce.id, {
            annonceId: annonce.id,
            raisons: issue.raisons,
            photosSignalees: actualisee.photos
              .filter((photo) => photo.statutModeration === 'a_verifier')
              .map((photo) => photo.id),
          }),
        );
      } else {
        evenements.push(
          evenement('annonce.refusee', 'annonce', annonce.id, {
            annonceId: annonce.id,
            motif: issue.motif,
            refuseeLe: new Date().toISOString(),
          }),
        );
      }

      await ecrireEvenements(tx, this.outbox, evenements);

      return actualisee;
    });

    if (!resultat) {
      const actuelle = await this.acces.trouver(annonce.id);
      throw new DomainError(
        'etat_incompatible',
        'L’annonce a été modifiée entre-temps. Rechargez-la.',
        409,
        { versionActuelle: actuelle.version },
      );
    }

    return {
      id: resultat.id,
      statut: resultat.statut as PublicationResultat['statut'],
      version: resultat.version,
      ...(resultat.motifRefus ? { motifRefus: resultat.motifRefus } : {}),
      ...(resultat.publieeLe ? { publieeLe: resultat.publieeLe.toISOString() } : {}),
    };
  }

  private async photosHashPublieAilleurs(hash: string, annonceId: string): Promise<boolean> {
    const photo = await this.prisma.photo.findFirst({
      where: {
        perceptHash: hash,
        annonceId: { not: annonceId },
        annonce: { statut: { in: ['publiee', 'reservee', 'vendue'] } },
      },
      select: { id: true },
    });

    return photo !== null;
  }

  private async photosHashesVendeur(vendeurId: string, exclurePhotoId: string): Promise<string[]> {
    const rows = await this.prisma.photo.findMany({
      where: {
        id: { not: exclurePhotoId },
        perceptHash: { not: null },
        annonce: { vendeurId, statut: { notIn: ['archivee', 'vendue'] } },
      },
      select: { perceptHash: true },
    });

    return rows.flatMap((row) => (row.perceptHash ? [row.perceptHash] : []));
  }
}
