export interface AppareilSession {
  id: string;
  creeLe: Date;
  derniereActiviteLe?: Date | null;
}

/**
 * R07 : au plus 10 appareils actifs, grâce de 60 secondes pour un refresh
 * rotatif, purge après 90 jours d'inactivité.
 */
export class PolitiqueSession {
  static readonly MAX_APPAREILS_ACTIFS = 10;
  static readonly GRACE_REFRESH_MS = 60 * 1000;
  static readonly INACTIVITE_MAX_MS = 90 * 24 * 60 * 60 * 1000;

  appareilsARevoquer(appareils: AppareilSession[]): string[] {
    const tries = [...appareils].sort((a, b) => b.creeLe.getTime() - a.creeLe.getTime());
    return tries.slice(PolitiqueSession.MAX_APPAREILS_ACTIFS).map((appareil) => appareil.id);
  }

  estDansGrace(rotationLe: Date, maintenant = new Date()): boolean {
    return maintenant.getTime() - rotationLe.getTime() <= PolitiqueSession.GRACE_REFRESH_MS;
  }

  estInactif(appareil: AppareilSession, maintenant = new Date()): boolean {
    const reference = appareil.derniereActiviteLe ?? appareil.creeLe;
    return maintenant.getTime() - reference.getTime() > PolitiqueSession.INACTIVITE_MAX_MS;
  }
}
