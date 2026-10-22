import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../../common/errors/domain-error';
import { Pseudo } from '../pseudo';

describe('Pseudo', () => {
  it('conserve la casse mais normalise pour l’unicité', () => {
    const pseudo = Pseudo.creer(' Alice ');

    expect(pseudo.valeur).toBe('Alice');
    expect(pseudo.normalise).toBe('alice');
    expect(pseudo.equals(Pseudo.creer('alice'))).toBe(true);
  });

  it('refuse les espaces et les caractères interdits', () => {
    expect(() => Pseudo.creer('a b')).toThrow(DomainError);
    expect(() => Pseudo.creer('alice!')).toThrow(DomainError);
    expect(() => Pseudo.creer('é')).toThrow(DomainError);
  });

  it('refuse les longueurs hors bornes', () => {
    expect(() => Pseudo.creer('ab')).toThrow(DomainError);
    expect(() => Pseudo.creer('a'.repeat(31))).toThrow(DomainError);
  });

  it('refuse les pseudos réservés sans tenir compte de la casse', () => {
    expect(() => Pseudo.creer('admin')).toThrow(DomainError);
    expect(() => Pseudo.creer('ADMIN')).toThrow(DomainError);
    expect(() => Pseudo.creer('SecondeVie')).toThrow(DomainError);
  });
});
