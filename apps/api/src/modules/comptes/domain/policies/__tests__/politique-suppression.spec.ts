import { describe, expect, it } from 'vitest';
import { PolitiqueSuppression } from '../politique-suppression';

describe('PolitiqueSuppression', () => {
  const politique = new PolitiqueSuppression();

  it('autorise la suppression sans blocage', () => {
    expect(
      politique.peutSupprimer({
        commandesEnCours: 0,
        litigesOuverts: 0,
        soldeNonNul: false,
      }),
    ).toEqual({ autorise: true, raisons: [] });
  });

  it('liste tous les blocages', () => {
    expect(
      politique.peutSupprimer({
        commandesEnCours: 2,
        litigesOuverts: 1,
        soldeNonNul: true,
      }),
    ).toEqual({
      autorise: false,
      raisons: ['commande_en_cours', 'litige_ouvert', 'solde_non_nul'],
    });
  });
});
