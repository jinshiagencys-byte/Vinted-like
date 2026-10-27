/* eslint-disable @typescript-eslint/no-namespace */
import type { Role } from './role';

export interface UtilisateurAuthentifie {
  id: string;
  role: Role;
  emailVerifie: boolean;
  versionSecurite: number;
  appareilId?: string;
}

declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      utilisateur?: UtilisateurAuthentifie;
    }
  }
}

export {};
