import { DomainError } from '../../../../common/errors/domain-error';
import { contientContact, ratioCapitales, texteNettoye } from './texte';

const LONGUEUR_MIN = 5;
const LONGUEUR_MAX = 80;

export class Titre {
  private constructor(public readonly valeur: string) {}

  static creer(brut: string): Titre {
    if (typeof brut !== 'string') {
      throw new DomainError('titre_invalide', 'Le titre est obligatoire.', 422);
    }

    const valeur = texteNettoye(brut);

    if (valeur.length < LONGUEUR_MIN || valeur.length > LONGUEUR_MAX) {
      throw new DomainError(
        'titre_invalide',
        `Le titre doit contenir entre ${LONGUEUR_MIN} et ${LONGUEUR_MAX} caractères.`,
        422,
      );
    }

    if (ratioCapitales(valeur) > 0.5) {
      throw new DomainError(
        'titre_invalide',
        'Le titre ne doit pas être écrit majoritairement en majuscules.',
        422,
      );
    }

    if (contientContact(valeur)) {
      throw new DomainError(
        'titre_invalide',
        'Le titre ne doit pas contenir de coordonnées (e-mail, téléphone, lien).',
        422,
      );
    }

    return new Titre(valeur);
  }
}
