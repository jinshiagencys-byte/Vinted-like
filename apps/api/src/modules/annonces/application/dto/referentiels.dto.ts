import type { Categorie, Marque, ReferentielTaille } from '../../domain/entities';

/** DTO publics des référentiels : dates sérialisables, aucun champ interne. */
export interface CategorieDto {
  id: string;
  parentId: string | null;
  nom: string;
  slug: string;
  niveau: number;
  tailleObligatoire: boolean;
  ordre: number;
  enfants: CategorieDto[];
}

export interface MarqueDto {
  id: string;
  nom: string;
  slug: string;
  logoUrl: string | null;
  verifiee: boolean;
}

export interface TailleDto {
  id: string;
  systeme: string;
  libelle: string;
  equivalentCm: number | null;
  ordre: number;
}

export function versCategorieDto(categorie: Categorie, enfants: CategorieDto[]): CategorieDto {
  return {
    id: categorie.id,
    parentId: categorie.parentId,
    nom: categorie.nom,
    slug: categorie.slug,
    niveau: categorie.niveau,
    tailleObligatoire: categorie.tailleObligatoire,
    ordre: categorie.ordre,
    enfants,
  };
}

export function versMarqueDto(marque: Marque): MarqueDto {
  return {
    id: marque.id,
    nom: marque.nom,
    slug: marque.slug,
    logoUrl: marque.logoUrl,
    verifiee: marque.verifiee,
  };
}

export function versTailleDto(taille: ReferentielTaille): TailleDto {
  return {
    id: taille.id,
    systeme: taille.systeme,
    libelle: taille.libelle,
    equivalentCm: taille.equivalentCm,
    ordre: taille.ordre,
  };
}
