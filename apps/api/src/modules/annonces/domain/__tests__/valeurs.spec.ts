import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../common/errors/domain-error';
import { Description } from '../valeurs/description';
import { Prix, Poids, Taille } from '../valeurs/article';
import { Titre } from '../valeurs/titre';

describe('Titre', () => {
  it('normalise les espaces', () => {
    expect(Titre.creer('  Jean   Levi’s 501  ').valeur).toBe('Jean Levi’s 501');
  });

  it('refuse un titre trop court, trop long, en majuscules ou avec contact', () => {
    expect(() => Titre.creer('Jean')).toThrow(DomainError);
    expect(() => Titre.creer('a'.repeat(81))).toThrow(DomainError);
    expect(() => Titre.creer('JEAN LEVIS 501')).toThrow(DomainError);
    expect(() => Titre.creer('Jean levis ecrire a test@example.com')).toThrow(DomainError);
  });
});

describe('Description', () => {
  it('accepte une description complète', () => {
    expect(Description.creer('a'.repeat(20)).valeur).toHaveLength(20);
  });

  it('refuse une description trop courte ou contenant un lien', () => {
    expect(() => Description.creer('trop court')).toThrow(DomainError);
    expect(() => Description.creer('Voir https://example.com pour plus de details')).toThrow(
      DomainError,
    );
  });
});

describe('Prix, Poids et Taille', () => {
  it('borne le prix entre 1 € et 5 000 €', () => {
    expect(Prix.creer(100).cents).toBe(100);
    expect(() => Prix.creer(99)).toThrow(DomainError);
    expect(() => Prix.creer(500_001)).toThrow(DomainError);
  });

  it('borne le poids entre 50 g et 30 kg', () => {
    expect(Poids.creer(450).grammes).toBe(450);
    expect(() => Poids.creer(49)).toThrow(DomainError);
    expect(() => Poids.creer(30_001)).toThrow(DomainError);
  });

  it('normalise la taille en majuscules', () => {
    expect(Taille.creer(' w30 ').valeur).toBe('W30');
    expect(() => Taille.creer('')).toThrow(DomainError);
  });
});
