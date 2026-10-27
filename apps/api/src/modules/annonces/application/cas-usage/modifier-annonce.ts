import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../common/errors/domain-error';
import { OutboxService } from '../../../../common/outbox/outbox.service';
import { PrismaService } from '../../../../common/database/prisma.service';
import type { AnnonceAvecPhotos } from '../../domain/entities';
import { MODERATION_TEXTE, REFERENTIEL_REPOSITORY } from '../../domain/ports';
import type { ModerationTextePort, ReferentielRepository } from '../../domain/ports';
import {
  editionSensible,
  statutApresEdition,
  verifierEditionAutorisee,
} from '../../domain/politiques/politique-edition';
import { verifierChampsObligatoires } from '../../domain/politiques/politique-publication';
import { versAnnonceAvecPhotos } from '../../infrastructure/persistance/prisma/mappers';
import { AccesAnnonce } from '../services/acces-annonce';
import { ecrireEvenements, evenement } from '../services/evenements';
import type { EvenementOutbox } from '../../../../common/outbox/outbox.types';
import { ProjectionAnnonce } from '../services/projection-annonce';
import type { ChampsAnnonceBruts } from '../services/valider-champs-annonce';
import { validerChampsAnnonce, verifierCoherencePrix } from '../services/valider-champs-annonce';

export interface ModifierAnnonceCommande extends ChampsAnnonceBruts {
  version: number;
}

@Injectable()
export class ModifierAnnonce {
  constructor(
    @Inject(REFERENTIEL_REPOSITORY) private readonly referentiels: ReferentielRepository,
    @Inject(MODERATION_TEXTE) private readonly moderation: ModerationTextePort,
    private readonly acces: AccesAnnonce,
    private readonly projection: ProjectionAnnonce,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async executer(
    utilisateurId: string,
    id: string,
    commande: ModifierAnnonceCommande,
  ): Promise<AnnonceAvecPhotos> {
    const annonce = await this.acces.proprietaire(id, utilisateurId);
    this.acces.verifierVersion(commande.version, annonce.version);
    verifierEditionAutorisee(annonce);

    const donnees = validerChampsAnnonce(commande);
    await this.verifierReferences(donnees.categorieId, donnees.marqueId);

    verifierCoherencePrix(
      donnees.prixCents !== undefined ? donnees.prixCents : annonce.prixCents,
      donnees.prixOrigineCents !== undefined ? donnees.prixOrigineCents : annonce.prixOrigineCents,
    );

    let statut = statutApresEdition(annonce);
    const evenements: EvenementOutbox[] = [];

    const sensible = editionSensible(annonce, {
      ...(donnees.titre !== undefined ? { titre: donnees.titre } : {}),
      ...(donnees.description !== undefined ? { description: donnees.description } : {}),
      ...(donnees.categorieId !== undefined ? { categorieId: donnees.categorieId } : {}),
    });

    if (sensible && (annonce.statut === 'publiee' || annonce.statut === 'en_revue')) {
      const analyse = await this.moderation.analyser(
        `${donnees.titre ?? annonce.titre ?? ''} ${donnees.description ?? annonce.description ?? ''}`,
      );

      if (analyse.contientContact || analyse.motsInterdits.length > 0) {
        statut = 'en_revue';
        evenements.push(
          evenement('moderation.demande', 'annonce', annonce.id, {
            annonceId: annonce.id,
            raisons: [
              ...(analyse.contientContact ? ['contact'] : []),
              ...analyse.motsInterdits.map((mot) => `mot_interdit:${mot}`),
            ],
            source: 'edition',
          }),
        );
      }
    }

    // Une annonce déjà soumise doit rester complète : sans ce contrôle, retirer
    // `couleur`, `etat`, `prixCents`… violerait la contrainte SQL et produirait
    // un 500 au lieu d'une erreur métier.
    if (statut === 'publiee' || statut === 'en_revue') {
      verifierChampsObligatoires({ ...annonce, ...donnees });
    }

    const miseAJour = await this.prisma.$transaction(async (tx) => {
      const resultat = await tx.annonce.updateMany({
        where: { id, version: commande.version },
        data: {
          ...donnees,
          statut,
          ...(statut === 'brouillon' ? { motifRefus: null } : {}),
          version: { increment: 1 },
        },
      });

      if (resultat.count === 0) return null;

      const ligne = await tx.annonce.findUnique({
        where: { id },
        include: { photos: { orderBy: { ordre: 'asc' } } },
      });

      if (!ligne) return null;

      const actualisee = versAnnonceAvecPhotos(ligne);

      // Une annonce précédemment publiée doit être réindexée même si l’édition
      // la bascule `en_revue` : M3 se fie à la projection complète.
      if (annonce.statut === 'publiee') {
        evenements.push(
          evenement(
            'annonce.mise_a_jour',
            'annonce',
            id,
            await this.projection.construire(actualisee, actualisee.photos),
          ),
        );
      }

      await ecrireEvenements(tx, this.outbox, evenements);

      return actualisee;
    });

    if (!miseAJour) {
      const actuelle = await this.acces.proprietaire(id, utilisateurId);
      throw new DomainError(
        'etat_incompatible',
        'L’annonce a été modifiée entre-temps. Rechargez-la.',
        409,
        { versionActuelle: actuelle.version },
      );
    }

    return miseAJour;
  }

  private async verifierReferences(
    categorieId: string | null | undefined,
    marqueId: string | null | undefined,
  ): Promise<void> {
    if (categorieId !== undefined && categorieId !== null) {
      const categorie = await this.referentiels.trouverCategorie(categorieId);
      if (!categorie || !categorie.actif) {
        throw new DomainError('categorie_invalide', 'La catégorie est introuvable.', 422);
      }
    }

    if (marqueId !== undefined && marqueId !== null) {
      const marque = await this.referentiels.trouverMarque(marqueId);
      if (!marque || !marque.actif) {
        throw new DomainError('marque_invalide', 'La marque est introuvable.', 422);
      }
    }
  }
}
