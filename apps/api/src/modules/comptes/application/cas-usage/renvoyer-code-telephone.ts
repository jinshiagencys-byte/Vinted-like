import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '../../../../common/errors/domain-error';
import { PolitiqueVerification } from '../../domain/policies/politique-verification';
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
import { CodeVerification } from '../../domain/value-objects/code-verification';
import { LimiteurDebitService } from '../../infrastructure/securite/limiteur-debit.service';

@Injectable()
export class RenvoyerCodeTelephone {
  constructor(
    @Inject(UTILISATEUR_REPOSITORY) private readonly utilisateurs: UtilisateurRepository,
    @Inject(VERIFICATION_REPOSITORY) private readonly verifications: VerificationRepository,
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
    private readonly politique: PolitiqueVerification,
    private readonly limiteur: LimiteurDebitService,
    private readonly config: ConfigService,
  ) {}

  async executer(utilisateurId: string): Promise<void> {
    await this.limiteur.consommer(`renvoi-sms:${utilisateurId}`, 3, 900);
    await this.limiteur.consommer(`renvoi-sms-cooldown:${utilisateurId}`, 1, 60);

    const utilisateur = await this.utilisateurs.trouverParId(utilisateurId);

    if (!utilisateur?.telephone) {
      throw new DomainError('telephone_absent', 'Renseignez d’abord un numéro de téléphone.', 422);
    }

    const maintenant = new Date();
    const depuis24h = new Date(maintenant.getTime() - 24 * 60 * 60 * 1000);
    const renvois = await this.verifications.compterDepuis(utilisateurId, 'telephone', depuis24h);
    const derniere = await this.verifications.trouverEnAttente(utilisateurId, 'telephone');

    if (!this.politique.peutRenvoyer(derniere?.creeLe ?? null, renvois, maintenant)) {
      return;
    }

    await this.verifications.invaliderEnAttente(utilisateurId, 'telephone', 'expire');

    const code = CodeVerification.generer();
    await this.verifications.creer({
      utilisateurId,
      type: 'telephone',
      codeHash: code.hacher(
        this.config.getOrThrow<string>('AUTH_CODE_PEPPER'),
        `${utilisateurId}:telephone`,
      ),
      expireLe: this.politique.expirationDepuis(maintenant),
    });

    await this.notifications.envoyer({
      canal: 'sms',
      destinataire: utilisateur.telephone,
      modele: 'verification_telephone',
      variables: { code: code.reveler() },
      utilisateurId,
    });
  }
}
