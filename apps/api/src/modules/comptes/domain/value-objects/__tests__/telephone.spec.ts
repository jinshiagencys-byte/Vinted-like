import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../../common/errors/domain-error';
import { Telephone } from '../telephone';

describe('Telephone', () => {
  it('normalise un numéro français national en E.164', () => {
    expect(Telephone.creer('06 12 34 56 78').valeur).toBe('+33612345678');
    expect(Telephone.creer('06.12.34.56.78').valeur).toBe('+33612345678');
  });

  it('conserve un numéro international valide', () => {
    expect(Telephone.creer('+33 6 12 34 56 78').valeur).toBe('+33612345678');
    expect(Telephone.creer('+41791234567').valeur).toBe('+41791234567');
  });

  it('refuse un numéro vide, trop court ou mal formé', () => {
    for (const valeur of ['', '0612', 'abc', '+33', '00 33 6 12 34 56 78']) {
      expect(() => Telephone.creer(valeur)).toThrow(DomainError);
    }
  });

  it('n’accepte pas un numéro national pour un autre pays', () => {
    expect(() => Telephone.creer('0612345678', 'BE')).toThrow(DomainError);
  });
});
