export type Plateforme = 'ios' | 'android' | 'web';
export type Role = 'membre' | 'moderateur' | 'admin' | 'systeme';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId?: string;
}

export class ErreurApi extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly traceId?: string,
  ) {
    super(message);
    this.name = 'ErreurApi';
  }

  estNonAutorise(): boolean {
    return this.status === 401;
  }

  estHorsLigne(): boolean {
    return this.status === 0;
  }
}

function estErreurApiBody(valeur: unknown): valeur is ApiErrorBody {
  return (
    typeof valeur === 'object' &&
    valeur !== null &&
    typeof (valeur as ApiErrorBody).code === 'string' &&
    typeof (valeur as ApiErrorBody).message === 'string'
  );
}

export interface AppareilDemande {
  deviceId: string;
  plateforme: Plateforme;
  pushToken?: string | null;
}

export interface UtilisateurSession {
  id: string;
  email: string;
  pseudo: string;
  role: Role;
  emailVerifie: boolean;
  telephoneVerifie: boolean;
  kycLegerComplet: boolean;
  versionSecurite: number;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expireDans: number;
  utilisateur: UtilisateurSession;
}

export interface InscriptionPayload {
  email: string;
  telephone?: string | null;
  pseudo: string;
  motDePasse: string;
  dateNaissance: string;
  pays?: string;
}

export interface InscriptionReponse {
  utilisateurId: string;
  email: string;
  emailVerifie: boolean;
  verificationEnvoyeeLe: string;
  expireLe: string;
}

export interface VerificationEmailPayload {
  email: string;
  code: string;
  appareil: AppareilDemande;
}

export interface ConnexionPayload {
  email: string;
  motDePasse: string;
  appareil: AppareilDemande;
}

export interface MoiUtilisateur {
  id: string;
  email: string;
  telephone: string | null;
  pseudo: string;
  nomComplet: string | null;
  dateNaissance: string | null;
  pays: string;
  statut: 'actif' | 'restreint' | 'suspendu' | 'supprime';
  role: Role;
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
}

export interface MoiProfil {
  avatarUrl: string | null;
  bio: string | null;
  tailleCm: number | null;
  pointure: number | null;
  stylesPreferes: string[];
  visibilite: 'public' | 'membres';
  langue: string;
}

export interface Moi {
  utilisateur: MoiUtilisateur;
  profil: MoiProfil;
  sanctions: unknown[];
}

export interface ProfilModifie {
  avatarUrl?: string | null;
  bio?: string | null;
  tailleCm?: number | null;
  pointure?: number | null;
  stylesPreferes?: string[];
  visibilite?: 'public' | 'membres';
  langue?: string;
}

export interface MiseAJourMoiPayload {
  version: number;
  pseudo?: string;
  nomComplet?: string | null;
  telephone?: string | null;
  dateNaissance?: string;
  profil?: ProfilModifie;
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
  supprimeeLe: Date | string | null;
  creeLe: Date | string;
  majLe: Date | string;
}

export interface AdresseCreation {
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

export type AdresseModification = Partial<Omit<AdresseCreation, 'estDefaut'>>;

export interface Appareil {
  id: string;
  plateforme: Plateforme;
  deviceId: string;
  derniereActiviteLe: string | null;
  creeLe: string;
}

export interface ExportRgpd {
  id: string;
  statut: 'en_attente' | 'pret' | 'echoue' | 'expire';
  urlSignee: string | null;
  expireLe: string | null;
  creeLe: string;
  termineLe: string | null;
}

export interface ProfilPublic {
  pseudo: string;
  avatarUrl: string | null;
  bio: string | null;
  noteMoyenne: number;
  nbVentes: number;
  nbAchats: number;
  membreDepuis: string;
}

export interface OptionsClientApi {
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
  /** Tente un refresh et renvoie le nouveau jeton d’accès, ou null. */
  onNonAutorise?: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

interface OptionsRequete {
  methode?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  corps?: unknown;
  authentifie?: boolean;
  reessayer?: boolean;
  signal?: AbortSignal;
}

/**
 * Client typé du contrat M1. Aucun jeton n’est journalisé par ce module.
 * Les erreurs réseau sont converties en ErreurApi status 0.
 */
export class ClientApi {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OptionsClientApi) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private url(chemin: string): string {
    return `${this.options.baseUrl.replace(/\/$/, '')}${chemin}`;
  }

