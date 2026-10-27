import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '../../../../common/errors/domain-error';
import { PolitiqueVerification } from '../../domain/policies/politique-verification';
import type {
  NotificationPort,
  ProfilRepository,
  UtilisateurRepository,
  VerificationRepository,
} from '../../domain/ports';
import {
  NOTIFICATION_PORT,
  PROFIL_REPOSITORY,
  UTILISATEUR_REPOSITORY,
  VERIFICATION_REPOSITORY,
} from '../../domain/ports';
import { DateNaissance } from '../../domain/value-objects/date-naissance';
import { Pseudo } from '../../domain/value-objects/pseudo';
import { Telephone } from '../../domain/value-objects/telephone';
import { CodeVerification } from '../../domain/value-objects/code-verification';
import { ConsulterMoi, type MoiResultat } from './consulter-moi';
import type { MiseAJourProfil } from '../../domain/ports';

export interface ProfilModifie {
  avatarUrl?: string | null;
  bio?: string | null;
  tailleCm?: number | null;
  pointure?: number | null;
  stylesPreferes?: string[];
  visibilite?: 'public' | 'membres';
  langue?: string;
}

export interface MettreAJourProfilCommande {
  version: number;
  pseudo?: string;
  nomComplet?: string | null;
  telephone?: string | null;
  dateNaissance?: string;
  profil?: ProfilModifie;
}

@Injectable()
export class MettreAJourProfil {
  constructor(
    @Inject(UTILISATEUR_REPOSITORY) private readonly utilisateurs: UtilisateurRepository,
    @Inject(PROFIL_REPOSITORY) private readonly profils: ProfilRepository,
    @Inject(VERIFICATION_REPOSITORY) private readonly verifications: VerificationRepository,
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
    private readonly consulterMoi: ConsulterMoi,
    private readonly politique: PolitiqueVerification,
    private readonly config: ConfigService,
  ) {}

  async executer(utilisateurId: string, commande: MettreAJourProfilCommande): Promise<MoiResultat> {
    const utilisateur = await this.utilisateurs.trouverParId(utilisateurId);

    if (!utilisateur || utilisateur.supprimeLe) {
      throw new DomainError('ressource_introuvable', 'Compte introuvable.', 404);
    }

    const donnees: Record<string, unknown> = {};
    let telephoneModifie: string | null | undefined;

    if (commande.pseudo !== undefined) {
      const pseudo = Pseudo.creer(commande.pseudo);
      const existant = await this.utilisateurs.trouverParPseudoNormalise(pseudo.normalise);

      if (existant && existant.id !== utilisateurId) {
        throw new DomainError('pseudo_deja_utilise', 'Ce pseudo est déjà utilisé.', 409);
      }

      donnees.pseudo = pseudo.valeur;
      donnees.pseudoNormalise = pseudo.normalise;
    }

    if (commande.nomComplet !== undefined) {
      const nom = commande.nomComplet?.trim() ?? null;

      if (nom !== null && (nom.length < 1 || nom.length > 120)) {
        throw new DomainError(
          'nom_complet_invalide',
          'Le nom complet doit contenir entre 1 et 120 caractères.',
          422,
        );
      }

      donnees.nomComplet = nom;
    }

    if (commande.telephone !== undefined) {
      if (commande.telephone === null || commande.telephone.trim() === '') {
        telephoneModifie = null;
      } else {
        const telephone = Telephone.creer(commande.telephone, utilisateur.pays);

        if (telephone.valeur !== utilisateur.telephone) {
          const existant = await this.utilisateurs.trouverParTelephone(telephone.valeur);

          if (existant && existant.id !== utilisateurId) {
            throw new DomainError(
              'telephone_deja_utilise',
              'Ce numéro de téléphone est déjà utilisé.',
              409,
            );
          }

          telephoneModifie = telephone.valeur;
        }
      }

      if (telephoneModifie !== undefined) {
        donnees.telephone = telephoneModifie;
        donnees.telephoneVerifieLe = null;
      }
    }

    if (commande.dateNaissance !== undefined) {
      donnees.dateNaissance = DateNaissance.creer(commande.dateNaissance).valeur;
    }

    await this.utilisateurs.mettreAJourVersionne(utilisateurId, commande.version, donnees);

    if (commande.profil) {
      await this.profils.mettreAJour(
        utilisateurId,
        this.validerProfil(commande.profil) as MiseAJourProfil,
      );
    }

    if (telephoneModifie) {
      await this.creerVerificationTelephone(utilisateurId, telephoneModifie);
    }

    return this.consulterMoi.executer(utilisateurId);
  }

  private validerProfil(profil: ProfilModifie): ProfilModifie {
    if (profil.bio !== undefined && profil.bio !== null && profil.bio.length > 300) {
      throw new DomainError('bio_invalide', 'La bio ne peut pas dépasser 300 caractères.', 422);
    }

    if (
      profil.tailleCm !== undefined &&
      profil.tailleCm !== null &&
      (!Number.isInteger(profil.tailleCm) || profil.tailleCm < 120 || profil.tailleCm > 230)
    ) {
      throw new DomainError(
        'taille_invalide',
        'La taille doit être comprise entre 120 et 230 cm.',
        422,
      );
    }

    if (
      profil.pointure !== undefined &&
      profil.pointure !== null &&
      (!Number.isInteger(profil.pointure) || profil.pointure < 15 || profil.pointure > 50)
    ) {
      throw new DomainError(
        'pointure_invalide',
        'La pointure doit être comprise entre 15 et 50.',
        422,
      );
    }

    if (profil.stylesPreferes !== undefined) {
      if (profil.stylesPreferes.length > 5) {
        throw new DomainError(
          'styles_invalides',
          'Vous pouvez sélectionner au plus 5 styles.',
          422,
        );
      }

      profil.stylesPreferes = profil.stylesPreferes.map((style) => style.trim()).filter(Boolean);
    }

    if (profil.langue !== undefined && !/^[a-z]{2}$/.test(profil.langue)) {
      throw new DomainError('langue_invalide', 'La langue doit être un code à deux lettres.', 422);
    }

    return profil;
  }

  private async creerVerificationTelephone(
    utilisateurId: string,
    telephone: string,
  ): Promise<void> {
    await this.verifications.invaliderEnAttente(utilisateurId, 'telephone', 'expire');
    const code = CodeVerification.generer();
    await this.verifications.creer({
      utilisateurId,
      type: 'telephone',
      codeHash: code.hacher(
        this.config.getOrThrow<string>('AUTH_CODE_PEPPER'),
        `${utilisateurId}:telephone`,
      ),
      expireLe: this.politique.expirationDepuis(),
    });

    await this.notifications.envoyer({
      canal: 'sms',
      destinataire: telephone,
      modele: 'verification_telephone',
      variables: { code: code.reveler() },
      utilisateurId,
    });
  }
}
