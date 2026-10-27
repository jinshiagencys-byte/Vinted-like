import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../common/database/prisma.service';
import { DomainError } from '../../../../../common/errors/domain-error';
import type { Photo } from '../../../domain/entities';
import type { StatutModerationPhoto } from '../../../domain/enums';
import type { DonneesPhoto, PhotoRepository, TraitementPhoto } from '../../../domain/ports';
import { versPhoto } from './mappers';

@Injectable()
export class PhotoPrismaRepository implements PhotoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async creer(donnees: DonneesPhoto): Promise<Photo> {
    const row = await this.prisma.photo.create({
      data: {
        annonceId: donnees.annonceId,
        ordre: donnees.ordre,
        mimeType: donnees.mimeType,
        tailleOctets: donnees.tailleOctets,
        largeur: donnees.largeur,
        hauteur: donnees.hauteur,
        statutTraitement: 'en_attente',
      },
    });

    return versPhoto(row);
  }

  async trouverParId(id: string): Promise<Photo | null> {
    const row = await this.prisma.photo.findUnique({ where: { id } });
    return row ? versPhoto(row) : null;
  }

  async listerParAnnonce(annonceId: string): Promise<Photo[]> {
    const rows = await this.prisma.photo.findMany({
      where: { annonceId },
      orderBy: { ordre: 'asc' },
    });

    return rows.map(versPhoto);
  }

  async marquerTeleversee(id: string): Promise<Photo | null> {
    const row = await this.prisma.photo.update({
      where: { id },
      data: { statutTraitement: 'televersee' },
    });

    return versPhoto(row);
  }

  async enregistrerTraitement(id: string, traitement: TraitementPhoto): Promise<Photo | null> {
    const row = await this.prisma.photo.update({
      where: { id },
      data: {
        urlOriginale: traitement.urlOriginale,
        urlVariantes: traitement.urlVariantes,
        largeur: traitement.largeur,
        hauteur: traitement.hauteur,
        perceptHash: traitement.perceptHash,
        tailleOctets: traitement.tailleOctets,
        mimeType: traitement.mimeType,
        statutTraitement: 'traitee',
      },
    });

    return versPhoto(row);
  }

  async marquerRejetee(id: string): Promise<void> {
    await this.prisma.photo.update({
      where: { id },
      data: { statutTraitement: 'rejetee', statutModeration: 'refusee' },
    });
  }

  async mettreAJourModeration(id: string, statut: StatutModerationPhoto): Promise<void> {
    await this.prisma.photo.update({ where: { id }, data: { statutModeration: statut } });
  }

  async supprimer(id: string): Promise<void> {
    await this.prisma.photo.delete({ where: { id } });
  }

  async reordonner(annonceId: string, photoIds: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const [ordre, photoId] of photoIds.entries()) {
        const resultat = await tx.photo.updateMany({
          where: { id: photoId, annonceId },
          data: { ordre },
        });

        if (resultat.count === 0) {
          throw new DomainError(
            'photo_introuvable',
            'Une photo de la liste est introuvable pour cette annonce.',
            404,
          );
        }
      }
    });
  }

  async compter(annonceId: string): Promise<number> {
    return this.prisma.photo.count({ where: { annonceId } });
  }

  async hashPublieAilleurs(hash: string, annonceId: string): Promise<boolean> {
    const row = await this.prisma.photo.findFirst({
      where: {
        perceptHash: hash,
        annonceId: { not: annonceId },
        annonce: { statut: { in: ['publiee', 'reservee', 'vendue'] } },
      },
      select: { id: true },
    });

    return row !== null;
  }

  async hashesDuVendeur(vendeurId: string, exclurePhotoId: string): Promise<string[]> {
    const rows = await this.prisma.photo.findMany({
      where: {
        id: { not: exclurePhotoId },
        perceptHash: { not: null },
        annonce: {
          vendeurId,
          statut: { notIn: ['archivee', 'vendue'] },
        },
      },
      select: { perceptHash: true },
    });

    return rows.flatMap((row) => (row.perceptHash ? [row.perceptHash] : []));
  }

  async photosSansTraitementAvant(date: Date): Promise<Photo[]> {
    const rows = await this.prisma.photo.findMany({
      where: {
        statutTraitement: { in: ['en_attente', 'televersee'] },
        creeLe: { lt: date },
      },
    });

    return rows.map(versPhoto);
  }
}
