import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  NotificationPort,
  UtilisateurRepository,
  VerificationRepository,
} from '../../domain/ports';
import {
  NOTIFICATION_PORT,
  UTILISATEUR_REPOSITORY,
  VERIFICATION_REPOSITORY,
} from '../../domain/ports';
import { PolitiqueVerification } from '../../domain/policies/politique-verification';
import { CodeVerification } from '../../domain/value-objects/code-verification';
import { Email } from '../../domain/value-objects/email';
import { LimiteurDebitService } from '../../infrastructure/securite/limiteur-debit.service';

@Injectable()
export class RenvoyerCodeEmail {
  constructor(
    @Inject(UTILISATEUR_REPOSITORY) private readonly utilisateurs: UtilisateurRepository,
    @Inject(VERIFICATION_REPOSITORY) private readonly verifications: VerificationRepository,
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
    private readonly politique: PolitiqueVerification,
    private readonly limiteur: LimiteurDebitService,
    private readonly config: ConfigService,
  ) {}

  async executer(emailBrut: string, ip: string): Promise<{ message: string }> {
    await this.limiteur.consommer(`renvoi-email-ip:${LimiteurDebitService.empreinte(ip)}`, 3, 900);
    await this.limiteur.consommer(
      `renvoi-email-cooldown:${LimiteurDebitService.empreinte(ip)}`,
      1,
      60,
    );

    const email = Email.creer(emailBrut);
    const utilisateur = await this.utilisateurs.trouverParEmail(email.valeur);

    if (!utilisateur || utilisateur.emailVerifieLe !== null || utilisateur.supprimeLe) {
      return { message: 'Si un compte existe, un nouveau code a été envoyé.' };
    }

    if (utilisateur.statut === 'suspendu' || utilisateur.statut === 'supprime') {
      return { message: 'Si un compte existe, un nouveau code a été envoyé.' };
    }

    const maintenant = new Date();
    const depuis24h = new Date(maintenant.getTime() - 24 * 60 * 60 * 1000);
    const renvois = await this.verifications.compterDepuis(utilisateur.id, 'email', depuis24h);
    const derniere = await this.verifications.trouverEnAttente(utilisateur.id, 'email');

    if (!this.politique.peutRenvoyer(derniere?.creeLe ?? null, renvois, maintenant)) {
      return { message: 'Si un compte existe, un nouveau code a été envoyé.' };
    }

    await this.verifications.invaliderEnAttente(utilisateur.id, 'email', 'expire');

    const code = CodeVerification.generer();
    const expireLe = this.politique.expirationDepuis(maintenant);

    await this.verifications.creer({
      utilisateurId: utilisateur.id,
      type: 'email',
      codeHash: code.hacher(
        this.config.getOrThrow<string>('AUTH_CODE_PEPPER'),
        `${email.valeur}:email`,
      ),
      expireLe,
    });

    await this.notifications.envoyer({
      canal: 'email',
      destinataire: email.valeur,
      modele: 'verification_email',
      variables: { code: code.reveler() },
      utilisateurId: utilisateur.id,
    });

    return { message: 'Si un compte existe, un nouveau code a été envoyé.' };
  }
}
