import type {
  Adresse as AdressePrisma,
  Appareil as AppareilPrisma,
  ExportRgpd as ExportPrisma,
  Profil as ProfilPrisma,
  ReinitialisationMotDePasse as ReinitialisationPrisma,
  Utilisateur as UtilisateurPrisma,
  Verification as VerificationPrisma,
} from '@prisma/client';
import type {
  Adresse,
  Appareil,
  ExportRgpd,
  Profil,
  ReinitialisationMotDePasse,
  Utilisateur,
  Verification,
} from '../../../domain/entities';

export function versUtilisateur(row: UtilisateurPrisma): Utilisateur {
  return {
    id: row.id,
    email: row.email,
    telephone: row.telephone,
    motDePasseHash: row.motDePasseHash,
    pseudo: row.pseudo,
    pseudoNormalise: row.pseudoNormalise,
    nomComplet: row.nomComplet,
    dateNaissance: row.dateNaissance,
    pays: row.pays,
    statut: row.statut,
    role: row.role,
    emailVerifieLe: row.emailVerifieLe,
    telephoneVerifieLe: row.telephoneVerifieLe,
    noteMoyenne: row.noteMoyenne.toNumber(),
    nbVentes: row.nbVentes,
    nbAchats: row.nbAchats,
    reputationVersion: row.reputationVersion,
    versionSecurite: row.versionSecurite,
    derniereConnexionLe: row.derniereConnexionLe,
    supprimeLe: row.supprimeLe,
    version: row.version,
    creeLe: row.creeLe,
    majLe: row.majLe,
  };
}

export function versProfil(row: ProfilPrisma): Profil {
  return {
    id: row.id,
    utilisateurId: row.utilisateurId,
    avatarUrl: row.avatarUrl,
    bio: row.bio,
    tailleCm: row.tailleCm,
    pointure: row.pointure,
    stylesPreferes: row.stylesPreferes,
    visibilite: row.visibilite,
    langue: row.langue,
    creeLe: row.creeLe,
    majLe: row.majLe,
  };
}

export function versAdresse(row: AdressePrisma): Adresse {
  return {
    id: row.id,
    utilisateurId: row.utilisateurId,
    libelle: row.libelle,
    destinataire: row.destinataire,
    ligne1: row.ligne1,
    ligne2: row.ligne2,
    codePostal: row.codePostal,
    ville: row.ville,
    pays: row.pays,
    telephone: row.telephone,
    estDefaut: row.estDefaut,
    supprimeeLe: row.supprimeeLe,
    creeLe: row.creeLe,
    majLe: row.majLe,
  };
}

export function versAppareil(row: AppareilPrisma): Appareil {
  return {
    id: row.id,
    utilisateurId: row.utilisateurId,
    plateforme: row.plateforme,
    deviceId: row.deviceId,
    refreshTokenHash: row.refreshTokenHash,
    refreshTokenPrecedentHash: row.refreshTokenPrecedentHash,
    refreshTokenRotatedLe: row.refreshTokenRotatedLe,
    refreshTokenExpireLe: row.refreshTokenExpireLe,
    pushToken: row.pushToken,
    derniereActiviteLe: row.derniereActiviteLe,
    revoqueLe: row.revoqueLe,
    creeLe: row.creeLe,
  };
}

export function versVerification(row: VerificationPrisma): Verification {
  return {
    id: row.id,
    utilisateurId: row.utilisateurId,
    type: row.type,
    statut: row.statut,
    fournisseurRef: row.fournisseurRef,
    codeHash: row.codeHash,
    tentatives: row.tentatives,
    expireLe: row.expireLe,
    valideLe: row.valideLe,
    creeLe: row.creeLe,
  };
}

export function versReinitialisation(row: ReinitialisationPrisma): ReinitialisationMotDePasse {
  return {
    id: row.id,
    utilisateurId: row.utilisateurId,
    jetonHash: row.jetonHash,
    expireLe: row.expireLe,
    utiliseLe: row.utiliseLe,
    creeLe: row.creeLe,
  };
}

export function versExport(row: ExportPrisma): ExportRgpd {
  return {
    id: row.id,
    utilisateurId: row.utilisateurId,
    statut: row.statut,
    urlSignee: row.urlSignee,
    expireLe: row.expireLe,
    creeLe: row.creeLe,
    termineLe: row.termineLe,
  };
}
