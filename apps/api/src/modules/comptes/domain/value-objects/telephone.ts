import { DomainError } from '../../../../common/errors/domain-error';

const E164 = /^\+[1-9][0-9]{7,14}$/;

/**
 * Numéro de téléphone normalisé en E.164 avant stockage (R13).
 * Les numéros français saisis au format national sont convertis.
 */
export class Telephone {
  private constructor(public readonly valeur: string) {}

  static creer(brut: string, pays = 'FR'): Telephone {
    if (typeof brut !== 'string') {
      throw new DomainError('telephone_invalide', 'Le numéro de téléphone est invalide.', 422);
    }

    let normalise = brut.trim().replace(/[\s().-]/g, '');

    if (pays === 'FR' && /^0[1-9][0-9]{8}$/.test(normalise)) {
      normalise = `+33${normalise.slice(1)}`;
    }

    if (!E164.test(normalise)) {
      throw new DomainError(
        'telephone_invalide',
        'Le numéro de téléphone doit être au format international (E.164).',
        422,
      );
    }

    return new Telephone(normalise);
  }

  toString(): string {
    return this.valeur;
  }
}
