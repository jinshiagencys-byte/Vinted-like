import { DomainError } from '../../../../common/errors/domain-error';

export class Prix {
  static readonly MIN_CENTS = 100;
  static readonly MAX_CENTS = 500_000;

  private constructor(public readonly cents: number) {}

  static creer(valeur: number): Prix {
    if (!Number.isInteger(valeur) || valeur < Prix.MIN_CENTS || valeur > Prix.MAX_CENTS) {
      throw new DomainError(
        'prix_invalide',
        `Le prix doit être un entier entre ${Prix.MIN_CENTS / 100} et ${Prix.MAX_CENTS / 100} €.`,
        422,
      );
    }

    return new Prix(valeur);
  }
}

export class Poids {
  static readonly MIN_G = 50;
  static readonly MAX_G = 30_000;

  private constructor(public readonly grammes: number) {}

  static creer(valeur: number): Poids {
    if (!Number.isInteger(valeur) || valeur < Poids.MIN_G || valeur > Poids.MAX_G) {
      throw new DomainError(
        'poids_invalide',
        `Le poids doit être un entier entre ${Poids.MIN_G} et ${Poids.MAX_G} g.`,
        422,
      );
    }

    return new Poids(valeur);
  }
}

export class Taille {
  private constructor(public readonly valeur: string) {}

  static creer(brut: string): Taille {
    const valeur = brut.trim().toUpperCase().normalize('NFKC');

    if (valeur.length < 1 || valeur.length > 12) {
      throw new DomainError('taille_invalide', 'La taille est invalide.', 422);
    }

    return new Taille(valeur);
  }
}

export class OrdrePhoto {
  static readonly MAX = 11;

  static valider(valeur: number): number {
    if (!Number.isInteger(valeur) || valeur < 0 || valeur > OrdrePhoto.MAX) {
      throw new DomainError('ordre_photo_invalide', 'L’ordre de la photo est invalide.', 422);
    }

    return valeur;
  }
}
