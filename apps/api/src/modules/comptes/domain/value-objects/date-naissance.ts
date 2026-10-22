import { DomainError } from '../../../../common/errors/domain-error';

const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

function dateUtc(annee: number, mois: number, jour: number): Date {
  return new Date(Date.UTC(annee, mois - 1, jour));
}

function aujourdHuiUtc(maintenant: Date): Date {
  return dateUtc(
    maintenant.getUTCFullYear(),
    maintenant.getUTCMonth() + 1,
    maintenant.getUTCDate(),
  );
}

function ageEnAnnees(naissance: Date, aujourdHui: Date): number {
  let age = aujourdHui.getUTCFullYear() - naissance.getUTCFullYear();
  const moisAvant =
    aujourdHui.getUTCMonth() < naissance.getUTCMonth() ||
    (aujourdHui.getUTCMonth() === naissance.getUTCMonth() &&
      aujourdHui.getUTCDate() < naissance.getUTCDate());

  if (moisAvant) age -= 1;
  return age;
}

/**
 * Date de naissance valide, non future, et âge >= 18 ans à l'inscription.
 * La valeur stockée est un minuit UTC pour éviter les décalages de fuseau.
 */
export class DateNaissance {
  private constructor(public readonly valeur: Date) {}

  static creer(valeur: string | Date, maintenant = new Date()): DateNaissance {
    let date: Date;

    if (valeur instanceof Date) {
      date = dateUtc(valeur.getUTCFullYear(), valeur.getUTCMonth() + 1, valeur.getUTCDate());
    } else {
      const correspondance = DATE_REGEX.exec(valeur);

      if (!correspondance) {
        throw new DomainError(
          'date_naissance_invalide',
          'La date de naissance doit être au format AAAA-MM-JJ.',
          422,
        );
      }

      const annee = Number(correspondance[1]);
      const mois = Number(correspondance[2]);
      const jour = Number(correspondance[3]);
      date = dateUtc(annee, mois, jour);

      if (
        date.getUTCFullYear() !== annee ||
        date.getUTCMonth() + 1 !== mois ||
        date.getUTCDate() !== jour
      ) {
        throw new DomainError('date_naissance_invalide', 'La date de naissance est invalide.', 422);
      }
    }

    const aujourdHui = aujourdHuiUtc(maintenant);

    if (date.getTime() > aujourdHui.getTime()) {
      throw new DomainError(
        'date_naissance_invalide',
        'La date de naissance ne peut pas être future.',
        422,
      );
    }

    if (ageEnAnnees(date, aujourdHui) < 18) {
      throw new DomainError(
        'age_insuffisant',
        'Vous devez avoir au moins 18 ans pour créer un compte.',
        422,
      );
    }

    return new DateNaissance(date);
  }

  age(maintenant = new Date()): number {
    return ageEnAnnees(this.valeur, aujourdHuiUtc(maintenant));
  }

  toString(): string {
    return this.valeur.toISOString().slice(0, 10);
  }
}
