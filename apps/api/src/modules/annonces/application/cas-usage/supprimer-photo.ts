import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { DomainError } from '../../../../common/errors/domain-error';
import { OutboxService } from '../../../../common/outbox/outbox.service';
import type { AnnonceAvecPhotos } from '../../domain/entities';
import { verifierEditionAutorisee } from '../../domain/politiques/politique-edition';
import { PHOTO_REPOSITORY, STOCKAGE_OBJET } from '../../domain/ports';
import type { PhotoRepository, StockageObjetPort } from '../../domain/ports';
import { versAnnonceAvecPhotos } from '../../infrastructure/persistance/prisma/mappers';
import { AccesAnnonce } from '../services/acces-annonce';
import { cleOriginale, cleTemporaire, cleVariante, VARIANTES_PHOTO } from '../services/cles-photo';
import { ecrireEvenements, evenement } from '../services/evenements';
import { ProjectionAnnonce } from '../services/projection-annonce';

@Injectable()
export class SupprimerPhoto {
  constructor(
    @Inject(PHOTO_REPOSITORY) private readonly photos: PhotoRepository,
    @Inject(STOCKAGE_OBJET) private readonly stockage: StockageObjetPort,
    private readonly acces: AccesAnnonce,
    private readonly projection: ProjectionAnnonce,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async executer(
    utilisateurId: string,
    annonceId: string,
    photoId: string,
  ): Promise<AnnonceAvecPhotos> {
    const annonce = await this.acces.proprietaire(annonceId, utilisateurId);
    verifierEditionAutorisee(annonce);

    const photo = await this.photos.trouverParId(photoId);

    if (!photo || photo.annonceId !== annonceId) {
      throw new DomainError('photo_introuvable', 'Photo introuvable.', 404);
    }

    const restantes = (await this.photos.listerParAnnonce(annonceId)).filter(
      (item) => item.id !== photoId,
    );

    if (annonce.statut === 'publiee' || annonce.statut === 'en_revue') {
      if (restantes.length === 0) {
        throw new DomainError(
          'photos_requises',
          'Une annonce en ligne doit conserver au moins une photo.',
          422,
        );
      }
    }

    const actualisee = await this.prisma.$transaction(async (tx) => {
      await tx.photo.delete({ where: { id: photoId } });

      for (const [ordre, restante] of restantes.entries()) {
        await tx.photo.update({ where: { id: restante.id }, data: { ordre } });
      }

      await tx.annonce.update({
        where: { id: annonceId },
        data: { version: { increment: 1 } },
      });

      const ligne = await tx.annonce.findUnique({
        where: { id: annonceId },
        include: { photos: { orderBy: { ordre: 'asc' } } },
      });

      if (!ligne) return null;

      const resultat = versAnnonceAvecPhotos(ligne);

      // La projection est calculée après la suppression et le réordonnancement
      // pour que M3 reçoive la galerie et la version réellement commitées.
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

    await this.supprimerObjets(annonceId, photoId, photo.mimeType);

    if (!actualisee) {
      throw new DomainError('annonce_introuvable', 'Annonce introuvable.', 404);
    }

    return actualisee;
  }

  private async supprimerObjets(
    annonceId: string,
    photoId: string,
    mimeType: string | null,
  ): Promise<void> {
    const cles = [
      cleTemporaire(annonceId, photoId, mimeType ?? 'image/jpeg'),
      cleOriginale(annonceId, photoId, 'webp'),
      ...VARIANTES_PHOTO.map((variante) => cleVariante(annonceId, photoId, variante, 'webp')),
    ];

    for (const cle of cles) {
      try {
        await this.stockage.supprimer(cle);
      } catch {
        // La suppression S3 est compensée par le cycle de vie du bucket.
      }
    }
  }
}
