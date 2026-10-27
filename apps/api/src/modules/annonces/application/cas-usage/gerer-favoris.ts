import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { DomainError } from '../../../../common/errors/domain-error';
import { OutboxService } from '../../../../common/outbox/outbox.service';
import type { Annonce, AnnonceAvecPhotos } from '../../domain/entities';
import { ANNONCE_REPOSITORY, COMPTES_QUERY, FAVORI_REPOSITORY } from '../../domain/ports';
import type {
  AnnonceRepository,
  ComptesQueryPort,
  FavoriRepository,
  PageAnnonces,
} from '../../domain/ports';
import { peutVoir } from '../../domain/politiques/politique-visibilite';
import { ecrireEvenements, evenement } from '../services/evenements';

@Injectable()
export class GererFavoris {
  constructor(
    @Inject(ANNONCE_REPOSITORY) private readonly annonces: AnnonceRepository,
    @Inject(FAVORI_REPOSITORY) private readonly favoris: FavoriRepository,
    @Inject(COMPTES_QUERY) private readonly comptes: ComptesQueryPort,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async ajouter(
    utilisateurId: string,
    annonceId: string,
  ): Promise<{ annonceId: string; favori: true; nbFavoris: number }> {
    const annonce = await this.annonceVisible(annonceId);

    await this.prisma.$transaction(async (tx) => {
      const creation = await tx.favori.createMany({
        data: [{ utilisateurId, annonceId }],
        skipDuplicates: true,
      });

      if (creation.count === 0) return false;

      await tx.annonce.update({
        where: { id: annonceId },
        data: { nbFavoris: { increment: 1 } },
      });

      await ecrireEvenements(tx, this.outbox, [
        evenement('favori.ajoute', 'annonce', annonceId, { utilisateurId, annonceId }),
      ]);

      return true;
    });

    const nbFavoris = await this.favoris.compter(annonceId);
    return { annonceId: annonce.id, favori: true, nbFavoris };
  }

  async retirer(
    utilisateurId: string,
    annonceId: string,
  ): Promise<{ annonceId: string; favori: false; nbFavoris: number }> {
    await this.prisma.$transaction(async (tx) => {
      const suppression = await tx.favori.deleteMany({ where: { utilisateurId, annonceId } });

      if (suppression.count === 0) return;

      await tx.annonce.updateMany({
        where: { id: annonceId, nbFavoris: { gt: 0 } },
        data: { nbFavoris: { decrement: 1 } },
      });

      await ecrireEvenements(tx, this.outbox, [
        evenement('favori.retire', 'annonce', annonceId, { utilisateurId, annonceId }),
      ]);
    });

    const nbFavoris = await this.favoris.compter(annonceId);
    return { annonceId, favori: false, nbFavoris };
  }

  listerFavoris(
    utilisateurId: string,
    curseur: string | undefined,
    limite: number,
  ): Promise<PageAnnonces<AnnonceAvecPhotos>> {
    return this.favoris.lister(utilisateurId, curseur, limite);
  }

  private async annonceVisible(annonceId: string): Promise<Annonce> {
    const annonce = await this.annonces.trouverParId(annonceId);

    if (!annonce) {
      throw new DomainError('annonce_introuvable', 'Annonce introuvable.', 404);
    }

    const vendeur = await this.comptes.profilVendeur(annonce.vendeurId);

    if (!peutVoir(annonce, vendeur?.statut ?? 'supprime')) {
      throw new DomainError('annonce_introuvable', 'Annonce introuvable.', 404);
    }

    return annonce;
  }
}
