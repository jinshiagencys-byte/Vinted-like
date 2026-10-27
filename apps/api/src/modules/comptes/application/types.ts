import type { Utilisateur } from '../domain/entities';

export interface UtilisateurSession {
  id: string;
  email: string;
  pseudo: string;
  role: string;
  emailVerifie: boolean;
  telephoneVerifie: boolean;
  kycLegerComplet: boolean;
  versionSecurite: number;
}

export interface SessionEmise {
  accessToken: string;
  refreshToken: string;
  expireDans: number;
  utilisateur: UtilisateurSession;
}

export interface AppareilDemande {
  deviceId: string;
  plateforme: 'ios' | 'android' | 'web';
  pushToken?: string | null;
}

export function resumerUtilisateur(utilisateur: Utilisateur): UtilisateurSession {
  return {
    id: utilisateur.id,
    email: utilisateur.email,
    pseudo: utilisateur.pseudo,
    role: utilisateur.role,
    emailVerifie: utilisateur.emailVerifieLe !== null,
    telephoneVerifie: utilisateur.telephoneVerifieLe !== null,
    kycLegerComplet:
      utilisateur.nomComplet !== null &&
      utilisateur.dateNaissance !== null &&
      utilisateur.telephone !== null &&
      utilisateur.telephoneVerifieLe !== null,
    versionSecurite: utilisateur.versionSecurite,
  };
}
