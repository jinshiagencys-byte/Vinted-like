import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../common/database/prisma.service';
import { OutboxService } from '../../../../common/outbox/outbox.service';
import { logger } from '../../../../common/observability/logger';
import type { MessageNotification, NotificationPort } from '../../domain/ports';

/**
 * Écrit la notification dans l'outbox transactionnel. Un échec d'écriture ne
 * doit jamais rendre le compte inutilisable : le renvoi de code reste possible.
 * Aucune donnée du message n'est journalisée.
 */
@Injectable()
export class NotificationOutboxAdapter implements NotificationPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async envoyer(message: MessageNotification): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.outbox.enregistrer(tx, {
          type: 'notification.envoyer',
          agregatType: 'notification',
          agregatId: message.utilisateurId ?? randomUUID(),
          payload: {
            canal: message.canal,
            destinataire: message.destinataire,
            modele: message.modele,
            variables: message.variables,
            ...(message.utilisateurId ? { utilisateurId: message.utilisateurId } : {}),
          },
        });
      });
    } catch (error: unknown) {
      logger.warn(
        { err: error, modele: message.modele },
        'Notification non enregistrée dans l’outbox — le renvoi reste possible',
      );
    }
  }
}
