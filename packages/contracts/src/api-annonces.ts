/** Contrats publics de M2 — annonces, photos, favoris et référentiels. */

export type StatutAnnonce =
  'brouillon' | 'en_revue' | 'publiee' | 'reservee' | 'vendue' | 'archivee' | 'refusee';

export type EtatArticle =
  'neuf_avec_etiquette' | 'neuf_sans_etiquette' | 'tres_bon' | 'bon' | 'satisfaisant';

export type StatutTraitementPhoto = 'en_attente' | 'televersee' | 'traitee' | 'rejetee';
export type StatutModerationPhoto = 'ok' | 'a_verifier' | 'refusee';

export interface PhotoAnnonce {
  id: string;
  annonceId: string;
  urlVariantes: Record<string, string> | null;
  ordre: number;
  largeur: number | null;
  hauteur: number | null;
  statutTraitement: StatutTraitementPhoto;
  statutModeration: StatutModerationPhoto;
  tailleOctets: number | null;
  mimeType: string | null;
  creeLe: string;
}

export interface Annonce {
  id: string;
  reference: string;
  vendeurId: string;
  titre: string | null;
  description: string | null;
  categorieId: string | null;
  marqueId: string | null;
  taille: string | null;
  etat: EtatArticle | null;
  couleur: string | null;
  matiere: string | null;
  prixCents: number | null;
  prixOrigineCents: number | null;
  devise: string;
  poidsG: number | null;
  statut: StatutAnnonce;
  motifRefus: string | null;
  nbVues: number;
  nbFavoris: number;
  version: number;
  publieeLe: string | null;
  archiveeLe: string | null;
  creeLe: string;
  majLe: string;
  photos: PhotoAnnonce[];
  roleActeur?: 'public' | 'proprietaire' | 'moderateur' | 'admin';
}

export interface ChampsAnnonce {
  titre?: string;
  description?: string;
  categorieId?: string | null;
  marqueId?: string | null;
  taille?: string | null;
  etat?: EtatArticle | null;
  couleur?: string | null;
  matiere?: string | null;
  prixCents?: number | null;
  prixOrigineCents?: number | null;
  poidsG?: number | null;
}

export type CreationAnnonce = ChampsAnnonce;

export interface ModificationAnnonce extends ChampsAnnonce {
  version: number;
}

export interface PageAnnonces<T> {
  items: T[];
  curseurSuivant: string | null;
}

export interface PhotoPreparee {
  photoId: string;
  urlTeleversement: string;
  expireLe: string;
  method: 'PUT';
  headers: Record<string, string>;
}

export interface PublicationAnnonce {
  id: string;
  statut: 'publiee' | 'en_revue' | 'refusee';
  version: number;
  motifRefus?: string;
  publieeLe?: string;
}

export interface FavoriAnnonce {
  annonceId: string;
  favori: boolean;
  nbFavoris: number;
}

export interface CategorieReferentiel {
  id: string;
  parentId: string | null;
  nom: string;
  slug: string;
  niveau: number;
  tailleObligatoire: boolean;
  ordre: number;
  enfants: CategorieReferentiel[];
}

export interface MarqueReferentiel {
  id: string;
  nom: string;
  slug: string;
  logoUrl: string | null;
  verifiee: boolean;
}

export interface TailleReferentiel {
  id: string;
  systeme: string;
  libelle: string;
  equivalentCm: number | null;
  ordre: number;
}
