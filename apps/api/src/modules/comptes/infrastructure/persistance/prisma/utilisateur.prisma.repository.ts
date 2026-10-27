import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../common/database/prisma.service';
import { DomainError } from '../../../../../common/errors/domain-error';
import type {
  CreerUtilisateur,
  DonneesAnonymisation,
  MiseAJourUtilisateur,
  UtilisateurRepository,
} from '../../../domain/ports';
import type { Utilisateur } from '../../../domain/entities';
import { versUtilisateur } from './mappers';

@Injectable()
export class UtilisateurPrismaRepository implements UtilisateurRepository {
  constructor(private readonly prisma: PrismaService) {}

  async creer(donnees: CreerUtilisateur): Promise<Utilisateur> {
    const row = await this.prisma.utilisateur.create({
      data: {
        email: donnees.email,
        telephone: donnees.telephone ?? null,
        motDePasseHash: donnees.motDePasseHash,
        pseudo: donnees.pseudo,
        pseudoNormalise: donnees.pseudoNormalise,
        nomComplet: donnees.nomComplet ?? null,
        dateNaissance: donnees.dateNaissance,
        pays: donnees.pays ?? 'FR',
        role: donnees.role ?? 'membre',
      },
    });

    return versUtilisateur(row);
  }

  async trouverParId(id: string): Promise<Utilisateur | null> {
    const row = await this.prisma.utilisateur.findUnique({ where: { id } });
    return row ? versUtilisateur(row) : null;
  }

  async trouverParEmail(email: string): Promise<Utilisateur | null> {
    const row = await this.prisma.utilisateur.findUnique({ where: { email } });
    return row ? versUtilisateur(row) : null;
  }

  async trouverParPseudoNormalise(pseudoNormalise: string): Promise<Utilisateur | null> {
    const row = await this.prisma.utilisateur.findUnique({
      where: { pseudoNormalise },
    });
    return row ? versUtilisateur(row) : null;
  }

  async trouverParTelephone(telephone: string): Promise<Utilisateur | null> {
    const row = await this.prisma.utilisateur.findUnique({ where: { telephone } });
    return row ? versUtilisateur(row) : null;
  }

  async mettreAJour(id: string, donnees: MiseAJourUtilisateur): Promise<Utilisateur> {
    const row = await this.prisma.utilisateur.update({
      where: { id },
      data: this.donneesPrisma(donnees),
    });

    return versUtilisateur(row);
  }

  async mettreAJourVersionne(
    id: string,
    versionAttendue: number,
    donnees: MiseAJourUtilisateur,
  ): Promise<Utilisateur> {
    const resultat = await this.prisma.utilisateur.updateMany({
      where: { id, version: versionAttendue, statut: { in: ['actif', 'restreint'] } },
      data: { ...this.donneesPrisma(donnees), version: { increment: 1 } },
    });

    if (resultat.count === 0) {
      const actuel = await this.prisma.utilisateur.findUnique({ where: { id } });
      throw new DomainError(
        'etat_incompatible',
        'Le profil a été modifié entre-temps. Rechargez vos données.',
        409,
        { versionActuelle: actuel?.version ?? versionAttendue },
      );
    }

    const row = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id } });
    return versUtilisateur(row);
  }

  async anonymiser(id: string, donnees: DonneesAnonymisation): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.utilisateur.update({
        where: { id },
        data: {
          email: donnees.email,
          telephone: null,
          motDePasseHash: null,
          nomComplet: null,
          dateNaissance: null,
          pseudo: donnees.pseudo,
          pseudoNormalise: donnees.pseudoNormalise,
          statut: 'supprime',
          supprimeLe: donnees.supprimeLe,
          telephoneVerifieLe: null,
          versionSecurite: donnees.versionSecurite,
          version: { increment: 1 },
        },
      });

      await tx.profil.updateMany({
        where: { utilisateurId: id },
        data: {
          avatarUrl: null,
          bio: null,
          tailleCm: null,
          pointure: null,
          stylesPreferes: [],
        },
      });

      await tx.adresse.updateMany({
        where: { utilisateurId: id, supprimeeLe: null },
        data: { supprimeeLe: donnees.supprimeLe, estDefaut: false },
      });

      await tx.appareil.updateMany({
        where: { utilisateurId: id, revoqueLe: null },
        data: { revoqueLe: donnees.supprimeLe },
      });

      await tx.verification.updateMany({
        where: { utilisateurId: id, statut: 'en_attente' },
        data: { statut: 'expire', codeHash: null, expireLe: donnees.supprimeLe },
      });

      await tx.reinitialisationMotDePasse.updateMany({
        where: { utilisateurId: id, utiliseLe: null },
        data: { utiliseLe: donnees.supprimeLe },
      });
    });
  }

  async mettreAJourReputation(
    id: string,
    reputation: { noteMoyenne: number; nbVentes: number; nbAchats: number; version: number },
  ): Promise<boolean> {
    const resultat = await this.prisma.utilisateur.updateMany({
      where: { id, reputationVersion: { lt: reputation.version } },
      data: {
        noteMoyenne: reputation.noteMoyenne,
        nbVentes: reputation.nbVentes,
        nbAchats: reputation.nbAchats,
        reputationVersion: reputation.version,
      },
    });

    return resultat.count === 1;
  }

  async incrementerCompteurs(
    id: string,
    champs: { ventes?: number; achats?: number },
  ): Promise<void> {
    await this.prisma.utilisateur.update({
      where: { id },
      data: {
        ...(champs.ventes ? { nbVentes: { increment: champs.ventes } } : {}),
        ...(champs.achats ? { nbAchats: { increment: champs.achats } } : {}),
      },
    });
  }

  private donneesPrisma(donnees: MiseAJourUtilisateur): Record<string, unknown> {
    return {
      ...(donnees.telephone !== undefined ? { telephone: donnees.telephone } : {}),
      ...(donnees.motDePasseHash !== undefined ? { motDePasseHash: donnees.motDePasseHash } : {}),
      ...(donnees.nomComplet !== undefined ? { nomComplet: donnees.nomComplet } : {}),
      ...(donnees.dateNaissance !== undefined ? { dateNaissance: donnees.dateNaissance } : {}),
      ...(donnees.emailVerifieLe !== undefined ? { emailVerifieLe: donnees.emailVerifieLe } : {}),
      ...(donnees.telephoneVerifieLe !== undefined
        ? { telephoneVerifieLe: donnees.telephoneVerifieLe }
        : {}),
      ...(donnees.statut !== undefined ? { statut: donnees.statut } : {}),
      ...(donnees.versionSecurite !== undefined
        ? { versionSecurite: donnees.versionSecurite }
        : {}),
      ...(donnees.derniereConnexionLe !== undefined
        ? { derniereConnexionLe: donnees.derniereConnexionLe }
        : {}),
      ...(donnees.pseudo !== undefined ? { pseudo: donnees.pseudo } : {}),
      ...(donnees.pseudoNormalise !== undefined
        ? { pseudoNormalise: donnees.pseudoNormalise }
        : {}),
      ...(donnees.version !== undefined ? { version: donnees.version } : {}),
    };
  }
}
