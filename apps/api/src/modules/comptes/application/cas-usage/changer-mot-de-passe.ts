import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { DomainError } from '../../../../common/errors/domain-error';
import { OutboxService } from '../../../../common/outbox/outbox.service';
import { PolitiqueMotDePasse } from '../../domain/policies/politique-mot-de-passe';
import type {
  AppareilRepository,
  HacheurMotDePasse,
  UtilisateurRepository,
} from '../../domain/ports';
import {
  APPAREIL_REPOSITORY,
  HACHEUR_MOT_DE_PASSE,
  UTILISATEUR_REPOSITORY,
} from '../../domain/ports';
import { Email } from '../../domain/value-objects/email';
import { MotDePasse } from '../../domain/value-objects/mot-de-passe';
import { Pseudo } from '../../domain/value-objects/pseudo';

@Injectable()
export class ChangerMotDePasse {
  constructor(
    @Inject(UTILISATEUR_REPOSITORY) private readonly utilisateurs: UtilisateurRepository,
    @Inject(APPAREIL_REPOSITORY) private readonly appareils: AppareilRepository,
    @Inject(HACHEUR_MOT_DE_PASSE) private readonly hacheur: HacheurMotDePasse,
    private readonly politique: PolitiqueMotDePasse,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async executer(
    utilisateurId: string,
    motDePasseActuel: string,
    nouveauMotDePasse: string,
  ): Promise<void> {
    const utilisateur = await this.utilisateurs.trouverParId(utilisateurId);

    if (!utilisateur?.motDePasseHash) {
      throw new DomainError('authentification_requise', 'Authentification requise.', 401);
    }

    const actuel = MotDePasse.creer(motDePasseActuel);
    const valide = await this.hacheur.verifier(utilisateur.motDePasseHash, actuel);

    if (!valide) {
      throw new DomainError('mot_de_passe_incorrect', 'Le mot de passe actuel est incorrect.', 401);
    }

    const email = Email.creer(utilisateur.email);
    const pseudo = Pseudo.creer(utilisateur.pseudo);
    const nouveau = MotDePasse.creer(nouveauMotDePasse, { email, pseudo });
    await this.politique.valider(nouveau);

    const hash = await this.hacheur.hacher(nouveau);
    const maintenant = new Date();

    await this.utilisateurs.mettreAJour(utilisateur.id, {
      motDePasseHash: hash,
      versionSecurite: utilisateur.versionSecurite + 1,
    });
    await this.appareils.revoquerTous(utilisateur.id, maintenant);

    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enregistrer(tx, {
        type: 'compte.mot_de_passe_modifie',
        agregatType: 'utilisateur',
        agregatId: utilisateur.id,
        payload: {
          utilisateurId: utilisateur.id,
          modifieLe: maintenant.toISOString(),
          sessionsRevoquees: true,
        },
      });
    });
  }
}
