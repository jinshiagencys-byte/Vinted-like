export interface AdresseActive {
  id: string;
  estDefaut: boolean;
  supprimeeLe: Date | null;
  creeLe: Date;
}

/**
 * R09 : au plus une adresse par défaut active ; suppression logique si une
 * commande référence l'adresse ; promotion de la plus récente des autres
 * adresses actives.
 */
export class PolitiqueAdresse {
  estDefautUnique(adresses: AdresseActive[]): boolean {
    return adresses.filter((adresse) => adresse.estDefaut && !adresse.supprimeeLe).length <= 1;
  }

  choisirNouveauDefaut(adresses: AdresseActive[], exclueId?: string): string | null {
    const candidates = adresses
      .filter(
        (adresse) => adresse.id !== exclueId && !adresse.estDefaut && adresse.supprimeeLe === null,
      )
      .sort((a, b) => b.creeLe.getTime() - a.creeLe.getTime());

    return candidates[0]?.id ?? null;
  }

  doitSupprimerLogiquement(referenceeParCommande: boolean): boolean {
    return referenceeParCommande;
  }

  peutSupprimerPhysiquement(): boolean {
    return false;
  }
}
