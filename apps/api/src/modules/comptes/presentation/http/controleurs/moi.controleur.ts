import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { EmailVerifieGuard } from '../../../../../common/auth/email-verifie.guard';
import { Public } from '../../../../../common/auth/public.decorator';
import { ChangerMotDePasse } from '../../../application/cas-usage/changer-mot-de-passe';
import { ConsulterMoi } from '../../../application/cas-usage/consulter-moi';
import { MettreAJourProfil } from '../../../application/cas-usage/mettre-a-jour-profil';
import { SupprimerCompte } from '../../../application/cas-usage/supprimer-compte';
import { GererExports } from '../../../application/services/gerer-exports';
import {
  changerMotDePasseSchema,
  miseAJourProfilSchema,
  supprimerCompteSchema,
} from '../schemas/moi.schema';
import { VersionSecuriteGuard } from '../guards/version-securite.guard';

@Controller('moi')
export class MoiControleur {
  constructor(
    private readonly consulterMoi: ConsulterMoi,
    private readonly mettreAJourProfil: MettreAJourProfil,
    private readonly changerMotDePasse: ChangerMotDePasse,
    private readonly supprimerCompte: SupprimerCompte,
    private readonly exports: GererExports,
  ) {}

  @Get()
  @UseGuards(VersionSecuriteGuard)
  consulter(@Req() request: Request) {
    return this.consulterMoi.executer(request.utilisateur!.id);
  }

  @Patch()
  @UseGuards(VersionSecuriteGuard)
  modifier(@Body() body: unknown, @Req() request: Request) {
    const commande = miseAJourProfilSchema.parse(body);
    return this.mettreAJourProfil.executer(request.utilisateur!.id, commande);
  }

  @Patch('mot-de-passe')
  @HttpCode(204)
  @UseGuards(VersionSecuriteGuard)
  async modifierMotDePasse(@Body() body: unknown, @Req() request: Request): Promise<void> {
    const commande = changerMotDePasseSchema.parse(body);
    await this.changerMotDePasse.executer(
      request.utilisateur!.id,
      commande.motDePasseActuel,
      commande.nouveauMotDePasse,
    );
  }

  @Delete()
  @HttpCode(204)
  @UseGuards(VersionSecuriteGuard)
  async supprimer(@Body() body: unknown, @Req() request: Request): Promise<void> {
    const commande = supprimerCompteSchema.parse(body);
    await this.supprimerCompte.executer(request.utilisateur!.id, commande.motDePasse);
  }

  @Post('export')
  @HttpCode(202)
  @UseGuards(EmailVerifieGuard, VersionSecuriteGuard)
  demanderExport(@Req() request: Request) {
    return this.exports.demander(request.utilisateur!.id);
  }

  @Get('export/:id')
  @UseGuards(VersionSecuriteGuard)
  consulterExport(@Param('id') id: string, @Req() request: Request) {
    return this.exports.consulter(request.utilisateur!.id, id);
  }
}

@Controller('moi/export')
export class TelechargementExportControleur {
  constructor(private readonly exports: GererExports) {}

  @Public()
  @Get(':id/telecharger')
  async telecharger(
    @Param('id') id: string,
    @Query('exp') exp: string,
    @Query('signature') signature: string,
    @Res() response: Response,
  ): Promise<void> {
    const { contenu, nomFichier } = await this.exports.telecharger(
      id,
      Number(exp),
      signature ?? '',
    );

    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
    response.setHeader('Cache-Control', 'no-store');
    response.send(contenu);
  }
}
