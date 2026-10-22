import { DomainError } from '../../../../common/errors/domain-error';

const PSEUDO_REGEX = /^[A-Za-z0-9._-]+$/;

const PSEUDOS_RESERVES = new Set([
  'admin',
  'administrateur',
  'support',
  'secondevie',
  'root',
  'moderateur',
  'moderation',
  'system',
  'systeme',
  'contact',
  'aide',
  'help',
  'service',
  'equipe',
  'staff',
  'officiel',
]);

/**
 * Pseudo affiché et sa forme normalisée (minuscules) utilisée pour
 * l'unicité insensible à la casse (R02).
 */
export class Pseudo {
  private constructor(
    public readonly valeur: string,
    public readonly normalise: string,
  ) {}

  static creer(brut: string): Pseudo {
    if (typeof brut !== 'string') {
      throw new DomainError('pseudo_invalide', 'Le pseudo est obligatoire.', 422);
    }

    const valeur = brut.trim().normalize('NFKC');

    if (valeur.length < 3 || valeur.length > 30) {
      throw new DomainError(
        'pseudo_invalide',
        'Le pseudo doit contenir entre 3 et 30 caractères.',
        422,
      );
    }

    if (!PSEUDO_REGEX.test(valeur)) {
      throw new DomainError(
        'pseudo_invalide',
        'Le pseudo ne peut contenir que des lettres, chiffres, points, tirets et underscores.',
        422,
      );
    }

    const normalise = valeur.toLowerCase();

    if (PSEUDOS_RESERVES.has(normalise)) {
      throw new DomainError('pseudo_reserve', 'Ce pseudo est réservé.', 422);
    }

    return new Pseudo(valeur, normalise);
  }

  equals(autre: Pseudo): boolean {
    return this.normalise === autre.normalise;
  }

  toString(): string {
    return this.valeur;
  }
}
