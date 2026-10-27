import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../../common/database/prisma.service';
import type { OutboxService } from '../../../../common/outbox/outbox.service';
import type { ProjectionAnnonce } from '../../application/services/projection-annonce';
import type { PhotoRepository, StockageObjetPort, TraitementImagePort } from '../../domain/ports';
import { PhotosProcessor } from '../photos.processor';

function stockageMock() {
  return {
    lire: vi.fn(),
    ecrire: vi.fn(),
    supprimer: vi.fn(),
    urlPublique: vi.fn(),
  } as unknown as StockageObjetPort;
}

function processorAvec(
  prisma: PrismaService,
  stockage: StockageObjetPort,
  photos: PhotoRepository = {} as PhotoRepository,
  images: TraitementImagePort = {} as TraitementImagePort,
  outbox: OutboxService = {} as OutboxService,
) {
  return new PhotosProcessor(prisma, outbox, {} as ProjectionAnnonce, photos, stockage, images);
}

describe('PhotosProcessor', () => {
  it('ne retraite pas une photo déjà traitée', async () => {
    const prisma = {
      photo: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'photo-1',
          annonceId: 'annonce-1',
          statutTraitement: 'traitee',
          mimeType: 'image/webp',
          annonce: { id: 'annonce-1', vendeurId: 'vendeur-1' },
        }),
      },
    } as unknown as PrismaService;
    const stockage = stockageMock();
    const processor = processorAvec(prisma, stockage);

    await processor.process({ data: { photoId: 'photo-1' } } as Job<{ photoId: string }>);

    expect(stockage.lire).not.toHaveBeenCalled();
    expect(stockage.ecrire).not.toHaveBeenCalled();
  });

  it('ne retraite pas une photo déjà rejetée', async () => {
    const prisma = {
      photo: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'photo-1',
          annonceId: 'annonce-1',
          statutTraitement: 'rejetee',
          mimeType: 'image/webp',
          annonce: { id: 'annonce-1', vendeurId: 'vendeur-1' },
        }),
      },
    } as unknown as PrismaService;
    const stockage = stockageMock();
    const processor = processorAvec(prisma, stockage);

    await processor.process({ data: { photoId: 'photo-1' } } as Job<{ photoId: string }>);

    expect(stockage.lire).not.toHaveBeenCalled();
  });

  it('rejette une photo ajoutée après publication si son empreinte est déjà publiée', async () => {
    const tx = {
      photo: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      annonce: { findUnique: vi.fn() },
    };
    const prisma = {
      photo: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'photo-1',
          annonceId: 'annonce-1',
          statutTraitement: 'televersee',
          mimeType: 'image/jpeg',
          annonce: { id: 'annonce-1', vendeurId: 'vendeur-1' },
        }),
      },
      $transaction: vi.fn(async (handler: (client: typeof tx) => Promise<void>) => handler(tx)),
    } as unknown as PrismaService;
    const stockage = stockageMock();
    vi.mocked(stockage.lire).mockResolvedValue(Buffer.from('photo'));
    const images = {
      traiter: vi.fn().mockResolvedValue({ perceptHash: '0000000000000000' }),
    } as unknown as TraitementImagePort;
    const photos = {
      hashPublieAilleurs: vi.fn().mockResolvedValue(true),
    } as unknown as PhotoRepository;
    const outbox = { enregistrer: vi.fn() } as unknown as OutboxService;
    const processor = processorAvec(prisma, stockage, photos, images, outbox);

    await processor.process({ data: { photoId: 'photo-1' } } as Job<{ photoId: string }>);

    expect(tx.photo.updateMany).toHaveBeenCalledWith({
      where: { id: 'photo-1' },
      data: { statutTraitement: 'rejetee', statutModeration: 'refusee' },
    });
    expect(stockage.ecrire).not.toHaveBeenCalled();
    expect(outbox.enregistrer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'photo.traitee',
        payload: expect.objectContaining({ statutTraitement: 'rejetee', motif: 'doublon_exact' }),
      }),
    );
  });
});
