import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../common/database/prisma.service';
import type {
  CreerUtilisateur,
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

  async mettreAJour(id: string, donnees: MiseAJourUtilisateur): Promise<Utilisateur> {
    const row = await this.prisma.utilisateur.update({
      where: { id },
      data: {
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
      },
    });

    return versUtilisateur(row);
  }
}
