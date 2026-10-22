import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../../common/errors/domain-error';
import { Email } from '../email';

describe('Email', () => {
  it('normalise NFKC, les espaces de bord et la casse', () => {
    const email = Email.creer(' Alice@Example.COM ');

    expect(email.valeur).toBe('alice@example.com');
    expect(email.toString()).toBe('alice@example.com');
  });

  it('refuse un format invalide', () => {
    expect(() => Email.creer('alice')).toThrow(DomainError);
    expect(() => Email.creer('alice@localhost')).toThrow(DomainError);
    expect(() => Email.creer('')).toThrow(DomainError);
  });

  it('refuse un e-mail de plus de 254 caractères', () => {
    expect(() => Email.creer(`${'a'.repeat(250)}@example.com`)).toThrow(DomainError);
  });

  it('compare sur la valeur normalisée', () => {
    expect(Email.creer('Alice@Example.com').equals(Email.creer('alice@example.com'))).toBe(true);
  });
});
