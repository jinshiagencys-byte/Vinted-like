import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { EvenementOutbox } from './outbox.types';

@Injectable()
export class OutboxService {
  /**
   * À appeler avec le client de transaction du cas d'usage : l'événement et
   * l'état métier sont ainsi validés ou annulés ensemble.
   */
  async enregistrer<T extends Record<string, unknown>>(
    tx: Prisma.TransactionClient,
    evenement: EvenementOutbox<T>,
  ): Promise<string> {
    const id = evenement.id ?? randomUUID();

    await tx.outboxEvenement.create({
      data: {
        id,
        type: evenement.type,
        version: evenement.version ?? 1,
        agregatType: evenement.agregatType,
        agregatId: evenement.agregatId,
        payload: evenement.payload as Prisma.InputJsonValue,
        traceId: evenement.traceId ?? null,
      },
    });

    return id;
  }
}
