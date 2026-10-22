import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../../common/errors/domain-error';
import { DateNaissance } from '../date-naissance';

const maintenant = new Date('2026-10-22T12:00:00.000Z');

describe('DateNaissance', () => {
  it('accepte exactement 18 ans', () => {
    const date = DateNaissance.creer('2008-10-22', maintenant);

    expect(date.toString()).toBe('2008-10-22');
    expect(date.age(maintenant)).toBe(18);
  });

  it('refuse 17 ans', () => {
    expect(() => DateNaissance.creer('2008-10-23', maintenant)).toThrow(DomainError);
  });

  it('refuse une date future', () => {
    expect(() => DateNaissance.creer('2027-01-01', maintenant)).toThrow(DomainError);
  });

  it('refuse une date calendaire invalide', () => {
    expect(() => DateNaissance.creer('2000-02-30', maintenant)).toThrow(DomainError);
    expect(() => DateNaissance.creer('22/10/2000', maintenant)).toThrow(DomainError);
  });
});
