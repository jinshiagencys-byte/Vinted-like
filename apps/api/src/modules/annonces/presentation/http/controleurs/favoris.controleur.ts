import { Controller, Delete, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { EmailVerifieGuard } from '../../../../../common/auth/email-verifie.guard';
import { VersionSecuriteGuard } from '../../../../comptes/presentation/http/guards/version-securite.guard';
import { GererFavoris } from '../../../application/cas-usage/gerer-favoris';

@Controller('annonces/:id/favori')
export class FavorisControleur {
  constructor(private readonly favoris: GererFavoris) {}

  @Post()
  @UseGuards(EmailVerifieGuard, VersionSecuriteGuard)
  @HttpCode(200)
  ajouter(@Param('id') id: string, @Req() request: Request) {
    return this.favoris.ajouter(request.utilisateur!.id, id);
  }

  @Delete()
  @HttpCode(200)
  @UseGuards(VersionSecuriteGuard)
  retirer(@Param('id') id: string, @Req() request: Request) {
    return this.favoris.retirer(request.utilisateur!.id, id);
  }
}
