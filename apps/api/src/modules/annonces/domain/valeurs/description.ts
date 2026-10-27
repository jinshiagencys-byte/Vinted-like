import { DomainError } from '../../../../common/errors/domain-error';
import { contientContact } from './texte';

const LONGUEUR_MIN = 20;
const LONGUEUR_MAX = 2000;

export class Description {
  private constructor(public readonly valeur: string) {}

  static creer(brut: string): Description {
    if (typeof brut !== 'string') {
      throw new DomainError('description_invalide', 'La description est obligatoire.', 422);
    }

    const valeur = brut.trim().normalize('NFKC');

    if (valeur.length < LONGUEUR_MIN || valeur.length > LONGUEUR_MAX) {
      throw new DomainError(
        'description_invalide',
        `La description doit contenir entre ${LONGUEUR_MIN} et ${LONGUEUR_MAX} caractères.`,
        422,
      );
    }

    if (contientContact(valeur)) {
      throw new DomainError(
        'description_invalide',
        'La description ne doit pas contenir de coordonnées (e-mail, téléphone, lien).',
        422,
      );
    }

    return new Description(valeur);
  }
}
