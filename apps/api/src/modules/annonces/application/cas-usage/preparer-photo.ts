import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '../../../../common/errors/domain-error';
import { PHOTO_REPOSITORY, STOCKAGE_OBJET } from '../../domain/ports';
import type { PhotoRepository, StockageObjetPort } from '../../domain/ports';
import { MAX_PHOTOS } from '../../domain/politiques/politique-publication';
import { verifierEditionAutorisee } from '../../domain/politiques/politique-edition';
import {
  DIMENSION_MIN,
  RATIO_MAX,
  RATIO_MIN,
  TAILLE_MAX_OCTETS,
} from '../../infrastructure/medias/traitement-image-sharp.adapter';
import { AccesAnnonce } from '../services/acces-annonce';
import { cleTemporaire, MIME_TYPES_PHOTO } from '../services/cles-photo';

export interface PreparerPhotoCommande {
  nomFichier: string;
  mimeType: string;
  tailleOctets: number;
  largeur: number;
  hauteur: number;
}

export interface PhotoPreparee {
  photoId: string;
  urlTeleversement: string;
  expireLe: string;
  method: 'PUT';
  headers: Record<string, string>;
}

@Injectable()
export class PreparerPhoto {
  constructor(
    @Inject(PHOTO_REPOSITORY) private readonly photos: PhotoRepository,
    @Inject(STOCKAGE_OBJET) private readonly stockage: StockageObjetPort,
    private readonly acces: AccesAnnonce,
    private readonly config: ConfigService,
  ) {}

  async executer(
    utilisateurId: string,
    annonceId: string,
    commande: PreparerPhotoCommande,
  ): Promise<PhotoPreparee> {
    const annonce = await this.acces.proprietaire(annonceId, utilisateurId);
    verifierEditionAutorisee(annonce);
    this.validerCommande(commande);

    if ((await this.photos.compter(annonceId)) >= MAX_PHOTOS) {
      throw new DomainError(
        'photos_trop_nombreuses',
        `Une annonce ne peut pas contenir plus de ${MAX_PHOTOS} photos.`,
        422,
      );
    }

    const ordre = await this.photos.compter(annonceId);
    const photo = await this.photos.creer({
      annonceId,
      ordre,
      mimeType: commande.mimeType,
      tailleOctets: commande.tailleOctets,
      largeur: commande.largeur,
      hauteur: commande.hauteur,
    });

    const cle = cleTemporaire(annonceId, photo.id, commande.mimeType);
    const expireSecondes = this.config.get<number>('S3_PRESIGN_SECONDS', 900);
    const url = await this.stockage.urlTeleversement(
      cle,
      commande.mimeType,
      commande.tailleOctets,
      expireSecondes,
    );

    return {
      photoId: photo.id,
      urlTeleversement: url.url,
      expireLe: url.expireLe.toISOString(),
      method: 'PUT',
      headers: url.headers,
    };
  }

  private validerCommande(commande: PreparerPhotoCommande): void {
    if (!MIME_TYPES_PHOTO.includes(commande.mimeType)) {
      throw new DomainError(
        'photo_invalide',
        'Seuls les formats JPEG, PNG et WebP sont acceptés.',
        422,
      );
    }

    if (
      !Number.isInteger(commande.tailleOctets) ||
      commande.tailleOctets < 1 ||
      commande.tailleOctets > TAILLE_MAX_OCTETS
    ) {
      throw new DomainError(
        'photo_invalide',
        `La photo doit peser au maximum ${TAILLE_MAX_OCTETS / (1024 * 1024)} Mo.`,
        422,
      );
    }

    if (
      !Number.isInteger(commande.largeur) ||
      !Number.isInteger(commande.hauteur) ||
      commande.largeur < DIMENSION_MIN ||
      commande.hauteur < DIMENSION_MIN
    ) {
      throw new DomainError(
        'photo_invalide',
        `La photo doit mesurer au moins ${DIMENSION_MIN} × ${DIMENSION_MIN} pixels.`,
        422,
      );
    }

    const ratio = commande.largeur / commande.hauteur;

    if (ratio < RATIO_MIN || ratio > RATIO_MAX) {
      throw new DomainError(
        'photo_invalide',
        'Le rapport largeur/hauteur de la photo doit être compris entre 1:3 et 3:1.',
        422,
      );
    }
  }
}
