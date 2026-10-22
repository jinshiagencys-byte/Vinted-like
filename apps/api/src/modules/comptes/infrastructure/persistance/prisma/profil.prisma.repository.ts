import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../common/database/prisma.service';
import type { CreerProfil, MiseAJourProfil, ProfilRepository } from '../../../domain/ports';
import type { Profil } from '../../../domain/entities';
import { versProfil } from './mappers';

@Injectable()
export class ProfilPrismaRepository implements ProfilRepository {
  constructor(private readonly prisma: PrismaService) {}

  async creer(donnees: CreerProfil): Promise<Profil> {
    const row = await this.prisma.profil.create({
      data: {
        utilisateurId: donnees.utilisateurId,
        avatarUrl: donnees.avatarUrl ?? null,
        bio: donnees.bio ?? null,
        tailleCm: donnees.tailleCm ?? null,
        pointure: donnees.pointure ?? null,
        stylesPreferes: donnees.stylesPreferes ?? [],
        visibilite: donnees.visibilite ?? 'public',
        langue: donnees.langue ?? 'fr',
      },
    });

    return versProfil(row);
  }

  async trouverParUtilisateurId(utilisateurId: string): Promise<Profil | null> {
    const row = await this.prisma.profil.findUnique({ where: { utilisateurId } });
    return row ? versProfil(row) : null;
  }

  async mettreAJour(utilisateurId: string, donnees: MiseAJourProfil): Promise<Profil> {
    const row = await this.prisma.profil.update({
      where: { utilisateurId },
      data: {
        ...(donnees.avatarUrl !== undefined ? { avatarUrl: donnees.avatarUrl } : {}),
        ...(donnees.bio !== undefined ? { bio: donnees.bio } : {}),
        ...(donnees.tailleCm !== undefined ? { tailleCm: donnees.tailleCm } : {}),
        ...(donnees.pointure !== undefined ? { pointure: donnees.pointure } : {}),
        ...(donnees.stylesPreferes !== undefined ? { stylesPreferes: donnees.stylesPreferes } : {}),
        ...(donnees.visibilite !== undefined ? { visibilite: donnees.visibilite } : {}),
        ...(donnees.langue !== undefined ? { langue: donnees.langue } : {}),
      },
    });

    return versProfil(row);
  }
}
