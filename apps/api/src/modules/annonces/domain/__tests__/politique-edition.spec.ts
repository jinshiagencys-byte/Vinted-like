import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../common/errors/domain-error';
import {
  editionSensible,
  statutApresEdition,
  verifierEditionAutorisee,
} from '../politiques/politique-edition';
import { uneAnnonce } from './fabriques';

describe('PolitiqueEdition', () => {
  it('verrouille les annonces réservées et vendues', () => {
    expect(() => verifierEditionAutorisee(uneAnnonce({ statut: 'reservee' }))).toThrow(DomainError);
    expect(() => verifierEditionAutorisee(uneAnnonce({ statut: 'vendue' }))).toThrow(DomainError);
    expect(() => verifierEditionAutorisee(uneAnnonce({ statut: 'publiee' }))).not.toThrow();
  });

  it('détecte les modifications sensibles après publication', () => {
    const annonce = uneAnnonce({ statut: 'publiee' });

    expect(editionSensible(annonce, { titre: 'Jean Levi’s 501 W30' })).toBe(true);
    expect(editionSensible(annonce, { description: 'Une autre description assez longue.' })).toBe(
      true,
    );
    expect(editionSensible(annonce, { photosModifiees: true })).toBe(true);
    expect(editionSensible(annonce, { titre: annonce.titre })).toBe(false);
  });

  it('ne relance pas de revue sur un brouillon', () => {
    expect(editionSensible(uneAnnonce({ statut: 'brouillon' }), { titre: 'Nouveau titre' })).toBe(
      false,
    );
  });

  it('replace une annonce refusée en brouillon après édition', () => {
    expect(statutApresEdition(uneAnnonce({ statut: 'refusee' }))).toBe('brouillon');
    expect(statutApresEdition(uneAnnonce({ statut: 'publiee' }))).toBe('publiee');
  });
});
