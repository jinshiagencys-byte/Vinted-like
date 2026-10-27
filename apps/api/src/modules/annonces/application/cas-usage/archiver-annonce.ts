import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { DomainError } from '../../../../common/errors/domain-error';
import { OutboxService } from '../../../../common/outbox/outbox.service';
import { AccesAnnonce } from '../services/acces-annonce';
import { ecrireEvenements, evenement } from '../services/evenements';

@Injectable()
export class ArchiverAnnonce {
  constructor(
    private readonly acces: AccesAnnonce,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async executer(
    utilisateurId: string,
    annonceId: string,
  ): Promise<{ id: string; statut: 'archivee'; version: number }> {
    const annonce = await this.acces.proprietaire(annonceId, utilisateurId);

    if (annonce.statut === 'archivee') {
      return { id: annonce.id, statut: 'archivee', version: annonce.version };
    }

    if (annonce.statut === 'reservee' || annonce.statut === 'vendue') {
      throw new DomainError(
        'etat_incompatible',
        'Une annonce réservée ou vendue ne peut pas être archivée.',
        409,
        { statutActuel: annonce.statut },
      );
    }

    const archiveeLe = new Date();
    const actualisee = await this.prisma.$transaction(async (tx) => {
      const maj = await tx.annonce.updateMany({
        where: {
          id: annonceId,
          version: annonce.version,
          statut: { in: ['brouillon', 'en_revue', 'publiee', 'refusee'] },
        },
        data: { statut: 'archivee', archiveeLe, version: { increment: 1 } },
      });

      if (maj.count === 0) return null;

      await ecrireEvenements(tx, this.outbox, [
        evenement('annonce.archivee', 'annonce', annonceId, {
          annonceId,
          raison: 'vendeur',
          archiveeLe: archiveeLe.toISOString(),
        }),
      ]);

      return tx.annonce.findUnique({ where: { id: annonceId } });
    });

    if (!actualisee) {
      const actuelle = await this.acces.trouver(annonceId);
      throw new DomainError(
        'etat_incompatible',
        'L’annonce a été modifiée entre-temps. Rechargez-la.',
        409,
        { versionActuelle: actuelle.version },
      );
    }

    return { id: actualisee.id, statut: 'archivee', version: actualisee.version };
  }
}
