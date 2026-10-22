import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../../common/errors/domain-error';
import { Email } from '../email';
import { MotDePasse } from '../mot-de-passe';
import { Pseudo } from '../pseudo';

describe('MotDePasse', () => {
  it('accepte un mot de passe de 10 à 128 caractères', () => {
    expect(MotDePasse.creer('un-mot-de-passe-solide').reveler()).toBe('un-mot-de-passe-solide');
  });

  it('refuse moins de 10 caractères et plus de 128', () => {
    expect(() => MotDePasse.creer('court')).toThrow(DomainError);
    expect(() => MotDePasse.creer('a'.repeat(129))).toThrow(DomainError);
  });

  it('refuse la partie locale de l’e-mail ou le pseudo', () => {
    const email = Email.creer('alice@example.com');
    const pseudo = Pseudo.creer('Wonderland');

    expect(() => MotDePasse.creer('xx-alice-xx', { email })).toThrow(DomainError);
    expect(() => MotDePasse.creer('xx-wonderland-xx', { pseudo })).toThrow(DomainError);
  });

  it('masque le secret dans les représentations texte et JSON', () => {
    const motDePasse = MotDePasse.creer('un-mot-de-passe-solide');

    expect(motDePasse.toString()).toBe('[REDACTED]');
    expect(JSON.stringify({ motDePasse })).toBe('{"motDePasse":"[REDACTED]"}');
  });
});
