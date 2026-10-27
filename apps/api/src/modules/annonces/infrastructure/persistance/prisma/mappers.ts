import type {
  Annonce as AnnoncePrisma,
  Categorie as CategoriePrisma,
  Favori as FavoriPrisma,
  Marque as MarquePrisma,
  Photo as PhotoPrisma,
  ReferentielTaille as ReferentielTaillePrisma,
} from '@prisma/client';
import type {
  Annonce,
  AnnonceAvecPhotos,
  Categorie,
  Favori,
  Marque,
  Photo,
  ReferentielTaille,
} from '../../../domain/entities';
import type {
  EtatArticle,
  StatutAnnonce,
  StatutModerationPhoto,
  StatutTraitementPhoto,
  SystemeTaille,
} from '../../../domain/enums';

export function versAnnonce(row: AnnoncePrisma): Annonce {
  return {
    id: row.id,
    reference: row.reference,
    vendeurId: row.vendeurId,
    titre: row.titre,
    description: row.description,
    categorieId: row.categorieId,
    marqueId: row.marqueId,
    taille: row.taille,
    etat: row.etat as EtatArticle | null,
    couleur: row.couleur,
    matiere: row.matiere,
    prixCents: row.prixCents,
    prixOrigineCents: row.prixOrigineCents,
    devise: row.devise,
    poidsG: row.poidsG,
    statut: row.statut as StatutAnnonce,
    motifRefus: row.motifRefus,
    nbVues: row.nbVues,
    nbFavoris: row.nbFavoris,
    version: row.version,
    publieeLe: row.publieeLe,
    archiveeLe: row.archiveeLe,
    creeLe: row.creeLe,
    majLe: row.majLe,
  };
}

export function versPhoto(row: PhotoPrisma): Photo {
  return {
    id: row.id,
    annonceId: row.annonceId,
    urlOriginale: row.urlOriginale,
    urlVariantes: (row.urlVariantes as Record<string, string> | null) ?? null,
    ordre: row.ordre,
    largeur: row.largeur,
    hauteur: row.hauteur,
    perceptHash: row.perceptHash,
    statutTraitement: row.statutTraitement as StatutTraitementPhoto,
    statutModeration: row.statutModeration as StatutModerationPhoto,
    tailleOctets: row.tailleOctets,
    mimeType: row.mimeType,
    creeLe: row.creeLe,
  };
}

export function versAnnonceAvecPhotos(
  row: AnnoncePrisma & { photos: PhotoPrisma[] },
): AnnonceAvecPhotos {
  return {
    ...versAnnonce(row),
    photos: [...row.photos].sort((a, b) => a.ordre - b.ordre).map(versPhoto),
  };
}

export function versCategorie(row: CategoriePrisma): Categorie {
  return {
    id: row.id,
    parentId: row.parentId,
    nom: row.nom,
    slug: row.slug,
    niveau: row.niveau,
    tailleObligatoire: row.tailleObligatoire,
    actif: row.actif,
    ordre: row.ordre,
    creeLe: row.creeLe,
    majLe: row.majLe,
  };
}

export function versMarque(row: MarquePrisma): Marque {
  return {
    id: row.id,
    nom: row.nom,
    nomNormalise: row.nomNormalise,
    slug: row.slug,
    logoUrl: row.logoUrl,
    verifiee: row.verifiee,
    actif: row.actif,
    creeLe: row.creeLe,
    majLe: row.majLe,
  };
}

export function versTaille(row: ReferentielTaillePrisma): ReferentielTaille {
  return {
    id: row.id,
    categorieId: row.categorieId,
    systeme: row.systeme as SystemeTaille,
    libelle: row.libelle,
    equivalentCm: row.equivalentCm,
    ordre: row.ordre,
    creeLe: row.creeLe,
  };
}

export function versFavori(row: FavoriPrisma): Favori {
  return {
    id: row.id,
    utilisateurId: row.utilisateurId,
    annonceId: row.annonceId,
    creeLe: row.creeLe,
  };
}
