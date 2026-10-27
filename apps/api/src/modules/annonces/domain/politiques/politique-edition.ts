import { DomainError } from '../../../../common/errors/domain-error';
import type { Annonce } from '../entities';
import type { StatutAnnonce } from '../enums';

const STATUTS_VERROUILLES: readonly StatutAnnonce[] = ['reservee', 'vendue'];

export function verifierEditionAutorisee(annonce: Annonce): void {
  if (STATUTS_VERROUILLES.includes(annonce.statut)) {
    throw new DomainError(
      'etat_incompatible',
      'Cette annonce est verrouillée : elle ne peut plus être modifiée.',
      409,
      { statutActuel: annonce.statut },
    );
  }
}

/**
 * Champs dont la modification après publication déclenche les contrôles de
 * contenu (M2-Q8). Le prix, la matière et la couleur n'en font pas partie.
 */
export function editionSensible(
  annonce: Annonce,
  modifications: {
    titre?: string | null;
    description?: string | null;
    categorieId?: string | null;
    photosModifiees?: boolean;
  },
): boolean {
  if (annonce.statut !== 'publiee' && annonce.statut !== 'en_revue') return false;

  return (
    (modifications.titre !== undefined && modifications.titre !== annonce.titre) ||
    (modifications.description !== undefined &&
      modifications.description !== annonce.description) ||
    (modifications.categorieId !== undefined &&
      modifications.categorieId !== annonce.categorieId) ||
    modifications.photosModifiees === true
  );
}

export function statutApresEdition(annonce: Annonce): StatutAnnonce {
  if (annonce.statut === 'refusee') return 'brouillon';
  return annonce.statut;
}
