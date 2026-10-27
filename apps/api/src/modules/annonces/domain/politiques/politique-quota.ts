import { DomainError } from '../../../../common/errors/domain-error';
import { QUOTA_ACTIF } from './politique-publication';

/**
 * Quota d'annonces actives (M2-Q1) : `en_revue`, `publiee`, `reservee`.
 * Le comptage et le verrou consultatif sont appliqués dans la transaction de
 * publication ; cette politique porte la règle pure.
 */
export function verifierQuotaActif(nbActives: number): void {
  if (nbActives >= QUOTA_ACTIF) {
    throw new DomainError(
      'quota_atteint',
      `Vous avez atteint le quota de ${QUOTA_ACTIF} annonces actives.`,
      422,
      { quota: QUOTA_ACTIF },
    );
  }
}
