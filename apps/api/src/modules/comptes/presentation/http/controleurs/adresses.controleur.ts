import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { GererAdresses } from '../../../application/cas-usage/gerer-adresses';
import { creerAdresseSchema, modifierAdresseSchema } from '../schemas/adresse.schema';
import { VersionSecuriteGuard } from '../guards/version-securite.guard';

@Controller('moi/adresses')
@UseGuards(VersionSecuriteGuard)
export class AdressesControleur {
  constructor(private readonly adresses: GererAdresses) {}

  @Get()
  lister(@Req() request: Request) {
    return this.adresses.lister(request.utilisateur!.id);
  }

  @Post()
  @HttpCode(201)
  ajouter(@Body() body: unknown, @Req() request: Request) {
    const commande = creerAdresseSchema.parse(body);
    return this.adresses.ajouter(request.utilisateur!.id, commande);
  }

  @Patch(':id')
  modifier(@Param('id') id: string, @Body() body: unknown, @Req() request: Request) {
    const commande = modifierAdresseSchema.parse(body);
    return this.adresses.modifier(request.utilisateur!.id, id, commande);
  }

  @Delete(':id')
  @HttpCode(204)
  async supprimer(@Param('id') id: string, @Req() request: Request): Promise<void> {
    await this.adresses.supprimer(request.utilisateur!.id, id);
  }

  @Post(':id/defaut')
  @HttpCode(204)
  async definirDefaut(@Param('id') id: string, @Req() request: Request): Promise<void> {
    await this.adresses.definirDefaut(request.utilisateur!.id, id);
  }
}
