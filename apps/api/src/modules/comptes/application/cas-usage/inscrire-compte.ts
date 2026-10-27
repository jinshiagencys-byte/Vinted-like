import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '../../../../common/errors/domain-error';
import type { Utilisateur } from '../../domain/entities';
import { PolitiqueMotDePasse } from '../../domain/policies/politique-mot-de-passe';
import { PolitiqueVerification } from '../../domain/policies/politique-verification';
import type {
  HacheurMotDePasse,
  InscriptionAtomique,
  NotificationPort,
  UtilisateurRepository,
} from '../../domain/ports';
import {
  HACHEUR_MOT_DE_PASSE,
  INSCRIPTION_REPOSITORY,
  NOTIFICATION_PORT,
  UTILISATEUR_REPOSITORY,
} from '../../domain/ports';
import { CodeVerification } from '../../domain/value-objects/code-verification';
import { DateNaissance } from '../../domain/value-objects/date-naissance';
import { Email } from '../../domain/value-objects/email';
import { MotDePasse } from '../../domain/value-objects/mot-de-passe';
import { Pseudo } from '../../domain/value-objects/pseudo';
import { Telephone } from '../../domain/value-objects/telephone';
import { LimiteurDebitService } from '../../infrastructure/securite/limiteur-debit.service';

export interface InscrireCompteCommande {
  email: string;
  telephone?: string | null;
  pseudo: string;
  motDePasse: string;
  dateNaissance: string;
  pays?: string;
  ip: string;
}

export interface InscrireCompteResultat {
  utilisateurId: string;
  email: string;
  emailVerifie: false;
  verificationEnvoyeeLe: string;
  expireLe: string;
}

@Injectable()
export class InscrireCompte {
  constructor(
    @Inject(UTILISATEUR_REPOSITORY) private readonly utilisateurs: UtilisateurRepository,
    @Inject(INSCRIPTION_REPOSITORY) private readonly inscription: InscriptionAtomique,
    @Inject(HACHEUR_MOT_DE_PASSE) private readonly hacheur: HacheurMotDePasse,
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
    private readonly politiqueMotDePasse: PolitiqueMotDePasse,
    private readonly politiqueVerification: PolitiqueVerification,
    private readonly limiteur: LimiteurDebitService,
    private readonly config: ConfigService,
  ) {}

  async executer(commande: InscrireCompteCommande): Promise<InscrireCompteResultat> {
    await this.limiteur.consommer(
      `inscription:${LimiteurDebitService.empreinte(commande.ip)}`,
      5,
      3_600,
    );

    const email = Email.creer(commande.email);
    const pseudo = Pseudo.creer(commande.pseudo);
    const motDePasse = MotDePasse.creer(commande.motDePasse, { email, pseudo });
    const dateNaissance = DateNaissance.creer(commande.dateNaissance);
    const pays = (commande.pays ?? 'FR').trim().toUpperCase();
    const telephone =
      commande.telephone === undefined || commande.telephone === null || commande.telephone === ''
        ? null
        : Telephone.creer(commande.telephone, pays).valeur;

    if (!/^[A-Z]{2}$/.test(pays)) {
      throw new DomainError('pays_invalide', 'Le pays doit être un code ISO à deux lettres.', 422);
    }

    await this.politiqueMotDePasse.valider(motDePasse);

    if (await this.utilisateurs.trouverParEmail(email.valeur)) {
      throw new DomainError('email_deja_utilise', 'Cette adresse e-mail est déjà utilisée.', 409);
    }

    if (await this.utilisateurs.trouverParPseudoNormalise(pseudo.normalise)) {
      throw new DomainError('pseudo_deja_utilise', 'Ce pseudo est déjà utilisé.', 409);
    }

    if (telephone && (await this.utilisateurs.trouverParTelephone(telephone))) {
      throw new DomainError(
        'telephone_deja_utilise',
        'Ce numéro de téléphone est déjà utilisé.',
        409,
      );
    }

    const hash = await this.hacheur.hacher(motDePasse);
    const code = CodeVerification.generer();
    const expireLe = this.politiqueVerification.expirationDepuis();
    const contexte = `${email.valeur}:email`;

    let resultat: { utilisateur: Utilisateur; verificationId: string };

    try {
      resultat = await this.inscription.creer(
        {
          email: email.valeur,
          telephone,
          pseudo: pseudo.valeur,
          pseudoNormalise: pseudo.normalise,
          motDePasseHash: hash,
          dateNaissance: dateNaissance.valeur,
          pays,
        },
        {
          codeHash: code.hacher(this.config.getOrThrow<string>('AUTH_CODE_PEPPER'), contexte),
          expireLe,
        },
      );
    } catch (error: unknown) {
      if (estViolationUnicite(error, 'email')) {
        throw new DomainError('email_deja_utilise', 'Cette adresse e-mail est déjà utilisée.', 409);
      }
      if (estViolationUnicite(error, 'pseudo')) {
        throw new DomainError('pseudo_deja_utilise', 'Ce pseudo est déjà utilisé.', 409);
      }
      if (estViolationUnicite(error, 'telephone')) {
        throw new DomainError(
          'telephone_deja_utilise',
          'Ce numéro de téléphone est déjà utilisé.',
          409,
        );
      }
      if (estViolationUnicite(error)) {
        throw new DomainError('compte_deja_existant', 'Ce compte existe déjà.', 409);
      }
      throw error;
    }

    await this.notifications.envoyer({
      canal: 'email',
      destinataire: email.valeur,
      modele: 'verification_email',
      variables: { code: code.reveler() },
      utilisateurId: resultat.utilisateur.id,
    });

    return {
      utilisateurId: resultat.utilisateur.id,
      email: resultat.utilisateur.email,
      emailVerifie: false,
      verificationEnvoyeeLe: new Date().toISOString(),
      expireLe: expireLe.toISOString(),
    };
  }
}

function estViolationUnicite(error: unknown, champ?: 'email' | 'pseudo' | 'telephone'): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  if (code !== 'P2002') return false;
  if (!champ) return true;
  const cible = (error as { meta?: { target?: unknown } }).meta?.target;
  const texte = Array.isArray(cible) ? cible.join(',') : String(cible ?? '');
  const nomChamp = champ === 'email' ? 'email' : champ === 'pseudo' ? 'pseudo' : 'telephone';
  return texte.includes(nomChamp);
}
