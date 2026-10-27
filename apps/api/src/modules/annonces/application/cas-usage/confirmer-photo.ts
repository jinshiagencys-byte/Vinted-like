import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { DomainError } from '../../../../common/errors/domain-error';
import { verifierEditionAutorisee } from '../../domain/politiques/politique-edition';
import { PHOTO_REPOSITORY, STOCKAGE_OBJET, TRAITEMENT_IMAGE } from '../../domain/ports';
import type { PhotoRepository, StockageObjetPort, TraitementImagePort } from '../../domain/ports';
import { AccesAnnonce } from '../services/acces-annonce';
import { cleTemporaire } from '../services/cles-photo';
import { PHOTOS_QUEUE, PHOTO_TRAITER_JOB } from '../services/photos.constants';

@Injectable()
export class ConfirmerPhoto {
  constructor(
    @Inject(PHOTO_REPOSITORY) private readonly photos: PhotoRepository,
    @Inject(STOCKAGE_OBJET) private readonly stockage: StockageObjetPort,
    @Inject(TRAITEMENT_IMAGE) private readonly images: TraitementImagePort,
    @InjectQueue(PHOTOS_QUEUE) private readonly queue: Queue,
    private readonly acces: AccesAnnonce,
  ) {}

  async executer(
    utilisateurId: string,
    annonceId: string,
    photoId: string,
  ): Promise<{ statutTraitement: 'en_attente' }> {
    const annonce = await this.acces.proprietaire(annonceId, utilisateurId);
    verifierEditionAutorisee(annonce);

    const photo = await this.photos.trouverParId(photoId);

    if (!photo || photo.annonceId !== annonceId) {
      throw new DomainError('photo_introuvable', 'Photo introuvable.', 404);
    }

    if (photo.statutTraitement === 'traitee' || photo.statutTraitement === 'rejetee') {
      return { statutTraitement: 'en_attente' };
    }

    if (photo.statutTraitement === 'televersee') {
      await this.queue.add(
        PHOTO_TRAITER_JOB,
        { photoId },
        { jobId: `photo-${photoId}`, attempts: 5, backoff: { type: 'exponential', delay: 2_000 } },
      );

      return { statutTraitement: 'en_attente' };
    }

    const mimeType = photo.mimeType ?? 'image/jpeg';
    const cle = cleTemporaire(annonceId, photoId, mimeType);
    const entete = await this.stockage.head(cle);

    if (!entete) {
      throw new DomainError(
        'photo_absente',
        'Le fichier n’a pas été téléversé. Recommencez l’envoi.',
        422,
      );
    }

    if (entete.tailleOctets > (photo.tailleOctets ?? 0)) {
      throw new DomainError('photo_invalide', 'La taille du fichier ne correspond pas.', 422);
    }

    const contenu = await this.stockage.lire(cle);
    await this.images.analyser(contenu, mimeType);
    await this.photos.marquerTeleversee(photoId);

    await this.queue.add(
      PHOTO_TRAITER_JOB,
      { photoId },
      { jobId: `photo-${photoId}`, attempts: 5, backoff: { type: 'exponential', delay: 2_000 } },
    );

    return { statutTraitement: 'en_attente' };
  }
}
