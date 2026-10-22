import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { DomainError } from '../../../../common/errors/domain-error';

const CODE_REGEX = /^\d{6}$/;

/**
 * Code de vérification à 6 chiffres. Le code en clair n'est jamais journalisé
 * ni sérialisé ; seul son HMAC-SHA256 avec poivre est stocké (R05/R14).
 */
export class CodeVerification {
  private constructor(private readonly valeur: string) {}

  static generer(): CodeVerification {
    return new CodeVerification(randomInt(0, 1_000_000).toString().padStart(6, '0'));
  }

  static depuis(brut: string): CodeVerification {
    if (typeof brut !== 'string' || !CODE_REGEX.test(brut)) {
      throw new DomainError(
        'code_invalide',
        'Le code de vérification doit contenir 6 chiffres.',
        422,
      );
    }

    return new CodeVerification(brut);
  }

  hacher(poivre: string, contexte: string): string {
    return createHmac('sha256', poivre).update(`${contexte}:${this.valeur}`).digest('hex');
  }

  static verifier(brut: string, hashAttendu: string, poivre: string, contexte: string): boolean {
    if (!CODE_REGEX.test(brut) || !/^[a-f0-9]{64}$/i.test(hashAttendu)) {
      return false;
    }

    const hashCalcule = createHmac('sha256', poivre).update(`${contexte}:${brut}`).digest();

    try {
      return timingSafeEqual(hashCalcule, Buffer.from(hashAttendu, 'hex'));
    } catch {
      return false;
    }
  }

  reveler(): string {
    return this.valeur;
  }

  toString(): string {
    return '[REDACTED]';
  }

  toJSON(): string {
    return '[REDACTED]';
  }
}
