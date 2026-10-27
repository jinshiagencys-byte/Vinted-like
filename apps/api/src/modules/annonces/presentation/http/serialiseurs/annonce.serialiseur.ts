import type { AnnonceAvecPhotos, Photo } from '../../../domain/entities';
import type { EtatArticle, StatutAnnonce } from '../../../domain/enums';
import type { StatutModerationPhoto, StatutTraitementPhoto } from '../../../domain/enums';
import type { RoleActeur } from '../../../domain/politiques/politique-visibilite';

/**
 * Représentation HTTP d'une photo : jamais la clé S3 de l'original ni
 * l'empreinte perceptuelle, qui restent internes au module.
 */
export interface PhotoApi {
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

export interface AnnonceApi {
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
  photos: PhotoApi[];
  roleActeur?: RoleActeur;
}

export interface PageAnnoncesApi {
  items: AnnonceApi[];
  curseurSuivant: string | null;
}

export function versPhotoApi(photo: Photo): PhotoApi {
  return {
    id: photo.id,
    annonceId: photo.annonceId,
    urlVariantes: photo.urlVariantes,
    ordre: photo.ordre,
    largeur: photo.largeur,
    hauteur: photo.hauteur,
    statutTraitement: photo.statutTraitement,
    statutModeration: photo.statutModeration,
    tailleOctets: photo.tailleOctets,
    mimeType: photo.mimeType,
    creeLe: photo.creeLe.toISOString(),
  };
}

export function versAnnonceApi(annonce: AnnonceAvecPhotos, roleActeur?: RoleActeur): AnnonceApi {
  return {
    id: annonce.id,
    reference: annonce.reference,
    vendeurId: annonce.vendeurId,
    titre: annonce.titre,
    description: annonce.description,
    categorieId: annonce.categorieId,
    marqueId: annonce.marqueId,
    taille: annonce.taille,
    etat: annonce.etat,
    couleur: annonce.couleur,
    matiere: annonce.matiere,
    prixCents: annonce.prixCents,
    prixOrigineCents: annonce.prixOrigineCents,
    devise: annonce.devise,
    poidsG: annonce.poidsG,
    statut: annonce.statut,
    motifRefus: annonce.motifRefus,
    nbVues: annonce.nbVues,
    nbFavoris: annonce.nbFavoris,
    version: annonce.version,
    publieeLe: annonce.publieeLe?.toISOString() ?? null,
    archiveeLe: annonce.archiveeLe?.toISOString() ?? null,
    creeLe: annonce.creeLe.toISOString(),
    majLe: annonce.majLe.toISOString(),
    photos: [...annonce.photos].sort((a, b) => a.ordre - b.ordre).map(versPhotoApi),
    ...(roleActeur ? { roleActeur } : {}),
  };
}

export function versPageAnnoncesApi(page: {
  items: AnnonceAvecPhotos[];
  curseurSuivant: string | null;
}): PageAnnoncesApi {
  return {
    items: page.items.map((annonce) => versAnnonceApi(annonce)),
    curseurSuivant: page.curseurSuivant,
  };
}
