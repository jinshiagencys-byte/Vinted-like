import { randomInt } from 'node:crypto';
import { DomainError } from '../../../../common/errors/domain-error';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const LONGUEUR = 6;
const FORMAT = /^SV-[0-9A-HJKMNP-TV-Z]{6}$/;

/**
 * Référence publique immuable : SV- + 6 caractères Crockford base32.
 * L'unicité globale est garantie par la base ; le cas d'usage réessaie en cas
 * de collision.
 */
export class Reference {
  private constructor(public readonly valeur: string) {}

  static generer(): Reference {
    let suffixe = '';

    for (let index = 0; index < LONGUEUR; index += 1) {
      suffixe += ALPHABET[randomInt(0, ALPHABET.length)];
    }

    return new Reference(`SV-${suffixe}`);
  }

  static creer(valeur: string): Reference {
    const normalisee = valeur.trim().toUpperCase();

    if (!FORMAT.test(normalisee)) {
      throw new DomainError('reference_invalide', 'La référence est invalide.', 422);
    }

    return new Reference(normalisee);
  }

  toString(): string {
    return this.valeur;
  }
}
