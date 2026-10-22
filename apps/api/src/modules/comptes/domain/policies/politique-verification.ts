export interface VerificationTemporelle {
  expireLe: Date;
  tentatives: number;
}

/**
 * R05/R14 : code valable 15 minutes, 5 tentatives, renvoi après 60 secondes,
 * 5 renvois par jour.
 */
export class PolitiqueVerification {
  static readonly DUREE_CODE_MS = 15 * 60 * 1000;
  static readonly MAX_TENTATIVES = 5;
  static readonly DELAI_RENVOI_MS = 60 * 1000;
  static readonly MAX_RENVOIS_JOUR = 5;

  estExpire(verification: VerificationTemporelle, maintenant = new Date()): boolean {
    return verification.expireLe.getTime() <= maintenant.getTime();
  }

  peutTenter(verification: VerificationTemporelle): boolean {
    return verification.tentatives < PolitiqueVerification.MAX_TENTATIVES;
  }

  peutRenvoyer(
    derniereCreation: Date | null,
    renvoisDernieres24h: number,
    maintenant = new Date(),
  ): boolean {
    if (renvoisDernieres24h >= PolitiqueVerification.MAX_RENVOIS_JOUR) {
      return false;
    }

    if (!derniereCreation) {
      return true;
    }

    return (
      maintenant.getTime() - derniereCreation.getTime() >= PolitiqueVerification.DELAI_RENVOI_MS
    );
  }

  expirationDepuis(maintenant = new Date()): Date {
    return new Date(maintenant.getTime() + PolitiqueVerification.DUREE_CODE_MS);
  }
}
