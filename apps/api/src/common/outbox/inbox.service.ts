import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export type ResultatConsommation = 'traite' | 'deja_traite';

function estDoublonInbox(error: Prisma.PrismaClientKnownRequestError): boolean {
  if (error.code !== 'P2002') return false;

  const cible = error.meta?.target;

  if (Array.isArray(cible)) {
    return cible.includes('evenement_id') && cible.includes('consommateur');
  }

  return typeof cible === 'string' && cible.includes('inbox_evenements');
}

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Exécute le handler dans une transaction avec l'insertion inbox.
   * La clé primaire (evenement_id, consommateur) garantit l'idempotence :
   * un doublon est ignoré, mais le handler n'est pas rejoué.
   */
  async traiter(
    evenementId: string,
    consommateur: string,
    handler: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<ResultatConsommation> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.inboxEvenement.create({
          data: {
            evenementId,
            consommateur,
            traiteLe: new Date(),
          },
        });

        await handler(tx);
      });

      return 'traite';
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && estDoublonInbox(error)) {
        return 'deja_traite';
      }

      throw error;
    }
  }
}
