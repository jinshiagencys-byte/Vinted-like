import { Inject, Injectable } from '@nestjs/common';
import type { Annonce, Photo } from '../../domain/entities';
import { REFERENTIEL_REPOSITORY } from '../../domain/ports';
import type { ReferentielRepository } from '../../domain/ports';
import type { PayloadEvenement } from './evenements';

/** Projection publique d'une annonce, sans PII, destinée à M3/M8/M9. */
@Injectable()
export class ProjectionAnnonce {
  constructor(
    @Inject(REFERENTIEL_REPOSITORY) private readonly referentiels: ReferentielRepository,
  ) {}

  async construire(annonce: Annonce, photos: Photo[]): Promise<PayloadEvenement> {
    const categorie = annonce.categorieId
      ? await this.referentiels.trouverCategorie(annonce.categorieId)
      : null;
    const marque = annonce.marqueId
      ? await this.referentiels.trouverMarque(annonce.marqueId)
      : null;
    const chemin = categorie
      ? await this.cheminCategorie(categorie.id, categorie.nom, categorie.parentId)
      : [];

    return {
      id: annonce.id,
      reference: annonce.reference,
      vendeurId: annonce.vendeurId,
      titre: annonce.titre,
      description: annonce.description,
      categorie: categorie
        ? { id: categorie.id, nom: categorie.nom, slug: categorie.slug, chemin: chemin.join(' > ') }
        : null,
      marque: marque ? { id: marque.id, nom: marque.nom, slug: marque.slug } : null,
      taille: annonce.taille,
      etat: annonce.etat,
      couleur: annonce.couleur,
      matiere: annonce.matiere,
      prixCents: annonce.prixCents,
      prixOrigineCents: annonce.prixOrigineCents,
      devise: annonce.devise,
      poidsG: annonce.poidsG,
      statut: annonce.statut,
      version: annonce.version,
      majLe: annonce.majLe.toISOString(),
      publieeLe: annonce.publieeLe?.toISOString() ?? null,
      photos: [...photos]
        .sort((a, b) => a.ordre - b.ordre)
        .filter((photo) => photo.statutTraitement === 'traitee')
        .map((photo) => ({
          photoId: photo.id,
          ordre: photo.ordre,
          url: photo.urlVariantes?.m ?? photo.urlVariantes?.l ?? photo.urlVariantes?.s ?? null,
        })),
    };
  }

  private async cheminCategorie(
    id: string,
    nom: string,
    parentId: string | null,
  ): Promise<string[]> {
    const chemin = [nom];
    let courant = parentId;
    let profondeur = 0;

    while (courant && profondeur < 3) {
      const parent = await this.referentiels.trouverCategorie(courant);
      if (!parent) break;
      chemin.unshift(parent.nom);
      courant = parent.parentId;
      profondeur += 1;
    }

    return chemin;
  }
}
