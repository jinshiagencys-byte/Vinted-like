import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { InboxService } from './inbox.service';

describe('InboxService', () => {
  it('exécute le handler et écrit la trace inbox dans la même transaction', async () => {
    const create = vi.fn().mockResolvedValue({});
    const tx = {
      inboxEvenement: { create },
    } as unknown as Prisma.TransactionClient;
    const prisma = {
      $transaction: vi.fn(async (callback: (client: Prisma.TransactionClient) => Promise<void>) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const handler = vi.fn().mockResolvedValue(undefined);

    const resultat = await new InboxService(prisma).traiter(
      '11111111-1111-4111-8111-111111111111',
      'test-consommateur',
      handler,
    );

    expect(resultat).toBe('traite');
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        evenementId: '11111111-1111-4111-8111-111111111111',
        consommateur: 'test-consommateur',
      }),
    });
    expect(handler).toHaveBeenCalledWith(tx);
  });

  it('ignore un événement déjà consommé (P2002)', async () => {
    const erreur = new Prisma.PrismaClientKnownRequestError('Doublon', {
      code: 'P2002',
      clientVersion: '6.19.3',
      meta: { target: ['evenement_id', 'consommateur'] },
    });
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(erreur),
    } as unknown as PrismaService;

    const resultat = await new InboxService(prisma).traiter(
      '11111111-1111-4111-8111-111111111111',
      'test-consommateur',
      vi.fn(),
    );

    expect(resultat).toBe('deja_traite');
  });

  it('ne masque pas un P2002 provenant du handler', async () => {
    const erreur = new Prisma.PrismaClientKnownRequestError('Doublon métier', {
      code: 'P2002',
      clientVersion: '6.19.3',
      meta: { target: ['email'] },
    });
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(erreur),
    } as unknown as PrismaService;

    await expect(
      new InboxService(prisma).traiter(
        '11111111-1111-4111-8111-111111111111',
        'test-consommateur',
        vi.fn(),
      ),
    ).rejects.toBe(erreur);
  });
});
