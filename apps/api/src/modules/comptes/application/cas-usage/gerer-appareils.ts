import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../common/errors/domain-error';
import type { AppareilRepository } from '../../domain/ports';
import { APPAREIL_REPOSITORY } from '../../domain/ports';

export interface AppareilResume {
  id: string;
  plateforme: string;
  deviceId: string;
  derniereActiviteLe: string | null;
  creeLe: string;
}

@Injectable()
export class GererAppareils {
  constructor(@Inject(APPAREIL_REPOSITORY) private readonly appareils: AppareilRepository) {}

  async lister(utilisateurId: string): Promise<AppareilResume[]> {
    const appareils = await this.appareils.listerActifs(utilisateurId);

    return appareils.map((appareil) => ({
      id: appareil.id,
      plateforme: appareil.plateforme,
      deviceId: appareil.deviceId,
      derniereActiviteLe: appareil.derniereActiviteLe?.toISOString() ?? null,
      creeLe: appareil.creeLe.toISOString(),
    }));
  }

  async revoquer(utilisateurId: string, id: string): Promise<void> {
    const appareil = await this.appareils.trouverParId(utilisateurId, id);

    if (!appareil) {
      throw new DomainError('appareil_introuvable', 'Appareil introuvable.', 404);
    }

    await this.appareils.revoquer(utilisateurId, id, new Date());
  }

  async mettreAJourPushToken(
    utilisateurId: string,
    deviceId: string,
    pushToken: string,
  ): Promise<void> {
    const appareil = await this.appareils.trouverParDeviceId(utilisateurId, deviceId);

    if (!appareil || appareil.revoqueLe !== null) {
      throw new DomainError('appareil_introuvable', 'Appareil introuvable.', 404);
    }

    await this.appareils.mettreAJourPushToken(utilisateurId, deviceId, pushToken);
  }
}
