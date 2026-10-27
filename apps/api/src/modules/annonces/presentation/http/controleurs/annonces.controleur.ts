import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { EmailVerifieGuard } from '../../../../../common/auth/email-verifie.guard';
import { Public } from '../../../../../common/auth/public.decorator';
import { VersionSecuriteGuard } from '../../../../comptes/presentation/http/guards/version-securite.guard';
import { ArchiverAnnonce } from '../../../application/cas-usage/archiver-annonce';
import { ConsulterAnnonce } from '../../../application/cas-usage/consulter-annonce';
import { CreerBrouillon } from '../../../application/cas-usage/creer-brouillon';
import { ListerMesAnnonces } from '../../../application/cas-usage/lister-mes-annonces';
import { ModifierAnnonce } from '../../../application/cas-usage/modifier-annonce';
import { PublierAnnonce } from '../../../application/cas-usage/publier-annonce';
import { RepublierAnnonce } from '../../../application/cas-usage/republier-annonce';
import {
  creerAnnonceSchema,
  listerMesAnnoncesSchema,
  modifierAnnonceSchema,
  publierAnnonceSchema,
} from '../schemas/annonce.schema';
import { versAnnonceApi, versPageAnnoncesApi } from '../serialiseurs/annonce.serialiseur';

@Controller('annonces')
export class AnnoncesControleur {
  constructor(
    private readonly creer: CreerBrouillon,
    private readonly modifier: ModifierAnnonce,
    private readonly consulter: ConsulterAnnonce,
    private readonly publier: PublierAnnonce,
    private readonly archiver: ArchiverAnnonce,
    private readonly republier: RepublierAnnonce,
  ) {}

  @Post()
  @HttpCode(201)
  @UseGuards(EmailVerifieGuard, VersionSecuriteGuard)
  async creerBrouillon(@Body() body: unknown, @Req() request: Request) {
    const commande = creerAnnonceSchema.parse(body ?? {});
    const annonce = await this.creer.executer(request.utilisateur!.id, commande);
    return versAnnonceApi(annonce);
  }

  @Patch(':id')
  @UseGuards(VersionSecuriteGuard)
  async modifierAnnonce(@Param('id') id: string, @Body() body: unknown, @Req() request: Request) {
    const commande = modifierAnnonceSchema.parse(body);
    const annonce = await this.modifier.executer(request.utilisateur!.id, id, commande);
    return versAnnonceApi(annonce);
  }

  @Public()
  @Get(':id')
  async consulterAnnonce(@Param('id') id: string, @Req() request: Request) {
    const vue = await this.consulter.executer(id, {
      ...(request.utilisateur ? { id: request.utilisateur.id } : {}),
      ...(request.utilisateur ? { role: request.utilisateur.role } : {}),
    });

    return versAnnonceApi(vue, vue.roleActeur);
  }

  @Post(':id/publier')
  @HttpCode(200)
  @UseGuards(VersionSecuriteGuard)
  publierAnnonce(@Param('id') id: string, @Body() body: unknown, @Req() request: Request) {
    const commande = publierAnnonceSchema.parse(body);
    return this.publier.executer(request.utilisateur!.id, id, commande.version);
  }

  @Post(':id/archiver')
  @HttpCode(200)
  @UseGuards(VersionSecuriteGuard)
  archiverAnnonce(@Param('id') id: string, @Req() request: Request) {
    return this.archiver.executer(request.utilisateur!.id, id);
  }

  @Post(':id/republier')
  @HttpCode(200)
  @UseGuards(VersionSecuriteGuard)
  republierAnnonce(@Param('id') id: string, @Body() body: unknown, @Req() request: Request) {
    const commande = publierAnnonceSchema.parse(body);
    return this.republier.executer(request.utilisateur!.id, id, commande.version);
  }
}

@Controller('moi/annonces')
@UseGuards(VersionSecuriteGuard)
export class MesAnnoncesControleur {
  constructor(private readonly lister: ListerMesAnnonces) {}

  @Get()
  async listerMesAnnonces(@Query() query: unknown, @Req() request: Request) {
    const commande = listerMesAnnoncesSchema.parse(query);
    const page = await this.lister.executer(request.utilisateur!.id, commande);
    return versPageAnnoncesApi(page);
  }
}
