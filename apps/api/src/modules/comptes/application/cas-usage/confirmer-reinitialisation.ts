import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../../../../common/database/prisma.service';
import { DomainError } from '../../../../common/errors/domain-error';
import { OutboxService } from '../../../../common/outbox/outbox.service';
import { PolitiqueMotDePasse } from '../../domain/policies/politique-mot-de-passe';
import type {
  AppareilRepository,
  HacheurMotDePasse,
  ReinitialisationRepository,
  UtilisateurRepository,
} from '../../domain/ports';
import {
  APPAREIL_REPOSITORY,
  HACHEUR_MOT_DE_PASSE,
  REINITIALISATION_REPOSITORY,
  UTILISATEUR_REPOSITORY,
} from '../../domain/ports';
import { Email } from '../../domain/value-objects/email';
import { MotDePasse } from '../../domain/value-objects/mot-de-passe';
import { Pseudo } from '../../domain/value-objects/pseudo';

@Injectable()
export class ConfirmerReinitialisation {
  constructor(
    @Inject(UTILISATEUR_REPOSITORY) private readonly utilisateurs: UtilisateurRepository,
    @Inject(REINITIALISATION_REPOSITORY) private readonly jetons: ReinitialisationRepository,
    @Inject(APPAREIL_REPOSITORY) private readonly appareils: AppareilRepository,
    @Inject(HACHEUR_MOT_DE_PASSE) private readonly hacheur: HacheurMotDePasse,
    private readonly politique: PolitiqueMotDePasse,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async executer(jeton: string, nouveauMotDePasse: string): Promise<void> {
    const jetonHash = createHmac('sha256', this.config.getOrThrow<string>('AUTH_RESET_PEPPER'))
      .update(jeton)
      .digest('hex');

    const reinitialisation = await this.jetons.trouverParJetonHash(jetonHash);

    if (
      !reinitialisation ||
      reinitialisation.utiliseLe !== null ||
      reinitialisation.expireLe <= new Date()
    ) {
      throw new DomainError('jeton_invalide', 'Ce lien est invalide ou expiré.', 401);
    }

    const utilisateur = await this.utilisateurs.trouverParId(reinitialisation.utilisateurId);

    if (
      !utilisateur ||
      utilisateur.supprimeLe ||
      (utilisateur.statut !== 'actif' && utilisateur.statut !== 'restreint')
    ) {
      throw new DomainError('jeton_invalide', 'Ce lien est invalide ou expiré.', 401);
    }

    const email = Email.creer(utilisateur.email);
    const pseudo = Pseudo.creer(utilisateur.pseudo);
    const motDePasse = MotDePasse.creer(nouveauMotDePasse, { email, pseudo });
    await this.politique.valider(motDePasse);

    const hash = await this.hacheur.hacher(motDePasse);
    const nouvelleVersion = utilisateur.versionSecurite + 1;
    const maintenant = new Date();

    await this.utilisateurs.mettreAJour(utilisateur.id, {
      motDePasseHash: hash,
      versionSecurite: nouvelleVersion,
    });
    await this.appareils.revoquerTous(utilisateur.id, maintenant);
    await this.jetons.marquerUtilise(reinitialisation.id, maintenant);
    await this.jetons.invaliderPourUtilisateur(utilisateur.id, maintenant);

    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enregistrer(tx, {
        type: 'compte.mot_de_passe_modifie',
        agregatType: 'utilisateur',
        agregatId: utilisateur.id,
        payload: {
          utilisateurId: utilisateur.id,
          modifieLe: maintenant.toISOString(),
          sessionsRevoquees: true,
          viaReinitialisation: true,
        },
      });
    });
  }
}
