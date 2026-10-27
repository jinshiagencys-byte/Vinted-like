import { Injectable } from '@nestjs/common';
import { InboxService } from '../../../../common/outbox/inbox.service';

export interface ReputationRecalculerPayload {
  utilisateurId: string;
  noteMoyenne: number;
  nbVentes: number;
  nbAchats: number;
  version: number;
}

export interface CommandeClotureePayload {
  commandeId: string;
  vendeurId: string;
  acheteurId: string;
}

@Injectable()
export class ConsommerEvenements {
  constructor(private readonly inbox: InboxService) {}

  async recalculerReputation(
    evenementId: string,
    payload: ReputationRecalculerPayload,
  ): Promise<'traite' | 'deja_traite' | 'ignore'> {
    if (
      !payload.utilisateurId ||
      !Number.isFinite(payload.version) ||
      !Number.isFinite(payload.noteMoyenne) ||
      payload.noteMoyenne < 0 ||
      payload.noteMoyenne > 5
    ) {
      return 'ignore';
    }

    const resultat = await this.inbox.traiter(
      evenementId,
      'comptes.reputation.recalculer',
      async (tx) => {
        await tx.utilisateur.updateMany({
          where: {
            id: payload.utilisateurId,
            reputationVersion: { lt: payload.version },
          },
          data: {
            noteMoyenne: payload.noteMoyenne,
            nbVentes: Math.max(0, payload.nbVentes),
            nbAchats: Math.max(0, payload.nbAchats),
            reputationVersion: payload.version,
          },
        });
      },
    );

    return resultat;
  }

  async cloturerCommande(
    evenementId: string,
    payload: CommandeClotureePayload,
  ): Promise<'traite' | 'deja_traite' | 'ignore'> {
    if (!payload.vendeurId || !payload.acheteurId) {
      return 'ignore';
    }

    return this.inbox.traiter(evenementId, 'comptes.commande.cloturee', async (tx) => {
      await tx.utilisateur.update({
        where: { id: payload.vendeurId },
        data: { nbVentes: { increment: 1 } },
      });
      await tx.utilisateur.update({
        where: { id: payload.acheteurId },
        data: { nbAchats: { increment: 1 } },
      });
    });
  }
}
