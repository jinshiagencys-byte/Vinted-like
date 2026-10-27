import {
  ClientApi,
  ErreurApi,
  type Moi,
  type Session,
  type UtilisateurSession,
} from '@secondevie/contracts';
import { CLES, ecrireSecret, lireSecret, supprimerSecret } from './stockage';

const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

let jetonAcces: string | null = null;
let jetonRefresh: string | null = null;
let utilisateur: UtilisateurSession | null = null;
let rafraichissement: Promise<string | null> | null = null;
const abonnes = new Set<(valeur: UtilisateurSession | null) => void>();

function notifier(): void {
  for (const abonne of abonnes) abonne(utilisateur);
}

function versSession(moi: Moi): UtilisateurSession {
  return {
    id: moi.utilisateur.id,
    email: moi.utilisateur.email,
    pseudo: moi.utilisateur.pseudo,
    role: moi.utilisateur.role,
    emailVerifie: moi.utilisateur.emailVerifie,
    telephoneVerifie: moi.utilisateur.telephoneVerifie,
    kycLegerComplet: moi.utilisateur.kycLegerComplet,
    versionSecurite: moi.utilisateur.versionSecurite,
  };
}

async function rafraichir(): Promise<string | null> {
  if (!jetonRefresh) return null;

  if (!rafraichissement) {
    rafraichissement = api
      .refresh(jetonRefresh)
      .then(async (session) => {
        await memoriser(session);
        return session.accessToken;
      })
      .catch(async () => {
        await oublier();
        return null;
      })
      .finally(() => {
        rafraichissement = null;
      });
  }

  return rafraichissement;
}

export const api = new ClientApi({
  baseUrl,
  getAccessToken: () => jetonAcces,
  onNonAutorise: rafraichir,
});

async function memoriser(session: Session): Promise<void> {
  jetonAcces = session.accessToken;
  jetonRefresh = session.refreshToken;
  utilisateur = session.utilisateur;

  await Promise.all([
    ecrireSecret(CLES.acces, session.accessToken),
    ecrireSecret(CLES.refresh, session.refreshToken),
  ]);
  notifier();
}

async function oublier(): Promise<void> {
  jetonAcces = null;
  jetonRefresh = null;
  utilisateur = null;

  await Promise.all([supprimerSecret(CLES.acces), supprimerSecret(CLES.refresh)]);
  notifier();
}

/** Ouvre une session après inscription, vérification, connexion ou refresh. */
export async function ouvrirSession(session: Session): Promise<void> {
  await memoriser(session);
}

/** Restaure une session au démarrage en revalidant le jeton côté serveur. */
export async function restaurerSession(): Promise<Moi | null> {
  jetonAcces = await lireSecret(CLES.acces);
  jetonRefresh = await lireSecret(CLES.refresh);

  if (!jetonAcces && !jetonRefresh) {
    return null;
  }

  try {
    const moi = await api.consulterMoi();
    utilisateur = versSession(moi);
    notifier();
    return moi;
  } catch {
    await oublier();
    return null;
  }
}

/** Déconnexion locale et distante ; les erreurs réseau ne bloquent pas. */
export async function fermerSession(): Promise<void> {
  if (jetonAcces) {
    try {
      await api.deconnexion();
    } catch {
      // La session est effacée localement même si le serveur est injoignable.
    }
  }

  await oublier();
}

export function utilisateurCourant(): UtilisateurSession | null {
  return utilisateur;
}

export function abonnerSession(abonne: (valeur: UtilisateurSession | null) => void): () => void {
  abonnes.add(abonne);
  return () => abonnes.delete(abonne);
}

export function estErreurNonAutorisee(error: unknown): boolean {
  return error instanceof ErreurApi && error.status === 401;
}
