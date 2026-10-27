import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { DomainError } from '../../../../common/errors/domain-error';
import { OutboxService } from '../../../../common/outbox/outbox.service';
import type { AnnonceAvecPhotos, Photo } from '../../domain/entities';
import { verifierEditionAutorisee } from '../../domain/politiques/politique-edition';
import { PHOTO_REPOSITORY } from '../../domain/ports';
import type { PhotoRepository } from '../../domain/ports';
import { versAnnonceAvecPhotos } from '../../infrastructure/persistance/prisma/mappers';
import { AccesAnnonce } from '../services/acces-annonce';
import { ecrireEvenements, evenement } from '../services/evenements';
import { ProjectionAnnonce } from '../services/projection-annonce';

@Injectable()
export class ReordonnerPhotos {
  constructor(
    @Inject(PHOTO_REPOSITORY) private readonly photos: PhotoRepository,
    private readonly acces: AccesAnnonce,
    private readonly projection: ProjectionAnnonce,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async executer(
    utilisateurId: string,
    annonceId: string,
    photoIds: string[],
  ): Promise<AnnonceAvecPhotos> {
    const annonce = await this.acces.proprietaire(annonceId, utilisateurId);
    verifierEditionAutorisee(annonce);

    const photos = await this.photos.listerParAnnonce(annonceId);
    const ordonnees = this.validerListe(photos, photoIds);

    return this.appliquer(annonce, ordonnees);
  }

  async definirPrincipale(
    utilisateurId: string,
    annonceId: string,
    photoId: string,
  ): Promise<AnnonceAvecPhotos> {
    const annonce = await this.acces.proprietaire(annonceId, utilisateurId);
    verifierEditionAutorisee(annonce);

    const photos = await this.photos.listerParAnnonce(annonceId);
    const principale = photos.find((photo) => photo.id === photoId);

    if (!principale) {
      throw new DomainError('photo_introuvable', 'Photo introuvable.', 404);
    }

    const ordonnees = [principale, ...photos.filter((photo) => photo.id !== photoId)];

    return this.appliquer(annonce, ordonnees);
  }

  private validerListe(photos: Photo[], photoIds: string[]): Photo[] {
    const parId = new Map(photos.map((photo) => [photo.id, photo]));

    if (photoIds.length !== photos.length || new Set(photoIds).size !== photoIds.length) {
      throw new DomainError(
        'ordre_photos_invalide',
        'La liste doit contenir exactement toutes les photos de l’annonce.',
        422,
      );
    }

    return photoIds.map((id) => {
      const photo = parId.get(id);

      if (!photo) {
        throw new DomainError(
          'photo_introuvable',
          'Une photo de la liste est introuvable pour cette annonce.',
          404,
        );
      }

      return photo;
    });
  }

  private async appliquer(
    annonce: AnnonceAvecPhotos,
    ordonnees: Photo[],
  ): Promise<AnnonceAvecPhotos> {
    const actualisee = await this.prisma.$transaction(async (tx) => {
      for (const [ordre, photo] of ordonnees.entries()) {
        await tx.photo.update({ where: { id: photo.id }, data: { ordre } });
      }

      await tx.annonce.update({
        where: { id: annonce.id },
        data: { version: { increment: 1 } },
      });

      const ligne = await tx.annonce.findUnique({
        where: { id: annonce.id },
        include: { photos: { orderBy: { ordre: 'asc' } } },
      });

      if (!ligne) return null;

      const resultat = versAnnonceAvecPhotos(ligne);

      // La projection doit refléter l'ordre et la version après commit, pas
      // l'état chargé avant la transaction.
      if (annonce.statut === 'publiee') {
        await ecrireEvenements(tx, this.outbox, [
          evenement(
            'annonce.mise_a_jour',
            'annonce',
            annonce.id,
            await this.projection.construire(resultat, resultat.photos),
          ),
        ]);
      }

      return resultat;
    });

    if (!actualisee) {
      throw new DomainError('annonce_introuvable', 'Annonce introuvable.', 404);
    }

    return actualisee;
  }
}
