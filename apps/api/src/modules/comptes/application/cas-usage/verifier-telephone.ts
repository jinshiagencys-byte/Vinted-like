import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../common/database/prisma.service';
import { DomainError } from '../../../../common/errors/domain-error';
import { LimiteDebitException } from '../../../../common/errors/limite-debit.exception';
import { OutboxService } from '../../../../common/outbox/outbox.service';
import { PolitiqueVerification } from '../../domain/policies/politique-verification';
import type { Utilisateur, Verification } from '../../domain/entities';
import type { UtilisateurRepository, VerificationRepository } from '../../domain/ports';
import { UTILISATEUR_REPOSITORY, VERIFICATION_REPOSITORY } from '../../domain/ports';
import { CodeVerification } from '../../domain/value-objects/code-verification';

@Injectable()
export class VerifierTelephone {
  constructor(
    @Inject(UTILISATEUR_REPOSITORY) private readonly utilisateurs: UtilisateurRepository,
    @Inject(VERIFICATION_REPOSITORY) private readonly verifications: VerificationRepository,
    private readonly politique: PolitiqueVerification,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async executer(utilisateurId: string, codeBrut: string): Promise<{ telephoneVerifie: true }> {
    const utilisateur = await this.utilisateurs.trouverParId(utilisateurId);

    if (!utilisateur?.telephone) {
      throw new DomainError('telephone_absent', 'Renseignez d’abord un numéro de téléphone.', 422);
    }

    const verification = await this.verifications.trouverEnAttente(utilisateurId, 'telephone');

    if (!verification) {
      throw new DomainError('code_invalide', 'Le code est invalide ou expiré.', 422);
    }

    if (this.politique.estExpire(verification)) {
      await this.verifications.marquerStatut(verification.id, 'expire');
      throw new DomainError('code_expire', 'Le code a expiré. Demandez un nouveau code.', 422);
    }

    if (!this.politique.peutTenter(verification)) {
      throw new LimiteDebitException(3_600, 'tentatives_epuisees', 'Trop de tentatives.');
    }

    const valide = this.verifierCode(utilisateur, verification, codeBrut);
    if (!valide) {
      const apres = await this.verifications.incrementerTentatives(verification.id);
      if (!this.politique.peutTenter(apres)) {
        throw new LimiteDebitException(3_600, 'tentatives_epuisees', 'Trop de tentatives.');
      }
      throw new DomainError('code_invalide', 'Le code est invalide ou expiré.', 422);
    }

    const valideLe = new Date();
    await this.verifications.marquerStatut(verification.id, 'valide', valideLe);
    await this.utilisateurs.mettreAJour(utilisateur.id, { telephoneVerifieLe: valideLe });

    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enregistrer(tx, {
        type: 'compte.telephone_verifie',
        agregatType: 'utilisateur',
        agregatId: utilisateur.id,
        payload: { utilisateurId: utilisateur.id, valideLe: valideLe.toISOString() },
      });
    });

    return { telephoneVerifie: true };
  }

  private verifierCode(
    utilisateur: Utilisateur,
    verification: Verification,
    codeBrut: string,
  ): boolean {
    return (
      verification.codeHash !== null &&
      CodeVerification.verifier(
        codeBrut,
        verification.codeHash,
        this.config.getOrThrow<string>('AUTH_CODE_PEPPER'),
        `${utilisateur.id}:telephone`,
      )
    );
  }
}
