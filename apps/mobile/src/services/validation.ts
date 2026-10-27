const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PSEUDO = /^[A-Za-z0-9._-]{3,30}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function emailValide(valeur: string): boolean {
  return EMAIL.test(valeur.trim());
}

export function pseudoValide(valeur: string): boolean {
  return PSEUDO.test(valeur.trim());
}

export function motDePasseValide(valeur: string): boolean {
  return valeur.length >= 10 && valeur.length <= 128;
}

export function dateNaissanceValide(valeur: string): boolean {
  if (!DATE.test(valeur)) return false;

  const [annee, mois, jour] = valeur.split('-').map(Number);
  if (!annee || !mois || !jour) return false;

  const date = new Date(Date.UTC(annee, mois - 1, jour));

  if (
    date.getUTCFullYear() !== annee ||
    date.getUTCMonth() + 1 !== mois ||
    date.getUTCDate() !== jour
  ) {
    return false;
  }

  const aujourdHui = new Date();
  let age = aujourdHui.getUTCFullYear() - annee;
  const avantAnniversaire =
    aujourdHui.getUTCMonth() + 1 < mois ||
    (aujourdHui.getUTCMonth() + 1 === mois && aujourdHui.getUTCDate() < jour);

  if (avantAnniversaire) age -= 1;

  return age >= 18;
}

export function formatDateFr(valeur: string): string {
  const [annee, mois, jour] = valeur.split('-');
  if (!annee || !mois || !jour) return valeur;
  return `${jour}/${mois}/${annee}`;
}
