import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../common/errors/domain-error';
import { kycLegerComplet } from '../../domain/entities';
import type { ProfilRepository, UtilisateurRepository } from '../../domain/ports';
import { PROFIL_REPOSITORY, UTILISATEUR_REPOSITORY } from '../../domain/ports';

export interface MoiResultat {
  utilisateur: {
    id: string;
    email: string;
    telephone: string | null;
    pseudo: string;
    nomComplet: string | null;
    dateNaissance: string | null;
    pays: string;
    statut: string;
    role: string;
    emailVerifie: boolean;
    telephoneVerifie: boolean;
    kycLegerComplet: boolean;
    noteMoyenne: number;
    nbVentes: number;
    nbAchats: number;
    version: number;
    versionSecurite: number;
    derniereConnexionLe: string | null;
    creeLe: string;
  };
  profil: {
    avatarUrl: string | null;
    bio: string | null;
    tailleCm: number | null;
    pointure: number | null;
    stylesPreferes: string[];
    visibilite: string;
    langue: string;
  };
  sanctions: [];
}

@Injectable()
export class ConsulterMoi {
  constructor(
    @Inject(UTILISATEUR_REPOSITORY) private readonly utilisateurs: UtilisateurRepository,
    @Inject(PROFIL_REPOSITORY) private readonly profils: ProfilRepository,
  ) {}

  async executer(utilisateurId: string): Promise<MoiResultat> {
    const utilisateur = await this.utilisateurs.trouverParId(utilisateurId);

    if (!utilisateur || utilisateur.supprimeLe) {
      throw new DomainError('ressource_introuvable', 'Compte introuvable.', 404);
    }

    const profil = await this.profils.trouverParUtilisateurId(utilisateurId);

    if (!profil) {
      throw new DomainError('ressource_introuvable', 'Profil introuvable.', 404);
    }

    return {
      utilisateur: {
        id: utilisateur.id,
        email: utilisateur.email,
        telephone: utilisateur.telephone,
        pseudo: utilisateur.pseudo,
        nomComplet: utilisateur.nomComplet,
        dateNaissance: utilisateur.dateNaissance
          ? utilisateur.dateNaissance.toISOString().slice(0, 10)
          : null,
        pays: utilisateur.pays,
        statut: utilisateur.statut,
        role: utilisateur.role,
        emailVerifie: utilisateur.emailVerifieLe !== null,
        telephoneVerifie: utilisateur.telephoneVerifieLe !== null,
        kycLegerComplet: kycLegerComplet(utilisateur),
        noteMoyenne: utilisateur.noteMoyenne,
        nbVentes: utilisateur.nbVentes,
        nbAchats: utilisateur.nbAchats,
        version: utilisateur.version,
        versionSecurite: utilisateur.versionSecurite,
        derniereConnexionLe: utilisateur.derniereConnexionLe?.toISOString() ?? null,
        creeLe: utilisateur.creeLe.toISOString(),
      },
      profil: {
        avatarUrl: profil.avatarUrl,
        bio: profil.bio,
        tailleCm: profil.tailleCm,
        pointure: profil.pointure,
        stylesPreferes: profil.stylesPreferes,
        visibilite: profil.visibilite,
        langue: profil.langue,
      },
      sanctions: [],
    };
  }
}
