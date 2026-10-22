import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  it('écrit l’événement avec un identifiant applicatif et la version 1', async () => {
    const create = vi.fn().mockResolvedValue({});
    const tx = {
      outboxEvenement: { create },
    } as unknown as Prisma.TransactionClient;

    const service = new OutboxService();
    const id = await service.enregistrer(tx, {
      type: 'compte.cree',
      agregatType: 'utilisateur',
      agregatId: '11111111-1111-4111-8111-111111111111',
      payload: { utilisateurId: '11111111-1111-4111-8111-111111111111' },
      traceId: 'trace-test-1234',
    });

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id,
        type: 'compte.cree',
        version: 1,
        agregatType: 'utilisateur',
        agregatId: '11111111-1111-4111-8111-111111111111',
        traceId: 'trace-test-1234',
      }),
    });
  });

  it('respecte un identifiant et une version fournis', async () => {
    const create = vi.fn().mockResolvedValue({});
    const tx = {
      outboxEvenement: { create },
    } as unknown as Prisma.TransactionClient;
    const id = '22222222-2222-4222-8222-222222222222';

    const service = new OutboxService();
    await service.enregistrer(tx, {
      id,
      type: 'compte.cree',
      version: 2,
      agregatType: 'utilisateur',
      agregatId: id,
      payload: {},
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id, version: 2 }),
    });
  });
});
