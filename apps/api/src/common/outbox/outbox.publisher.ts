import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import type { EnveloppeEvenement } from './outbox.types';

interface LigneOutbox {
  id: string;
  type: string;
  version: number;
  agregat_type: string;
  agregat_id: string;
  payload: Prisma.JsonValue;
  trace_id: string | null;
  cree_le: Date;
}

const OUTBOX_QUEUE = 'outbox';
const MAX_TENTATIVES = 5;

@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(OUTBOX_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * Sélectionne un lot avec FOR UPDATE SKIP LOCKED, publie les jobs BullMQ
   * puis marque les événements. La transaction détient les verrous pendant
   * la publication ; en cas d'échec, l'événement reste en attente et sera
   * repris au prochain passage.
   */
  async publierEnAttente(limite = 50): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const lignes = await tx.$queryRaw<LigneOutbox[]>(Prisma.sql`
        SELECT id, type, version, agregat_type, agregat_id, payload,
               trace_id, cree_le
        FROM outbox_evenements
        WHERE publie_le IS NULL
          AND tentatives < ${MAX_TENTATIVES}
        ORDER BY cree_le ASC
        LIMIT ${limite}
        FOR UPDATE SKIP LOCKED
      `);

      let publies = 0;

      for (const ligne of lignes) {
        const enveloppe: EnveloppeEvenement = {
          id: ligne.id,
          type: ligne.type,
          version: ligne.version,
          occurredAt: ligne.cree_le.toISOString(),
          aggregateType: ligne.agregat_type,
          aggregateId: ligne.agregat_id,
          ...(ligne.trace_id ? { traceId: ligne.trace_id } : {}),
          payload: ligne.payload,
        };

        try {
          await this.queue.add('publier', enveloppe, {
            jobId: ligne.id,
            attempts: MAX_TENTATIVES,
            backoff: { type: 'exponential', delay: 1_000 },
            removeOnComplete: 1_000,
            removeOnFail: 5_000,
          });

          await tx.outboxEvenement.update({
            where: { id: ligne.id },
            data: {
              publieLe: new Date(),
              tentatives: { increment: 1 },
              derniereErreur: null,
            },
          });
          publies += 1;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Erreur inconnue';
          this.logger.error(
            { err: error, evenementId: ligne.id },
            'Échec de publication de l’événement outbox',
          );
          await tx.outboxEvenement.update({
            where: { id: ligne.id },
            data: {
              tentatives: { increment: 1 },
              derniereErreur: message.slice(0, 2_000),
            },
          });
        }
      }

      return publies;
    });
  }
}
