import type {
  Plateforme,
  RoleCompte,
  StatutCompte,
  StatutExport,
  StatutVerification,
  TypeVerification,
  VisibiliteProfil,
} from './enums';

export interface Utilisateur {
  id: string;
  email: string;
  telephone: string | null;
  motDePasseHash: string | null;
  pseudo: string;
  pseudoNormalise: string;
  nomComplet: string | null;
  dateNaissance: Date | null;
  pays: string;
  statut: StatutCompte;
  role: RoleCompte;
  emailVerifieLe: Date | null;
  telephoneVerifieLe: Date | null;
  noteMoyenne: number;
  nbVentes: number;
  nbAchats: number;
  reputationVersion: number;
  versionSecurite: number;
  derniereConnexionLe: Date | null;
  supprimeLe: Date | null;
  version: number;
  creeLe: Date;
  majLe: Date;
}

export interface Profil {
  id: string;
  utilisateurId: string;
  avatarUrl: string | null;
  bio: string | null;
  tailleCm: number | null;
  pointure: number | null;
  stylesPreferes: string[];
  visibilite: VisibiliteProfil;
  langue: string;
  creeLe: Date;
  majLe: Date;
}

export interface Adresse {
  id: string;
  utilisateurId: string;
  libelle: string;
  destinataire: string;
  ligne1: string;
  ligne2: string | null;
  codePostal: string;
  ville: string;
  pays: string;
  telephone: string;
  estDefaut: boolean;
  supprimeeLe: Date | null;
  creeLe: Date;
  majLe: Date;
}

export interface Appareil {
  id: string;
  utilisateurId: string;
  plateforme: Plateforme;
  deviceId: string;
  refreshTokenHash: string | null;
  refreshTokenPrecedentHash: string | null;
  refreshTokenRotatedLe: Date | null;
  refreshTokenExpireLe: Date | null;
  pushToken: string | null;
  derniereActiviteLe: Date | null;
  revoqueLe: Date | null;
  creeLe: Date;
}

export interface Verification {
  id: string;
  utilisateurId: string;
  type: TypeVerification;
  statut: StatutVerification;
  fournisseurRef: string | null;
  codeHash: string | null;
  tentatives: number;
  expireLe: Date;
  valideLe: Date | null;
  creeLe: Date;
}

export interface ReinitialisationMotDePasse {
  id: string;
  utilisateurId: string;
  jetonHash: string;
  expireLe: Date;
  utiliseLe: Date | null;
  creeLe: Date;
}

export interface ExportRgpd {
  id: string;
  utilisateurId: string;
  statut: StatutExport;
  urlSignee: string | null;
  expireLe: Date | null;
  creeLe: Date;
  termineLe: Date | null;
}

export function emailVerifie(utilisateur: Utilisateur): boolean {
  return utilisateur.emailVerifieLe !== null;
}

export function kycLegerComplet(utilisateur: Utilisateur): boolean {
  return (
    utilisateur.nomComplet !== null &&
    utilisateur.dateNaissance !== null &&
    utilisateur.telephone !== null &&
    utilisateur.telephoneVerifieLe !== null
  );
}
