const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const URL = /(?:https?:\/\/|www\.)\S+/i;
const TELEPHONE = /(?:\+?\d[\s.-]?){9,}/;

/** Détecte un moyen de contact inséré dans un titre ou une description. */
export function contientContact(texte: string): boolean {
  const normalise = texte.normalize('NFKC');

  return EMAIL.test(normalise) || URL.test(normalise) || TELEPHONE.test(normalise);
}

/** Ratio de capitales parmi les lettres, accents ignorés. */
export function ratioCapitales(texte: string): number {
  const lettres = [...texte].filter((caractere) => /\p{L}/u.test(caractere));

  if (lettres.length === 0) return 0;

  const capitales = lettres.filter(
    (caractere) =>
      caractere === caractere.toLocaleUpperCase('fr') &&
      caractere !== caractere.toLocaleLowerCase('fr'),
  ).length;

  return capitales / lettres.length;
}

export function texteNettoye(valeur: string): string {
  return valeur.trim().replace(/\s+/g, ' ').normalize('NFKC');
}

/** Normalisation utilisée pour la recherche et la comparaison de référentiels. */
export function normaliserRecherche(valeur: string): string {
  return valeur
    .trim()
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
