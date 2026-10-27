import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../../../../common/auth/public.decorator';
import { ConfirmerReinitialisation } from '../../../application/cas-usage/confirmer-reinitialisation';
import { Connecter } from '../../../application/cas-usage/connecter';
import { Deconnecter } from '../../../application/cas-usage/deconnecter';
import { DemanderReinitialisation } from '../../../application/cas-usage/demander-reinitialisation';
import { InscrireCompte } from '../../../application/cas-usage/inscrire-compte';
import { RafraichirSession } from '../../../application/cas-usage/rafraichir-session';
import { RenvoyerCodeEmail } from '../../../application/cas-usage/renvoyer-code-email';
import { RenvoyerCodeTelephone } from '../../../application/cas-usage/renvoyer-code-telephone';
import { VerifierEmail } from '../../../application/cas-usage/verifier-email';
import { VerifierTelephone } from '../../../application/cas-usage/verifier-telephone';
import type { SessionEmise } from '../../../application/types';
import {
  confirmerReinitialisationSchema,
  connexionSchema,
  demanderReinitialisationSchema,
  inscriptionSchema,
  refreshSchema,
  renvoyerEmailSchema,
  verifierEmailSchema,
  verifierTelephoneSchema,
} from '../schemas/auth.schema';
import { VersionSecuriteGuard } from '../guards/version-securite.guard';

function ipDe(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? 'inconnu';
}

@Controller('auth')
export class AuthControleur {
  constructor(
    private readonly inscrireCompte: InscrireCompte,
    private readonly verifierEmail: VerifierEmail,
    private readonly renvoyerCodeEmail: RenvoyerCodeEmail,
    private readonly connecter: Connecter,
    private readonly rafraichirSession: RafraichirSession,
    private readonly deconnecter: Deconnecter,
    private readonly verifierTelephone: VerifierTelephone,
    private readonly renvoyerCodeTelephone: RenvoyerCodeTelephone,
    private readonly demanderReinitialisation: DemanderReinitialisation,
    private readonly confirmerReinitialisation: ConfirmerReinitialisation,
  ) {}

  @Public()
  @Post('inscription')
  @HttpCode(201)
  inscrire(@Body() body: unknown, @Req() request: Request) {
    return this.inscrireCompte.executer({
      ...inscriptionSchema.parse(body),
      ip: ipDe(request),
    });
  }

  @Public()
  @Post('email/verifier')
  @HttpCode(200)
  verifierEmailAdresse(@Body() body: unknown, @Req() request: Request): Promise<SessionEmise> {
    const commande = verifierEmailSchema.parse(body);
    return this.verifierEmail.executer({ ...commande, ip: ipDe(request) });
  }

  @Public()
  @Post('email/renvoyer')
  @HttpCode(202)
  renvoyerEmail(@Body() body: unknown, @Req() request: Request) {
    const commande = renvoyerEmailSchema.parse(body);
    return this.renvoyerCodeEmail.executer(commande.email, ipDe(request));
  }

  @Public()
  @Post('connexion')
  @HttpCode(200)
  connexion(@Body() body: unknown, @Req() request: Request): Promise<SessionEmise> {
    const commande = connexionSchema.parse(body);
    return this.connecter.executer({ ...commande, ip: ipDe(request) });
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  rafraichir(@Body() body: unknown, @Req() request: Request): Promise<SessionEmise> {
    const commande = refreshSchema.parse(body);
    return this.rafraichirSession.executer(commande.refreshToken, ipDe(request));
  }

  @Post('deconnexion')
  @HttpCode(204)
  async deconnexion(@Req() request: Request): Promise<void> {
    await this.deconnecter.executer(request.utilisateur!.id, request.utilisateur!.appareilId);
  }

  @Post('telephone/verifier')
  @HttpCode(200)
  @UseGuards(VersionSecuriteGuard)
  verifierTelephoneAdresse(@Body() body: unknown, @Req() request: Request) {
    const commande = verifierTelephoneSchema.parse(body);
    return this.verifierTelephone.executer(request.utilisateur!.id, commande.code);
  }

  @Post('telephone/renvoyer')
  @HttpCode(202)
  @UseGuards(VersionSecuriteGuard)
  async renvoyerTelephone(@Req() request: Request): Promise<void> {
    await this.renvoyerCodeTelephone.executer(request.utilisateur!.id);
  }

  @Public()
  @Post('mot-de-passe/reinitialiser')
  @HttpCode(202)
  demanderReinitialisationMotDePasse(@Body() body: unknown, @Req() request: Request) {
    const commande = demanderReinitialisationSchema.parse(body);
    return this.demanderReinitialisation.executer(commande.email, ipDe(request));
  }

  @Public()
  @Post('mot-de-passe/reinitialiser/confirmer')
  @HttpCode(204)
  async confirmerReinitialisationMotDePasse(@Body() body: unknown): Promise<void> {
    const commande = confirmerReinitialisationSchema.parse(body);
    await this.confirmerReinitialisation.executer(commande.jeton, commande.nouveauMotDePasse);
  }
}
