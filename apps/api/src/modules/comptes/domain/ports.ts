import type {
  Adresse,
  Appareil,
  Profil,
  ReinitialisationMotDePasse,
  Utilisateur,
  Verification,
} from './entities';
import type {
  Plateforme,
  RoleCompte,
  StatutCompte,
  StatutVerification,
  TypeVerification,
  VisibiliteProfil,
} from './enums';
import type { MotDePasse } from './value-objects/mot-de-passe';

export const UTILISATEUR_REPOSITORY = Symbol('UTILISATEUR_REPOSITORY');
export const PROFIL_REPOSITORY = Symbol('PROFIL_REPOSITORY');
export const ADRESSE_REPOSITORY = Symbol('ADRESSE_REPOSITORY');
export const APPAREIL_REPOSITORY = Symbol('APPAREIL_REPOSITORY');
export const VERIFICATION_REPOSITORY = Symbol('VERIFICATION_REPOSITORY');
export const REINITIALISATION_REPOSITORY = Symbol('REINITIALISATION_REPOSITORY');
export const HACHEUR_MOT_DE_PASSE = Symbol('HACHEUR_MOT_DE_PASSE');
export const VERIFICATEUR_MOT_DE_PASSE_COMPROMIS = Symbol('VERIFICATEUR_MOT_DE_PASSE_COMPROMIS');

export interface CreerUtilisateur {
  email: string;
  telephone?: string | null;
  motDePasseHash: string;
  pseudo: string;
  pseudoNormalise: string;
  nomComplet?: string | null;
  dateNaissance: Date;
  pays?: string;
  role?: RoleCompte;
}

export interface MiseAJourUtilisateur {
  telephone?: string | null;
  motDePasseHash?: string | null;
  nomComplet?: string | null;
  dateNaissance?: Date | null;
  emailVerifieLe?: Date | null;
  telephoneVerifieLe?: Date | null;
  statut?: StatutCompte;
  versionSecurite?: number;
  derniereConnexionLe?: Date | null;
}

export interface UtilisateurRepository {
  creer(donnees: CreerUtilisateur): Promise<Utilisateur>;
  trouverParId(id: string): Promise<Utilisateur | null>;
  trouverParEmail(email: string): Promise<Utilisateur | null>;
  trouverParPseudoNormalise(pseudoNormalise: string): Promise<Utilisateur | null>;
  mettreAJour(id: string, donnees: MiseAJourUtilisateur): Promise<Utilisateur>;
}

export interface CreerProfil {
  utilisateurId: string;
  avatarUrl?: string | null;
  bio?: string | null;
  tailleCm?: number | null;
  pointure?: number | null;
  stylesPreferes?: string[];
  visibilite?: VisibiliteProfil;
  langue?: string;
}

export interface MiseAJourProfil {
  avatarUrl?: string | null;
  bio?: string | null;
  tailleCm?: number | null;
  pointure?: number | null;
  stylesPreferes?: string[];
  visibilite?: VisibiliteProfil;
  langue?: string;
}

export interface ProfilRepository {
  creer(donnees: CreerProfil): Promise<Profil>;
  trouverParUtilisateurId(utilisateurId: string): Promise<Profil | null>;
  mettreAJour(utilisateurId: string, donnees: MiseAJourProfil): Promise<Profil>;
}

export interface CreerAdresse {
  utilisateurId: string;
  libelle: string;
  destinataire: string;
  ligne1: string;
  ligne2?: string | null;
  codePostal: string;
  ville: string;
  pays?: string;
  telephone: string;
  estDefaut?: boolean;
}

export interface MiseAJourAdresse {
  libelle?: string;
  destinataire?: string;
  ligne1?: string;
  ligne2?: string | null;
  codePostal?: string;
  ville?: string;
  pays?: string;
  telephone?: string;
}

export interface AdresseRepository {
  creer(donnees: CreerAdresse): Promise<Adresse>;
  listerActives(utilisateurId: string): Promise<Adresse[]>;
  trouverActive(utilisateurId: string, id: string): Promise<Adresse | null>;
  mettreAJour(utilisateurId: string, id: string, donnees: MiseAJourAdresse): Promise<Adresse>;
  marquerSupprimee(utilisateurId: string, id: string, supprimeeLe: Date): Promise<void>;
  definirDefaut(utilisateurId: string, id: string): Promise<void>;
}

export interface CreerAppareil {
  utilisateurId: string;
  plateforme: Plateforme;
  deviceId: string;
  refreshTokenHash?: string | null;
  refreshTokenExpireLe?: Date | null;
  pushToken?: string | null;
}

export interface RotationRefresh {
  refreshTokenHash: string;
  refreshTokenPrecedentHash: string;
  refreshTokenRotatedLe: Date;
  refreshTokenExpireLe: Date;
}

export interface AppareilRepository {
  creer(donnees: CreerAppareil): Promise<Appareil>;
  listerActifs(utilisateurId: string): Promise<Appareil[]>;
  trouverParId(utilisateurId: string, id: string): Promise<Appareil | null>;
  trouverParHash(refreshTokenHash: string): Promise<Appareil | null>;
  enregistrerRotation(id: string, rotation: RotationRefresh): Promise<void>;
  revoquer(id: string, revoqueLe: Date): Promise<void>;
  mettreAJourPushToken(utilisateurId: string, deviceId: string, pushToken: string): Promise<void>;
}

export interface CreerVerification {
  utilisateurId: string;
  type: TypeVerification;
  codeHash: string;
  expireLe: Date;
  fournisseurRef?: string | null;
}

export interface VerificationRepository {
  creer(donnees: CreerVerification): Promise<Verification>;
  trouverEnAttente(utilisateurId: string, type: TypeVerification): Promise<Verification | null>;
  incrementerTentatives(id: string): Promise<Verification>;
  marquerStatut(id: string, statut: StatutVerification, date?: Date | null): Promise<Verification>;
}

export interface CreerReinitialisation {
  utilisateurId: string;
  jetonHash: string;
  expireLe: Date;
}

export interface ReinitialisationRepository {
  creer(donnees: CreerReinitialisation): Promise<ReinitialisationMotDePasse>;
  trouverParJetonHash(jetonHash: string): Promise<ReinitialisationMotDePasse | null>;
  marquerUtilise(id: string, utiliseLe: Date): Promise<void>;
}

export interface HacheurMotDePasse {
  hacher(motDePasse: MotDePasse): Promise<string>;
  verifier(hash: string, motDePasse: MotDePasse): Promise<boolean>;
}

export interface VerificateurMotDePasseCompromis {
  estCompromis(motDePasse: MotDePasse): Promise<boolean>;
}
