export const STATUTS_COMPTE = ['actif', 'restreint', 'suspendu', 'supprime'] as const;
export type StatutCompte = (typeof STATUTS_COMPTE)[number];

export const ROLES_COMPTE = ['membre', 'moderateur', 'admin'] as const;
export type RoleCompte = (typeof ROLES_COMPTE)[number];

export const TYPES_VERIFICATION = ['email', 'telephone', 'identite'] as const;
export type TypeVerification = (typeof TYPES_VERIFICATION)[number];

export const STATUTS_VERIFICATION = ['en_attente', 'valide', 'refuse', 'expire'] as const;
export type StatutVerification = (typeof STATUTS_VERIFICATION)[number];

export const PLATEFORMES = ['ios', 'android', 'web'] as const;
export type Plateforme = (typeof PLATEFORMES)[number];

export const VISIBILITES_PROFIL = ['public', 'membres'] as const;
export type VisibiliteProfil = (typeof VISIBILITES_PROFIL)[number];

export const STATUTS_EXPORT = ['en_attente', 'pret', 'echoue', 'expire'] as const;
export type StatutExport = (typeof STATUTS_EXPORT)[number];
