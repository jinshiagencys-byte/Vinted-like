import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';
import type {
  NotificationPort,
  ReinitialisationRepository,
  UtilisateurRepository,
} from '../../domain/ports';
import {
  NOTIFICATION_PORT,
  REINITIALISATION_REPOSITORY,
  UTILISATEUR_REPOSITORY,
} from '../../domain/ports';
import { Email } from '../../domain/value-objects/email';
import { LimiteurDebitService } from '../../infrastructure/securite/limiteur-debit.service';

const DUREE_JETON_MS = 30 * 60 * 1000;

@Injectable()
export class DemanderReinitialisation {
  constructor(
    @Inject(UTILISATEUR_REPOSITORY) private readonly utilisateurs: UtilisateurRepository,
    @Inject(REINITIALISATION_REPOSITORY) private readonly jetons: ReinitialisationRepository,
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
    private readonly limiteur: LimiteurDebitService,
    private readonly config: ConfigService,
  ) {}

  async executer(emailBrut: string, ip: string): Promise<{ message: string }> {
    await this.limiteur.consommer(
      `reinitialisation:${LimiteurDebitService.empreinte(ip)}`,
      3,
      3_600,
    );

    const email = Email.creer(emailBrut);
    const utilisateur = await this.utilisateurs.trouverParEmail(email.valeur);

    if (
      !utilisateur ||
      utilisateur.supprimeLe ||
      utilisateur.statut === 'suspendu' ||
      utilisateur.statut === 'supprime'
    ) {
      return { message: 'Si un compte existe, un lien de réinitialisation a été envoyé.' };
    }

    const jeton = randomBytes(32).toString('base64url');
    const jetonHash = createHmac('sha256', this.config.getOrThrow<string>('AUTH_RESET_PEPPER'))
      .update(jeton)
      .digest('hex');

    await this.jetons.creer({
      utilisateurId: utilisateur.id,
      jetonHash,
      expireLe: new Date(Date.now() + DUREE_JETON_MS),
    });

    await this.notifications.envoyer({
      canal: 'email',
      destinataire: email.valeur,
      modele: 'reinitialisation_mot_de_passe',
      variables: { jeton },
      utilisateurId: utilisateur.id,
    });

    return { message: 'Si un compte existe, un lien de réinitialisation a été envoyé.' };
  }
}
