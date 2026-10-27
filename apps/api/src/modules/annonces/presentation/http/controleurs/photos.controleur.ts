import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { EmailVerifieGuard } from '../../../../../common/auth/email-verifie.guard';
import { VersionSecuriteGuard } from '../../../../comptes/presentation/http/guards/version-securite.guard';
import { ConfirmerPhoto } from '../../../application/cas-usage/confirmer-photo';
import { PreparerPhoto } from '../../../application/cas-usage/preparer-photo';
import { ReordonnerPhotos } from '../../../application/cas-usage/reordonner-photos';
import { SupprimerPhoto } from '../../../application/cas-usage/supprimer-photo';
import { preparerPhotoSchema, reordonnerPhotosSchema } from '../schemas/photo.schema';
import { versAnnonceApi } from '../serialiseurs/annonce.serialiseur';

@Controller('annonces/:id/photos')
@UseGuards(EmailVerifieGuard, VersionSecuriteGuard)
export class PhotosControleur {
  constructor(
    private readonly preparer: PreparerPhoto,
    private readonly confirmer: ConfirmerPhoto,
    private readonly supprimer: SupprimerPhoto,
    private readonly reordonner: ReordonnerPhotos,
  ) {}

  @Post()
  @HttpCode(201)
  preparerPhoto(@Param('id') id: string, @Body() body: unknown, @Req() request: Request) {
    const commande = preparerPhotoSchema.parse(body);
    return this.preparer.executer(request.utilisateur!.id, id, commande);
  }

  @Patch('ordre')
  async reordonnerPhotos(@Param('id') id: string, @Body() body: unknown, @Req() request: Request) {
    const commande = reordonnerPhotosSchema.parse(body);
    const annonce = await this.reordonner.executer(request.utilisateur!.id, id, commande.photoIds);
    return versAnnonceApi(annonce);
  }

  @Post(':photoId/confirmer')
  @HttpCode(202)
  confirmerPhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Req() request: Request,
  ) {
    return this.confirmer.executer(request.utilisateur!.id, id, photoId);
  }

  @Post(':photoId/principale')
  @HttpCode(200)
  async definirPrincipale(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Req() request: Request,
  ) {
    const annonce = await this.reordonner.definirPrincipale(request.utilisateur!.id, id, photoId);
    return versAnnonceApi(annonce);
  }

  @Delete(':photoId')
  @HttpCode(200)
  async supprimerPhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Req() request: Request,
  ) {
    const annonce = await this.supprimer.executer(request.utilisateur!.id, id, photoId);
    return versAnnonceApi(annonce);
  }
}
