import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../common/errors/domain-error';
import { Reference } from '../valeurs/reference';

describe('Reference', () => {
  it('génère 100 références au format attendu et sans caractère ambigu', () => {
    const references = new Set<string>();

    for (let index = 0; index < 100; index += 1) {
      const reference = Reference.generer().valeur;
      expect(reference).toMatch(/^SV-[0-9A-HJKMNP-TV-Z]{6}$/);
      expect(reference).not.toMatch(/[ILOU]/);
      references.add(reference);
    }

    expect(references.size).toBeGreaterThan(95);
  });

  it('normalise une référence saisie en minuscules', () => {
    expect(Reference.creer(' sv-abc123 ').valeur).toBe('SV-ABC123');
  });

  it('refuse un format invalide', () => {
    expect(() => Reference.creer('SV-ABC')).toThrow(DomainError);
    expect(() => Reference.creer('SV-ABC12O')).toThrow(DomainError);
  });
});
