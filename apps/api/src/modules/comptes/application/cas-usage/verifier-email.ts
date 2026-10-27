import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../common/database/prisma.service';
import { DomainError } from '../../../../common/errors/domain-error';
import { LimiteDebitException } from '../../../../common/errors/limite-debit.exception';
import { OutboxService } from '../../../../common/outbox/outbox.service';
import type { AppareilDemande, SessionEmise } from '../types';
import type { UtilisateurRepository, VerificationRepository } from '../../domain/ports';
import { UTILISATEUR_REPOSITORY, VERIFICATION_REPOSITORY } from '../../domain/ports';
import { PolitiqueVerification } from '../../domain/policies/politique-verification';
import { CodeVerification } from '../../domain/value-objects/code-verification';
import { Email } from '../../domain/value-objects/email';
import { ServiceSessions } from '../services/service-sessions';
import { LimiteurDebitService } from '../../infrastructure/securite/limiteur-debit.service';

export interface VerifierEmailCommande {
  email: string;
  code: string;
  appareil: AppareilDemande;
  ip: string;
}

@Injectable()
export class VerifierEmail {
  constructor(
    @Inject(UTILISATEUR_REPOSITORY) private readonly utilisateurs: UtilisateurRepository,
    @Inject(VERIFICATION_REPOSITORY) private readonly verifications: VerificationRepository,
    private readonly politique: PolitiqueVerification,
    private readonly sessions: ServiceSessions,
    private readonly limiteur: LimiteurDebitService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async executer(commande: VerifierEmailCommande): Promise<SessionEmise> {
    await this.limiteur.consommer(
      `verifier-email:${LimiteurDebitService.empreinte(commande.ip)}`,
      10,
      600,
    );

    const email = Email.creer(commande.email);
    const utilisateur = await this.utilisateurs.trouverParEmail(email.valeur);

    if (!utilisateur || utilisateur.supprimeLe) {
      throw new DomainError('code_invalide', 'Le code est invalide ou expiré.', 422);
    }

    if (utilisateur.statut === 'suspendu' || utilisateur.statut === 'supprime') {
      throw new DomainError('autorisation_refusee', 'Ce compte ne peut pas être vérifié.', 403, {
        raison: 'compte_suspendu',
      });
    }

    const verification = await this.verifications.trouverEnAttente(utilisateur.id, 'email');

    if (!verification) {
      throw new DomainError('code_invalide', 'Le code est invalide ou expiré.', 422);
    }

    if (this.politique.estExpire(verification)) {
      await this.verifications.marquerStatut(verification.id, 'expire');
      throw new DomainError('code_expire', 'Le code a expiré. Demandez un nouveau code.', 422);
    }

    if (!this.politique.peutTenter(verification)) {
      throw new LimiteDebitException(
        3_600,
        'tentatives_epuisees',
        'Trop de tentatives. Demandez un nouveau code plus tard.',
      );
    }

    const valide =
      verification.codeHash !== null &&
      CodeVerification.verifier(
        commande.code,
        verification.codeHash,
        this.config.getOrThrow<string>('AUTH_CODE_PEPPER'),
        `${email.valeur}:email`,
      );

    if (!valide) {
      const apres = await this.verifications.incrementerTentatives(verification.id);

      if (!this.politique.peutTenter(apres)) {
        throw new LimiteDebitException(
          3_600,
          'tentatives_epuisees',
          'Trop de tentatives. Demandez un nouveau code plus tard.',
        );
      }

      throw new DomainError('code_invalide', 'Le code est invalide ou expiré.', 422);
    }

    const valideLe = new Date();
    await this.verifications.marquerStatut(verification.id, 'valide', valideLe);

    const utilisateurAJour =
      utilisateur.emailVerifieLe !== null
        ? utilisateur
        : await this.utilisateurs.mettreAJour(utilisateur.id, { emailVerifieLe: valideLe });

    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enregistrer(tx, {
        type: 'compte.email_verifie',
        agregatType: 'utilisateur',
        agregatId: utilisateur.id,
        payload: { utilisateurId: utilisateur.id, valideLe: valideLe.toISOString() },
      });
    });

    return this.sessions.ouvrir(utilisateurAJour, commande.appareil);
  }
}
