export type RaisonBlocageSuppression = 'commande_en_cours' | 'litige_ouvert' | 'solde_non_nul';

export interface ContexteSuppression {
  commandesEnCours: number;
  litigesOuverts: number;
  soldeNonNul: boolean;
}

export interface DecisionSuppression {
  autorise: boolean;
  raisons: RaisonBlocageSuppression[];
}

/**
 * R11 : la suppression est refusée si une commande est en cours, un litige
 * est ouvert ou le solde du portefeuille est non nul.
 */
export class PolitiqueSuppression {
  peutSupprimer(contexte: ContexteSuppression): DecisionSuppression {
    const raisons: RaisonBlocageSuppression[] = [];

    if (contexte.commandesEnCours > 0) raisons.push('commande_en_cours');
    if (contexte.litigesOuverts > 0) raisons.push('litige_ouvert');
    if (contexte.soldeNonNul) raisons.push('solde_non_nul');

    return {
      autorise: raisons.length === 0,
      raisons,
    };
  }
}
