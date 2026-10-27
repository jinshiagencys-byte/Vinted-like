import type {
  EtatArticle,
  StatutAnnonce,
  StatutModerationPhoto,
  StatutTraitementPhoto,
  SystemeTaille,
} from './enums';

export interface Photo {
  id: string;
  annonceId: string;
  urlOriginale: string | null;
  urlVariantes: Record<string, string> | null;
  ordre: number;
  largeur: number | null;
  hauteur: number | null;
  perceptHash: string | null;
  statutTraitement: StatutTraitementPhoto;
  statutModeration: StatutModerationPhoto;
  tailleOctets: number | null;
  mimeType: string | null;
  creeLe: Date;
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
  publieeLe: Date | null;
  archiveeLe: Date | null;
  creeLe: Date;
  majLe: Date;
}

export interface AnnonceAvecPhotos extends Annonce {
  photos: Photo[];
}

export interface Categorie {
  id: string;
  parentId: string | null;
  nom: string;
  slug: string;
  niveau: number;
  tailleObligatoire: boolean;
  actif: boolean;
  ordre: number;
  creeLe: Date;
  majLe: Date;
}

export interface CategorieAvecEnfants extends Categorie {
  enfants: Categorie[];
}

export interface Marque {
  id: string;
  nom: string;
  nomNormalise: string;
  slug: string;
  logoUrl: string | null;
  verifiee: boolean;
  actif: boolean;
  creeLe: Date;
  majLe: Date;
}

export interface ReferentielTaille {
  id: string;
  categorieId: string;
  systeme: SystemeTaille;
  libelle: string;
  equivalentCm: number | null;
  ordre: number;
  creeLe: Date;
}

export interface Favori {
  id: string;
  utilisateurId: string;
  annonceId: string;
  creeLe: Date;
}
