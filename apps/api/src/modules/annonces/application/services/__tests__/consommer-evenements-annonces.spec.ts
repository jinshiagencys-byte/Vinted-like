import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { InboxService } from '../../../../../common/outbox/inbox.service';
import type { OutboxService } from '../../../../../common/outbox/outbox.service';
import type { CachePort } from '../../../domain/ports';
import type { ProjectionAnnonce } from '../projection-annonce';
import { ConsommerEvenementsAnnonces } from '../consommer-evenements-annonces';

function serviceAvec(tx: Prisma.TransactionClient) {
  const inbox = {
    traiter: vi.fn(
      async (
        _evenementId: string,
        _consommateur: string,
        handler: (client: Prisma.TransactionClient) => Promise<void>,
      ) => {
        await handler(tx);
        return 'traite' as const;
      },
    ),
  } as unknown as InboxService;

  return new ConsommerEvenementsAnnonces(
    inbox,
    {} as OutboxService,
    {} as ProjectionAnnonce,
    {} as CachePort,
  );
}

describe('ConsommerEvenementsAnnonces — compte.supprime', () => {
  it('archive les annonces et purge les favoris du compte sans FK', async () => {
    const tx = {
      annonce: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      favori: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { annonceId: 'annonce-1' },
            { annonceId: 'annonce-1' },
            { annonceId: 'annonce-2' },
          ]),
        deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
    } as unknown as Prisma.TransactionClient;

    const resultat = await serviceAvec(tx).compteSupprime('evenement-1', {
      utilisateurId: 'utilisateur-1',
    });

    expect(resultat).toBe('traite');
    expect(tx.annonce.updateMany).toHaveBeenCalledWith({
      where: {
        vendeurId: 'utilisateur-1',
        statut: { in: ['brouillon', 'en_revue', 'publiee', 'refusee'] },
      },
      data: {
        statut: 'archivee',
        archiveeLe: expect.any(Date),
        version: { increment: 1 },
      },
    });
    expect(tx.favori.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ utilisateurId: 'utilisateur-1' }, { annonce: { vendeurId: 'utilisateur-1' } }],
      },
      select: { annonceId: true },
    });
    expect(tx.favori.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ utilisateurId: 'utilisateur-1' }, { annonce: { vendeurId: 'utilisateur-1' } }],
      },
    });
    expect(tx.annonce.updateMany).toHaveBeenCalledWith({
      where: { id: 'annonce-1', nbFavoris: { gte: 2 } },
      data: { nbFavoris: { decrement: 2 } },
    });
    expect(tx.annonce.updateMany).toHaveBeenCalledWith({
      where: { id: 'annonce-2', nbFavoris: { gte: 1 } },
      data: { nbFavoris: { decrement: 1 } },
    });
  });
});
