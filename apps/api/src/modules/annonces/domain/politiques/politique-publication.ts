import { DomainError } from '../../../../common/errors/domain-error';
import type { Annonce, Photo } from '../entities';
import type { StatutAnnonce } from '../enums';

export const MAX_PHOTOS = 12;
export const QUOTA_ACTIF = 20;

export interface SignauxPublication {
  contientContact: boolean;
  motsInterdits: string[];
  doublonExact: boolean;
  quasiDoublon: boolean;
  categorieValide: boolean;
  tailleRequise: boolean;
  tailleDansGrille: boolean;
}

export type IssuePublication =
  | { statut: 'publiee' }
  | { statut: 'en_revue'; raisons: string[] }
  | { statut: 'refusee'; motif: string };

const CHAMPS_OBLIGATOIRES = [
  ['titre', 'le titre'],
  ['description', 'la description'],
  ['categorieId', 'la catégorie'],
  ['etat', 'l’état de l’article'],
  ['couleur', 'la couleur'],
  ['prixCents', 'le prix'],
  ['poidsG', 'le poids'],
] as const;

/**
 * Vérifie les champs qu'une annonce doit conserver dès qu'elle est soumise
 * (`en_revue`, `publiee`, `reservee`, `vendue`, `refusee`). Utilisé avant une
 * publication et après une édition, pour ne jamais laisser le client retirer
 * un champ obligatoire d'une annonce déjà en ligne.
 */
export function verifierChampsObligatoires(annonce: Annonce): void {
  for (const [champ, libelle] of CHAMPS_OBLIGATOIRES) {
    if (annonce[champ] === null || annonce[champ] === undefined) {
      throw new DomainError(
        'annonce_incomplete',
        `Renseignez ${libelle} avant de publier l’annonce.`,
        422,
        { champ },
      );
    }
  }
}

/**
 * Contrôles bloquants avant toute transition de publication.
 * Ils produisent une erreur 422 : l'annonce reste dans son état courant.
 * Les contrôles de catégorie, de taille et de contenu sont décidés par
 * `deciderPublication` (refus explicite, pas erreur technique).
 */
export function verifierPrealablesPublication(annonce: Annonce, photos: Photo[]): void {
  verifierChampsObligatoires(annonce);

  if (photos.length < 1) {
    throw new DomainError(
      'photos_requises',
      'Ajoutez au moins une photo avant de publier l’annonce.',
      422,
    );
  }

  if (photos.length > MAX_PHOTOS) {
    throw new DomainError(
      'photos_trop_nombreuses',
      `Une annonce ne peut pas contenir plus de ${MAX_PHOTOS} photos.`,
      422,
    );
  }

  if (photos.some((photo) => photo.statutTraitement !== 'traitee')) {
    throw new DomainError(
      'photos_non_pretes',
      'Toutes les photos doivent être traitées avant la publication.',
      422,
    );
  }

  if (photos.some((photo) => photo.statutModeration === 'refusee')) {
    throw new DomainError(
      'photos_refusees',
      'Une photo a été refusée. Remplacez-la avant de publier.',
      422,
    );
  }

  if (!transitionPossible(annonce.statut)) {
    throw new DomainError(
      'etat_incompatible',
      'Cette annonce ne peut pas être publiée depuis son état actuel.',
      409,
      { statutActuel: annonce.statut },
    );
  }
}

function transitionPossible(statut: StatutAnnonce): boolean {
  return statut === 'brouillon' || statut === 'archivee' || statut === 'refusee';
}

/** Décide de l'issue finale : publication directe, revue humaine ou refus. */
export function deciderPublication(signaux: SignauxPublication): IssuePublication {
  if (signaux.contientContact) {
    return { statut: 'refusee', motif: 'Les coordonnées personnelles sont interdites.' };
  }

  if (signaux.motsInterdits.length > 0) {
    return {
      statut: 'refusee',
      motif: 'Le texte contient des termes interdits par les règles de publication.',
    };
  }

  if (signaux.doublonExact) {
    return { statut: 'refusee', motif: 'Cette annonce existe déjà (photo identique).' };
  }

  if (!signaux.categorieValide) {
    return { statut: 'refusee', motif: 'La catégorie de l’annonce n’est plus disponible.' };
  }

  if (signaux.tailleRequise && !signaux.tailleDansGrille) {
    return { statut: 'refusee', motif: 'La taille ne correspond pas à la grille de la catégorie.' };
  }

  if (signaux.quasiDoublon) {
    return { statut: 'en_revue', raisons: ['quasi_doublon'] };
  }

  return { statut: 'publiee' };
}
