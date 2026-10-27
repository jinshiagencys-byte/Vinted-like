import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../common/errors/domain-error';
import { LimiteDebitException } from '../../../../common/errors/limite-debit.exception';
import type { AppareilDemande, SessionEmise } from '../types';
import type { HacheurMotDePasse, UtilisateurRepository } from '../../domain/ports';
import { HACHEUR_MOT_DE_PASSE, UTILISATEUR_REPOSITORY } from '../../domain/ports';
import { Email } from '../../domain/value-objects/email';
import { MotDePasse } from '../../domain/value-objects/mot-de-passe';
import { ServiceSessions } from '../services/service-sessions';
import { LimiteurDebitService } from '../../infrastructure/securite/limiteur-debit.service';

const HASH_FACTICE =
  '$argon2id$v=19$m=65536,p=1,t=3$XkkdeQx41VgliHzHsxEOgA$6ln1vuIqdiFSOOFZEEUm96qGUnPfSMx0WMhGR2teVPI';

export interface ConnecterCommande {
  email: string;
  motDePasse: string;
  appareil: AppareilDemande;
  ip: string;
}

@Injectable()
export class Connecter {
  constructor(
    @Inject(UTILISATEUR_REPOSITORY) private readonly utilisateurs: UtilisateurRepository,
    @Inject(HACHEUR_MOT_DE_PASSE) private readonly hacheur: HacheurMotDePasse,
    private readonly sessions: ServiceSessions,
    private readonly limiteur: LimiteurDebitService,
  ) {}

  async executer(commande: ConnecterCommande): Promise<SessionEmise> {
    await this.limiteur.consommer(
      `connexion-ip:${LimiteurDebitService.empreinte(commande.ip)}`,
      10,
      60,
    );

    const email = Email.creer(commande.email);
    const cleCompte = LimiteurDebitService.empreinte(email.valeur);
    const blocage = await this.limiteur.dureeBlocage(cleCompte);

    if (blocage > 0) {
      throw new LimiteDebitException(
        blocage,
        'compte_bloque',
        'Trop de tentatives. Réessayez plus tard.',
      );
    }

    const motDePasse = MotDePasse.creer(commande.motDePasse);
    const utilisateur = await this.utilisateurs.trouverParEmail(email.valeur);

    const valide = await this.hacheur.verifier(
      utilisateur?.motDePasseHash ?? HASH_FACTICE,
      motDePasse,
    );

    if (!utilisateur || !utilisateur.motDePasseHash || !valide) {
      await this.enregistrerEchec(cleCompte);
      throw new DomainError('identifiants_invalides', 'E-mail ou mot de passe incorrect.', 401);
    }

    if (utilisateur.statut === 'suspendu') {
      throw new DomainError('autorisation_refusee', 'Ce compte est suspendu.', 403, {
        raison: 'compte_suspendu',
      });
    }

    if (utilisateur.statut === 'supprime' || utilisateur.supprimeLe) {
      throw new DomainError('autorisation_refusee', 'Ce compte n’est plus actif.', 403, {
        raison: 'compte_supprime',
      });
    }

    await this.limiteur.reinitialiser(`connexion-echecs:${cleCompte}`);
    await this.limiteur.debloquer(cleCompte);

    const utilisateurAJour = await this.utilisateurs.mettreAJour(utilisateur.id, {
      derniereConnexionLe: new Date(),
    });

    return this.sessions.ouvrir(utilisateurAJour, commande.appareil);
  }

  private async enregistrerEchec(cleCompte: string): Promise<void> {
    const { valeur } = await this.limiteur.incrementer(
      `connexion-echecs:${cleCompte}`,
      24 * 60 * 60,
    );

    if (valeur === 5) {
      await this.limiteur.bloquer(cleCompte, 15 * 60);
    } else if (valeur === 10) {
      await this.limiteur.bloquer(cleCompte, 60 * 60);
    }
  }
}
