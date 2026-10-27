import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { GererAppareils } from '../../../application/cas-usage/gerer-appareils';
import { pushTokenSchema } from '../schemas/moi.schema';
import { VersionSecuriteGuard } from '../guards/version-securite.guard';

@Controller('moi/appareils')
@UseGuards(VersionSecuriteGuard)
export class AppareilsControleur {
  constructor(private readonly appareils: GererAppareils) {}

  @Get()
  lister(@Req() request: Request) {
    return this.appareils.lister(request.utilisateur!.id);
  }

  @Delete(':id')
  @HttpCode(204)
  async revoquer(@Param('id') id: string, @Req() request: Request): Promise<void> {
    await this.appareils.revoquer(request.utilisateur!.id, id);
  }

  @Put('push-token')
  @HttpCode(204)
  async pushToken(@Body() body: unknown, @Req() request: Request): Promise<void> {
    const commande = pushTokenSchema.parse(body);
    await this.appareils.mettreAJourPushToken(
      request.utilisateur!.id,
      commande.deviceId,
      commande.pushToken,
    );
  }
}
