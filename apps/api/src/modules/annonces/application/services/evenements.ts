import type { Prisma } from '@prisma/client';
import type { EvenementOutbox } from '../../../../common/outbox/outbox.types';
import type { OutboxService } from '../../../../common/outbox/outbox.service';

export type PayloadEvenement = Record<string, unknown>;

export function evenement(
  type: string,
  agregatType: string,
  agregatId: string,
  payload: PayloadEvenement,
  traceId?: string,
): EvenementOutbox {
  return {
    type,
    version: 1,
    agregatType,
    agregatId,
    payload,
    ...(traceId ? { traceId } : {}),
  };
}

export async function ecrireEvenements(
  tx: Prisma.TransactionClient,
  outbox: OutboxService,
  evenements: readonly EvenementOutbox[],
): Promise<void> {
  for (const item of evenements) {
    await outbox.enregistrer(tx, item);
  }
}
