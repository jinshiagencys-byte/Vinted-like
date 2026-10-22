import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { DomainError } from '../../../../common/errors/domain-error';

const JETON_REGEX = /^[A-Za-z0-9_-]{32,256}$/;

/**
 * Jeton de refresh opaque. Seul son HMAC-SHA256 avec poivre est stocké par
 * appareil (R07/R14). Le jeton en clair n'est renvoyé qu'au client.
 */
export class JetonRefresh {
  private constructor(private readonly valeur: string) {}

  static generer(): JetonRefresh {
    return new JetonRefresh(randomBytes(32).toString('base64url'));
  }

  static depuis(brut: string): JetonRefresh {
    if (typeof brut !== 'string' || !JETON_REGEX.test(brut)) {
      throw new DomainError('jeton_invalide', 'Le jeton de refresh est invalide.', 401);
    }

    return new JetonRefresh(brut);
  }

  hacher(poivre: string): string {
    return createHmac('sha256', poivre).update(this.valeur).digest('hex');
  }

  static verifier(brut: string, hashAttendu: string, poivre: string): boolean {
    if (!JETON_REGEX.test(brut) || !/^[a-f0-9]{64}$/i.test(hashAttendu)) {
      return false;
    }

    const hashCalcule = createHmac('sha256', poivre).update(brut).digest();

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
