import type { Annonce } from '../entities';
import type { StatutAnnonce } from '../enums';

export type RoleActeur = 'public' | 'proprietaire' | 'moderateur' | 'admin';

export interface Acteur {
  id?: string;
  role?: 'membre' | 'moderateur' | 'admin' | 'systeme';
}

export type StatutVendeur = 'actif' | 'restreint' | 'suspendu' | 'supprime';

/**
 * Règle de visibilité : seules les annonces publiées d'un vendeur actif sont
 * publiques. Un vendeur suspendu masque toutes ses annonces sans changer leur
 * statut (M2-Q13).
 */
export function peutVoir(
  annonce: Annonce,
  statutVendeur: StatutVendeur,
  acteur: Acteur = {},
): boolean {
  const estProprietaire = acteur.id !== undefined && acteur.id === annonce.vendeurId;
  const estModerateur =
    acteur.role === 'moderateur' || acteur.role === 'admin' || acteur.role === 'systeme';

  if (estProprietaire || estModerateur) return true;

  if (annonce.statut !== 'publiee') return false;

  return statutVendeur === 'actif' || statutVendeur === 'restreint';
}

export function roleActeur(annonce: Annonce, acteur: Acteur = {}): RoleActeur {
  if (acteur.id === annonce.vendeurId) return 'proprietaire';
  if (acteur.role === 'moderateur' || acteur.role === 'systeme') return 'moderateur';
  if (acteur.role === 'admin') return 'admin';
  return 'public';
}

export function estVisiblePubliquement(statut: StatutAnnonce): boolean {
  return statut === 'publiee';
}
