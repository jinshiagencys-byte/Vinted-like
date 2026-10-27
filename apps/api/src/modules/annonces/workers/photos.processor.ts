import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../../common/database/prisma.service';
import { DomainError } from '../../../common/errors/domain-error';
import { OutboxService } from '../../../common/outbox/outbox.service';
import { ProjectionAnnonce } from '../application/services/projection-annonce';
import {
  cleOriginale,
  cleTemporaire,
  cleVariante,
  VARIANTES_PHOTO,
} from '../application/services/cles-photo';
import { ecrireEvenements, evenement } from '../application/services/evenements';
import { PHOTOS_QUEUE } from '../application/services/photos.constants';
import { estQuasiDoublon } from '../domain/politiques/politique-doublon';
import { PHOTO_REPOSITORY, STOCKAGE_OBJET, TRAITEMENT_IMAGE } from '../domain/ports';
import type { PhotoRepository, StockageObjetPort, TraitementImagePort } from '../domain/ports';
import { versAnnonceAvecPhotos } from '../infrastructure/persistance/prisma/mappers';

interface JobPhoto {
  photoId: string;
}

@Processor(PHOTOS_QUEUE)
export class PhotosProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly projection: ProjectionAnnonce,
    @Inject(PHOTO_REPOSITORY) private readonly photos: PhotoRepository,
    @Inject(STOCKAGE_OBJET) private readonly stockage: StockageObjetPort,
    @Inject(TRAITEMENT_IMAGE) private readonly images: TraitementImagePort,
  ) {
    super();
  }

  async process(job: Job<JobPhoto>): Promise<void> {
    const photo = await this.prisma.photo.findUnique({
      where: { id: job.data.photoId },
      include: { annonce: { select: { id: true, vendeurId: true } } },
    });

    if (!photo) return;

    // Rejeu BullMQ après un commit réussi (ou une photo déjà rejetée) :
    // ne pas relire un objet temporaire déjà supprimé.
    if (photo.statutTraitement === 'traitee' || photo.statutTraitement === 'rejetee') return;

    const mimeType = photo.mimeType ?? 'image/jpeg';
    const cleSource = cleTemporaire(photo.annonceId, photo.id, mimeType);

    try {
      const contenu = await this.stockage.lire(cleSource);
      const traitee = await this.images.traiter(contenu);

      // Une photo ajoutée après publication repasse par les contrôles de
      // doublon (M2-Q8) avant d'être publiée dans la galerie.
      if (await this.photos.hashPublieAilleurs(traitee.perceptHash, photo.annonceId)) {
        await this.rejeter(photo.id, photo.annonceId, 'doublon_exact');
        await this.supprimerSansEchec(cleSource);
        return;
      }

      const hashes = await this.photos.hashesDuVendeur(photo.annonce.vendeurId, photo.id);
      const quasiDoublon = estQuasiDoublon(traitee.perceptHash, hashes);

      const cleOriginal = cleOriginale(photo.annonceId, photo.id, traitee.extension);
      const clesVariantes: Record<string, string> = {};
      const urlsVariantes: Record<string, string> = {};

      for (const variante of VARIANTES_PHOTO) {
        const contenuVariante = traitee.variantes[variante];

        if (!contenuVariante) continue;

        const cle = cleVariante(photo.annonceId, photo.id, variante, traitee.extension);
        clesVariantes[variante] = cle;
        urlsVariantes[variante] = `${this.stockage.urlPublique(cle)}?v=${traitee.perceptHash}`;
      }

      await this.stockage.ecrire(cleOriginal, traitee.original, 'image/webp');

      for (const [variante, contenuVariante] of Object.entries(traitee.variantes)) {
        const cle = clesVariantes[variante];
        if (!cle) continue;
        await this.stockage.ecrire(cle, contenuVariante, 'image/webp');
      }

      await this.prisma.$transaction(async (tx) => {
        const majPhoto = await tx.photo.updateMany({
          where: { id: photo.id },
          data: {
            urlOriginale: cleOriginal,
            urlVariantes: urlsVariantes,
            largeur: traitee.largeur,
            hauteur: traitee.hauteur,
            perceptHash: traitee.perceptHash,
            tailleOctets: traitee.original.length,
            mimeType: 'image/webp',
            statutTraitement: 'traitee',
            statutModeration: quasiDoublon ? 'a_verifier' : 'ok',
          },
        });

        if (majPhoto.count === 0) return;

        const annonce = await tx.annonce.findUnique({
          where: { id: photo.annonceId },
          select: { id: true, statut: true },
        });

        if (!annonce) return;

        const evenements = [
          evenement('photo.traitee', 'photo', photo.id, {
            annonceId: photo.annonceId,
            photoId: photo.id,
            statutTraitement: 'traitee',
          }),
        ];

        if (quasiDoublon && annonce.statut === 'publiee') {
          await tx.annonce.update({
            where: { id: annonce.id },
            data: { statut: 'en_revue', version: { increment: 1 } },
          });
          evenements.push(
            evenement('moderation.demande', 'annonce', annonce.id, {
              annonceId: annonce.id,
              raisons: ['quasi_doublon'],
              photosSignalees: [photo.id],
              source: 'photo',
            }),
          );
        }

        // Une photo traitée modifie la galerie publique : M3 doit réindexer.
        if (annonce.statut === 'publiee') {
          const ligne = await tx.annonce.findUnique({
            where: { id: annonce.id },
            include: { photos: { orderBy: { ordre: 'asc' } } },
          });

          if (ligne) {
            const actualisee = versAnnonceAvecPhotos(ligne);
            evenements.push(
              evenement(
                'annonce.mise_a_jour',
                'annonce',
                annonce.id,
                await this.projection.construire(actualisee, actualisee.photos),
              ),
            );
          }
        }

        await ecrireEvenements(tx, this.outbox, evenements);
      });

      await this.supprimerSansEchec(cleSource);
    } catch (error: unknown) {
      if (!(error instanceof DomainError)) {
        throw error;
      }

      await this.rejeter(photo.id, photo.annonceId, error.code);
      await this.supprimerSansEchec(cleSource);
    }
  }

  private async rejeter(photoId: string, annonceId: string, motif: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const maj = await tx.photo.updateMany({
        where: { id: photoId },
        data: { statutTraitement: 'rejetee', statutModeration: 'refusee' },
      });

      if (maj.count === 0) return;

      await ecrireEvenements(tx, this.outbox, [
        evenement('photo.traitee', 'photo', photoId, {
          annonceId,
          photoId,
          statutTraitement: 'rejetee',
          motif,
        }),
      ]);
    });
  }

  private async supprimerSansEchec(cle: string): Promise<void> {
    try {
      await this.stockage.supprimer(cle);
    } catch {
      // Nettoyage compensé par la règle de cycle de vie du bucket.
    }
  }
}
