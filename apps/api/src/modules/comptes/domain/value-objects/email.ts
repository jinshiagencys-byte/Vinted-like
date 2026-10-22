import { DomainError } from '../../../../common/errors/domain-error';

const EMAIL_MAX = 254;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * E-mail normalisé (NFKC, minuscules, espaces de bord supprimés).
 * R01 : c'est cette valeur qui est stockée et unique en base.
 */
export class Email {
  private constructor(public readonly valeur: string) {}

  static creer(brut: string): Email {
    if (typeof brut !== 'string') {
      throw new DomainError('email_invalide', 'L’e-mail est obligatoire.', 422);
    }

    const normalise = brut.trim().normalize('NFKC').toLowerCase();

    if (normalise.length === 0 || normalise.length > EMAIL_MAX) {
      throw new DomainError(
        'email_invalide',
        'L’e-mail doit contenir entre 1 et 254 caractères.',
        422,
      );
    }

    if (!EMAIL_REGEX.test(normalise)) {
      throw new DomainError('email_invalide', 'Le format de l’e-mail est invalide.', 422);
    }

    return new Email(normalise);
  }

  equals(autre: Email): boolean {
    return this.valeur === autre.valeur;
  }

  toString(): string {
    return this.valeur;
  }
}
