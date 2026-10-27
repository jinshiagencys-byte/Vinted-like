import type {
  Annonce,
  AnnonceAvecPhotos,
  Categorie,
  Marque,
  Photo,
  ReferentielTaille,
} from './entities';
import type { EtatArticle, StatutAnnonce, StatutModerationPhoto } from './enums';

export const ANNONCE_REPOSITORY = Symbol('ANNONCE_REPOSITORY');
export const PHOTO_REPOSITORY = Symbol('PHOTO_REPOSITORY');
export const FAVORI_REPOSITORY = Symbol('FAVORI_REPOSITORY');
export const REFERENTIEL_REPOSITORY = Symbol('REFERENTIEL_REPOSITORY');
export const COMPTES_QUERY = Symbol('COMPTES_QUERY');
export const STOCKAGE_OBJET = Symbol('STOCKAGE_OBJET');
export const TRAITEMENT_IMAGE = Symbol('TRAITEMENT_IMAGE');
export const MODERATION_TEXTE = Symbol('MODERATION_TEXTE');
export const CACHE_REFERENTIELS = Symbol('CACHE_REFERENTIELS');

export interface DonneesAnnonce {
  vendeurId: string;
  reference: string;
  titre?: string | null;
  description?: string | null;
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

export interface MiseAJourAnnonce {
  titre?: string | null;
  description?: string | null;
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

export interface FiltreMesAnnonces {
  statut?: StatutAnnonce;
  curseur?: string;
  limite: number;
}

export interface PageAnnonces<T> {
  items: T[];
  curseurSuivant: string | null;
}

export interface TransitionAnnonce {
  de: readonly StatutAnnonce[];
  vers: StatutAnnonce;
  publieeLe?: Date | null;
  archiveeLe?: Date | null;
  motifRefus?: string | null;
}

export interface AnnonceRepository {
  creer(donnees: DonneesAnnonce): Promise<Annonce>;
  trouverParId(id: string): Promise<AnnonceAvecPhotos | null>;
  modifier(
    id: string,
    version: number,
    donnees: MiseAJourAnnonce,
    statut?: StatutAnnonce,
    motifRefus?: string | null,
  ): Promise<Annonce | null>;
  listerParVendeur(
    vendeurId: string,
    filtre: FiltreMesAnnonces,
  ): Promise<PageAnnonces<AnnonceAvecPhotos>>;
  compterActives(vendeurId: string): Promise<number>;
  transitionner(id: string, transition: TransitionAnnonce): Promise<boolean>;
  referenceExiste(reference: string): Promise<boolean>;
  incrementerVues(id: string, nombre: number): Promise<void>;
  archiverParVendeur(vendeurId: string): Promise<number>;
  supprimerFavorisParAnnonce(annonceId: string): Promise<void>;
}

export interface DonneesPhoto {
  annonceId: string;
  ordre: number;
  mimeType: string;
  tailleOctets: number;
  largeur: number;
  hauteur: number;
}

export interface TraitementPhoto {
  urlOriginale: string;
  urlVariantes: Record<string, string>;
  largeur: number;
  hauteur: number;
  perceptHash: string;
  tailleOctets: number;
  mimeType: string;
}

export interface PhotoRepository {
  creer(donnees: DonneesPhoto): Promise<Photo>;
  trouverParId(id: string): Promise<Photo | null>;
  listerParAnnonce(annonceId: string): Promise<Photo[]>;
  marquerTeleversee(id: string): Promise<Photo | null>;
  enregistrerTraitement(id: string, traitement: TraitementPhoto): Promise<Photo | null>;
  marquerRejetee(id: string): Promise<void>;
  mettreAJourModeration(id: string, statut: StatutModerationPhoto): Promise<void>;
  supprimer(id: string): Promise<void>;
  reordonner(annonceId: string, photoIds: string[]): Promise<void>;
  compter(annonceId: string): Promise<number>;
  hashPublieAilleurs(hash: string, annonceId: string): Promise<boolean>;
  hashesDuVendeur(vendeurId: string, exclurePhotoId: string): Promise<string[]>;
  photosSansTraitementAvant(date: Date): Promise<Photo[]>;
}

export interface FavoriRepository {
  ajouter(utilisateurId: string, annonceId: string): Promise<boolean>;
  retirer(utilisateurId: string, annonceId: string): Promise<boolean>;
  existe(utilisateurId: string, annonceId: string): Promise<boolean>;
  lister(
    utilisateurId: string,
    curseur: string | undefined,
    limite: number,
  ): Promise<PageAnnonces<AnnonceAvecPhotos>>;
  compter(annonceId: string): Promise<number>;
}

export interface ReferentielRepository {
  listerCategories(): Promise<Categorie[]>;
  trouverCategorie(id: string): Promise<Categorie | null>;
  compterEnfantsActifs(id: string): Promise<number>;
  rechercherMarques(requete: string, limite: number): Promise<Marque[]>;
  trouverMarque(id: string): Promise<Marque | null>;
  listerTailles(categorieId: string): Promise<ReferentielTaille[]>;
  tailleExiste(categorieId: string, libelle: string): Promise<boolean>;
}

export interface ComptesQueryPort {
  profilVendeur(utilisateurId: string): Promise<{
    statut: 'actif' | 'restreint' | 'suspendu' | 'supprime';
    emailVerifie: boolean;
  } | null>;
}

export interface StockageObjetPort {
  urlTeleversement(
    cle: string,
    mimeType: string,
    tailleOctets: number,
    expireSecondes: number,
  ): Promise<{ url: string; expireLe: Date; method: 'PUT'; headers: Record<string, string> }>;
  head(cle: string): Promise<{ tailleOctets: number; mimeType: string } | null>;
  lire(cle: string): Promise<Buffer>;
  ecrire(cle: string, contenu: Buffer, mimeType: string): Promise<void>;
  supprimer(cle: string): Promise<void>;
  urlPublique(cle: string): string;
}

export interface ImageAnalysee {
  largeur: number;
  hauteur: number;
  mimeType: string;
}

export interface ImageTraitee extends ImageAnalysee {
  perceptHash: string;
  original: Buffer;
  extension: 'webp';
  variantes: Record<string, Buffer>;
}

export interface TraitementImagePort {
  analyser(contenu: Buffer, mimeDeclare: string): Promise<ImageAnalysee>;
  traiter(contenu: Buffer): Promise<ImageTraitee>;
}

export interface ModerationTextePort {
  analyser(texte: string): Promise<{ contientContact: boolean; motsInterdits: string[] }>;
}

export interface CachePort {
  lire<T>(cle: string): Promise<T | null>;
  ecrire<T>(cle: string, valeur: T, dureeSecondes: number): Promise<void>;
  supprimer(cle: string): Promise<void>;
  supprimerParPrefixe(prefixe: string): Promise<void>;
}