  private async requete<T>(chemin: string, options: OptionsRequete = {}): Promise<T> {
    const authentifie = options.authentifie ?? true;
    const token = authentifie ? await this.options.getAccessToken?.() : null;
    const entetes: Record<string, string> = { Accept: 'application/json' };

    if (options.corps !== undefined) {
      entetes['Content-Type'] = 'application/json';
    }
    if (token) {
      entetes.Authorization = `Bearer ${token}`;
    }

    let reponse: Response;

    try {
      reponse = await this.fetchImpl(this.url(chemin), {
        method: options.methode ?? 'GET',
        headers: entetes,
        ...(options.corps !== undefined ? { body: JSON.stringify(options.corps) } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      });
    } catch (error: unknown) {
      if ((error as { name?: string })?.name === 'AbortError') {
        throw error;
      }

      throw new ErreurApi(
        0,
        'reseau_indisponible',
        'Connexion impossible. Vérifiez votre réseau puis réessayez.',
      );
    }

    if (reponse.status === 401 && authentifie && !options.reessayer && this.options.onNonAutorise) {
      const nouveauJeton = await this.options.onNonAutorise();

      if (nouveauJeton) {
        return this.requete<T>(chemin, { ...options, reessayer: true });
      }
    }

    if (reponse.status === 204) {
      return undefined as T;
    }

    const texte = await reponse.text();
    let contenu: unknown = undefined;

    if (texte.length > 0) {
      try {
        contenu = JSON.parse(texte);
      } catch {
        contenu = texte;
      }
    }

    if (!reponse.ok) {
      if (estErreurApiBody(contenu)) {
        throw new ErreurApi(
          reponse.status,
          contenu.code,
          contenu.message,
          contenu.details,
          contenu.traceId,
        );
      }

      throw new ErreurApi(
        reponse.status,
        'erreur_inattendue',
        'Une erreur inattendue est survenue. Réessayez plus tard.',
      );
    }

    return contenu as T;
  }

  inscription(payload: InscriptionPayload): Promise<InscriptionReponse> {
    return this.requete('/v1/auth/inscription', {
      methode: 'POST',
      corps: payload,
      authentifie: false,
    });
  }

  verifierEmail(payload: VerificationEmailPayload): Promise<Session> {
    return this.requete('/v1/auth/email/verifier', {
      methode: 'POST',
      corps: payload,
      authentifie: false,
    });
  }

  renvoyerCodeEmail(email: string): Promise<{ message: string }> {
    return this.requete('/v1/auth/email/renvoyer', {
      methode: 'POST',
      corps: { email },
      authentifie: false,
    });
  }

  verifierTelephone(code: string): Promise<{ telephoneVerifie: true }> {
    return this.requete('/v1/auth/telephone/verifier', { methode: 'POST', corps: { code } });
  }

  renvoyerCodeTelephone(): Promise<void> {
    return this.requete('/v1/auth/telephone/renvoyer', { methode: 'POST' });
  }

  connexion(payload: ConnexionPayload): Promise<Session> {
    return this.requete('/v1/auth/connexion', {
      methode: 'POST',
      corps: payload,
      authentifie: false,
    });
  }

  refresh(refreshToken: string): Promise<Session> {
    return this.requete('/v1/auth/refresh', {
      methode: 'POST',
      corps: { refreshToken },
      authentifie: false,
    });
  }

  deconnexion(): Promise<void> {
    return this.requete('/v1/auth/deconnexion', { methode: 'POST' });
  }

  demanderReinitialisation(email: string): Promise<{ message: string }> {
    return this.requete('/v1/auth/mot-de-passe/reinitialiser', {
      methode: 'POST',
      corps: { email },
      authentifie: false,
    });
  }

  confirmerReinitialisation(jeton: string, nouveauMotDePasse: string): Promise<void> {
    return this.requete('/v1/auth/mot-de-passe/reinitialiser/confirmer', {
      methode: 'POST',
      corps: { jeton, nouveauMotDePasse },
      authentifie: false,
    });
  }

  consulterMoi(): Promise<Moi> {
    return this.requete('/v1/moi');
  }

  mettreAJourMoi(payload: MiseAJourMoiPayload): Promise<Moi> {
    return this.requete('/v1/moi', { methode: 'PATCH', corps: payload });
  }

  changerMotDePasse(motDePasseActuel: string, nouveauMotDePasse: string): Promise<void> {
    return this.requete('/v1/moi/mot-de-passe', {
      methode: 'PATCH',
      corps: { motDePasseActuel, nouveauMotDePasse },
    });
  }

  supprimerCompte(motDePasse: string): Promise<void> {
    return this.requete('/v1/moi', { methode: 'DELETE', corps: { motDePasse } });
  }

  listerAdresses(): Promise<Adresse[]> {
    return this.requete('/v1/moi/adresses');
  }

  creerAdresse(payload: AdresseCreation): Promise<Adresse> {
    return this.requete('/v1/moi/adresses', { methode: 'POST', corps: payload });
  }

  modifierAdresse(id: string, payload: AdresseModification): Promise<Adresse> {
    return this.requete(`/v1/moi/adresses/${encodeURIComponent(id)}`, {
      methode: 'PATCH',
      corps: payload,
    });
  }

  supprimerAdresse(id: string): Promise<void> {
    return this.requete(`/v1/moi/adresses/${encodeURIComponent(id)}`, { methode: 'DELETE' });
  }

  definirAdresseParDefaut(id: string): Promise<void> {
    return this.requete(`/v1/moi/adresses/${encodeURIComponent(id)}/defaut`, { methode: 'POST' });
  }

  listerAppareils(): Promise<Appareil[]> {
    return this.requete('/v1/moi/appareils');
  }

  revoquerAppareil(id: string): Promise<void> {
    return this.requete(`/v1/moi/appareils/${encodeURIComponent(id)}`, { methode: 'DELETE' });
  }

  mettreAJourPushToken(deviceId: string, pushToken: string): Promise<void> {
    return this.requete('/v1/moi/appareils/push-token', {
      methode: 'PUT',
      corps: { deviceId, pushToken },
    });
  }

  demanderExport(): Promise<{ exportId: string }> {
    return this.requete('/v1/moi/export', { methode: 'POST' });
  }

  consulterExport(id: string): Promise<ExportRgpd> {
    return this.requete(`/v1/moi/export/${encodeURIComponent(id)}`);
  }

  profilPublic(pseudo: string): Promise<ProfilPublic> {
    return this.requete(`/v1/utilisateurs/${encodeURIComponent(pseudo)}`, {
      authentifie: false,
    });
  }

  /** Transforme une URL signée relative en URL absolue téléchargeable. */
  urlTelechargementExport(urlSignee: string): string {
    if (/^https?:\/\//i.test(urlSignee)) return urlSignee;
    return `${this.options.baseUrl.replace(/\/$/, '')}${urlSignee}`;
  }
}
