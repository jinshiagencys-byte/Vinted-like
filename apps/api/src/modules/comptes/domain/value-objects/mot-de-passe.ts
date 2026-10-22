import { DomainError } from '../../../../common/errors/domain-error';
import type { Email } from './email';
import type { Pseudo } from './pseudo';

const LONGUEUR_MIN = 10;
const LONGUEUR_MAX = 128;

/**
 * Mot de passe en clair uniquement le temps de la validation et du hachage.
 * Sa représentation texte et JSON est volontairement masquée (R04/R15).
 */
export class MotDePasse {
  private constructor(private readonly valeur: string) {}

  static creer(brut: string, contexte: { email?: Email; pseudo?: Pseudo } = {}): MotDePasse {
    if (typeof brut !== 'string') {
      throw new DomainError('mot_de_passe_invalide', 'Le mot de passe est obligatoire.', 422);
    }

    if (brut.length < LONGUEUR_MIN || brut.length > LONGUEUR_MAX) {
      throw new DomainError(
        'mot_de_passe_invalide',
        `Le mot de passe doit contenir entre ${LONGUEUR_MIN} et ${LONGUEUR_MAX} caractères.`,
        422,
      );
    }

    const minuscule = brut.toLowerCase();

    if (contexte.email) {
      const partieLocale = contexte.email.valeur.split('@')[0] ?? '';
      if (partieLocale.length >= 3 && minuscule.includes(partieLocale.toLowerCase())) {
        throw new DomainError(
          'mot_de_passe_invalide',
          'Le mot de passe ne doit pas contenir la partie locale de l’e-mail.',
          422,
        );
      }
    }

    if (
      contexte.pseudo &&
      contexte.pseudo.normalise.length >= 3 &&
      minuscule.includes(contexte.pseudo.normalise)
    ) {
      throw new DomainError(
        'mot_de_passe_invalide',
        'Le mot de passe ne doit pas contenir le pseudo.',
        422,
      );
    }

    return new MotDePasse(brut);
  }

  /** Accès explicite, réservé au hachage et à la vérification. */
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
