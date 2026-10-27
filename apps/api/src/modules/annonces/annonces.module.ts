import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module';
import { OutboxModule } from '../../common/outbox/outbox.module';
import { ComptesModule } from '../comptes/comptes.module';
import { ArchiverAnnonce } from './application/cas-usage/archiver-annonce';
import { ConfirmerPhoto } from './application/cas-usage/confirmer-photo';
import { ConsulterAnnonce } from './application/cas-usage/consulter-annonce';
import { CreerBrouillon } from './application/cas-usage/creer-brouillon';
import { GererFavoris } from './application/cas-usage/gerer-favoris';
import { ListerMesAnnonces } from './application/cas-usage/lister-mes-annonces';
import { ModifierAnnonce } from './application/cas-usage/modifier-annonce';
import { PreparerPhoto } from './application/cas-usage/preparer-photo';
import { PublierAnnonce } from './application/cas-usage/publier-annonce';
import { ReordonnerPhotos } from './application/cas-usage/reordonner-photos';
import { RepublierAnnonce } from './application/cas-usage/republier-annonce';
import { SupprimerPhoto } from './application/cas-usage/supprimer-photo';
import { AccesAnnonce } from './application/services/acces-annonce';
import { ConsommerEvenementsAnnonces } from './application/services/consommer-evenements-annonces';
import { ListerReferentiels } from './application/services/lister-referentiels';
import { PHOTOS_QUEUE } from './application/services/photos.constants';
import { ProjectionAnnonce } from './application/services/projection-annonce';
import {
  ANNONCE_REPOSITORY,
  CACHE_REFERENTIELS,
  COMPTES_QUERY,
  FAVORI_REPOSITORY,
  MODERATION_TEXTE,
  PHOTO_REPOSITORY,
  REFERENTIEL_REPOSITORY,
  STOCKAGE_OBJET,
  TRAITEMENT_IMAGE,
} from './domain/ports';
import { ComptesQueryAdapter } from './infrastructure/adaptateurs/comptes-query.adapter';
import { CacheRedisAdapter } from './infrastructure/cache/cache-redis.adapter';
import { StockageS3Adapter } from './infrastructure/medias/stockage-s3.adapter';
import { TraitementImageSharpAdapter } from './infrastructure/medias/traitement-image-sharp.adapter';
import { ModerationTexteAdapter } from './infrastructure/moderation/moderation-texte.adapter';
import { AnnoncePrismaRepository } from './infrastructure/persistance/prisma/annonce.prisma.repository';
import { FavoriPrismaRepository } from './infrastructure/persistance/prisma/favori.prisma.repository';
import { PhotoPrismaRepository } from './infrastructure/persistance/prisma/photo.prisma.repository';
import { ReferentielPrismaRepository } from './infrastructure/persistance/prisma/referentiel.prisma.repository';
import {
  AnnoncesControleur,
  MesAnnoncesControleur,
} from './presentation/http/controleurs/annonces.controleur';
import { FavorisControleur } from './presentation/http/controleurs/favoris.controleur';
import { PhotosControleur } from './presentation/http/controleurs/photos.controleur';
import { ReferentielsControleur } from './presentation/http/controleurs/referentiels.controleur';
import { PhotosProcessor } from './workers/photos.processor';

const repositories = [
  AnnoncePrismaRepository,
  PhotoPrismaRepository,
  FavoriPrismaRepository,
  ReferentielPrismaRepository,
];

const casUsage = [
  CreerBrouillon,
  ModifierAnnonce,
  ConsulterAnnonce,
  ListerMesAnnonces,
  PreparerPhoto,
  ConfirmerPhoto,
  SupprimerPhoto,
  ReordonnerPhotos,
  PublierAnnonce,
  ArchiverAnnonce,
  RepublierAnnonce,
  GererFavoris,
];

@Module({
  imports: [
    AuthModule,
    OutboxModule,
    ComptesModule,
    BullModule.registerQueue({ name: PHOTOS_QUEUE }),
  ],
  controllers: [
    AnnoncesControleur,
    MesAnnoncesControleur,
    PhotosControleur,
    FavorisControleur,
    ReferentielsControleur,
  ],
  providers: [
    ...repositories,
    ...casUsage,
    AccesAnnonce,
    ProjectionAnnonce,
    ListerReferentiels,
    ConsommerEvenementsAnnonces,
    ComptesQueryAdapter,
    CacheRedisAdapter,
    StockageS3Adapter,
    TraitementImageSharpAdapter,
    ModerationTexteAdapter,
    PhotosProcessor,
    { provide: ANNONCE_REPOSITORY, useExisting: AnnoncePrismaRepository },
    { provide: PHOTO_REPOSITORY, useExisting: PhotoPrismaRepository },
    { provide: FAVORI_REPOSITORY, useExisting: FavoriPrismaRepository },
    { provide: REFERENTIEL_REPOSITORY, useExisting: ReferentielPrismaRepository },
    { provide: COMPTES_QUERY, useExisting: ComptesQueryAdapter },
    { provide: STOCKAGE_OBJET, useExisting: StockageS3Adapter },
    { provide: TRAITEMENT_IMAGE, useExisting: TraitementImageSharpAdapter },
    { provide: MODERATION_TEXTE, useExisting: ModerationTexteAdapter },
    { provide: CACHE_REFERENTIELS, useExisting: CacheRedisAdapter },
  ],
  exports: [ConsommerEvenementsAnnonces, GererFavoris, ListerReferentiels],
})
export class AnnoncesModule {}
