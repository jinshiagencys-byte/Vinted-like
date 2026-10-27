import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../common/database/prisma.service';
import { decoderCurseur, encoderCurseur } from '../../../domain/curseur';
import type { AnnonceAvecPhotos } from '../../../domain/entities';
import type { FavoriRepository, PageAnnonces } from '../../../domain/ports';
import { versAnnonceAvecPhotos } from './mappers';

@Injectable()
export class FavoriPrismaRepository implements FavoriRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ajouter(utilisateurId: string, annonceId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const creation = await tx.favori.createMany({
        data: [{ utilisateurId, annonceId }],
        skipDuplicates: true,
      });

      if (creation.count === 0) return false;

      await tx.annonce.update({
        where: { id: annonceId },
        data: { nbFavoris: { increment: 1 } },
      });

      return true;
    });
  }

  async retirer(utilisateurId: string, annonceId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const suppression = await tx.favori.deleteMany({ where: { utilisateurId, annonceId } });

      if (suppression.count === 0) return false;

      await tx.annonce.updateMany({
        where: { id: annonceId, nbFavoris: { gt: 0 } },
        data: { nbFavoris: { decrement: 1 } },
      });

      return true;
    });
  }

  async existe(utilisateurId: string, annonceId: string): Promise<boolean> {
    return (await this.prisma.favori.count({ where: { utilisateurId, annonceId } })) > 0;
  }

  async lister(
    utilisateurId: string,
    curseur: string | undefined,
    limite: number,
  ): Promise<PageAnnonces<AnnonceAvecPhotos>> {
    const position = decoderCurseur(curseur);
    const rows = await this.prisma.favori.findMany({
      where: {
        utilisateurId,
        ...(position
          ? {
              OR: [
                { creeLe: { lt: position.majLe } },
                { creeLe: position.majLe, id: { lt: position.id } },
              ],
            }
          : {}),
      },
      include: {
        annonce: {
          include: { photos: { orderBy: { ordre: 'asc' } } },
        },
      },
      orderBy: [{ creeLe: 'desc' }, { id: 'desc' }],
      take: limite + 1,
    });

    const page = rows.slice(0, limite);
    const items = page.map((row) => versAnnonceAvecPhotos(row.annonce));
    const dernier = page.at(-1);

    return {
      items,
      curseurSuivant:
        rows.length > limite && dernier ? encoderCurseur(dernier.creeLe, dernier.id) : null,
    };
  }

  async compter(annonceId: string): Promise<number> {
    return this.prisma.favori.count({ where: { annonceId } });
  }
}
