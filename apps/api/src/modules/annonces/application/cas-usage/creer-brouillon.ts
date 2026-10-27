import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from '../../../../common/errors/domain-error';
import type { AnnonceAvecPhotos } from '../../domain/entities';
import { ANNONCE_REPOSITORY, REFERENTIEL_REPOSITORY } from '../../domain/ports';
import type { AnnonceRepository, ReferentielRepository } from '../../domain/ports';
import { Reference } from '../../domain/valeurs/reference';
import type { ChampsAnnonceBruts } from '../services/valider-champs-annonce';
import { validerChampsAnnonce, verifierCoherencePrix } from '../services/valider-champs-annonce';

const TENTATIVES_REFERENCE = 5;

@Injectable()
export class CreerBrouillon {
  constructor(
    @Inject(ANNONCE_REPOSITORY) private readonly annonces: AnnonceRepository,
    @Inject(REFERENTIEL_REPOSITORY) private readonly referentiels: ReferentielRepository,
  ) {}

  async executer(vendeurId: string, commande: ChampsAnnonceBruts): Promise<AnnonceAvecPhotos> {
    const donnees = validerChampsAnnonce(commande);
    verifierCoherencePrix(donnees.prixCents ?? null, donnees.prixOrigineCents ?? null);
    await this.verifierReferences(donnees.categorieId, donnees.marqueId);

    for (let tentative = 0; tentative < TENTATIVES_REFERENCE; tentative += 1) {
      try {
        const annonce = await this.annonces.creer({
          vendeurId,
          reference: Reference.generer().valeur,
          ...donnees,
        });

        return { ...annonce, photos: [] };
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          this.concerneReference(error)
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new DomainError(
      'reference_en_collision',
      'Impossible de générer une référence unique. Réessayez.',
      503,
    );
  }

  private concerneReference(error: Prisma.PrismaClientKnownRequestError): boolean {
    const cible = error.meta?.target;
    return Array.isArray(cible)
      ? cible.includes('reference')
      : typeof cible === 'string' && cible.includes('reference');
  }

  private async verifierReferences(
    categorieId: string | null | undefined,
    marqueId: string | null | undefined,
  ): Promise<void> {
    if (categorieId !== undefined && categorieId !== null) {
      const categorie = await this.referentiels.trouverCategorie(categorieId);
      if (!categorie || !categorie.actif) {
        throw new DomainError('categorie_invalide', 'La catégorie est introuvable.', 422);
      }
    }

    if (marqueId !== undefined && marqueId !== null) {
      const marque = await this.referentiels.trouverMarque(marqueId);
      if (!marque || !marque.actif) {
        throw new DomainError('marque_invalide', 'La marque est introuvable.', 422);
      }
    }
  }
}
