import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../common/errors/domain-error';
import { CACHE_REFERENTIELS, REFERENTIEL_REPOSITORY } from '../../domain/ports';
import type { CachePort, ReferentielRepository } from '../../domain/ports';
import type { Categorie } from '../../domain/entities';
import {
  versCategorieDto,
  versMarqueDto,
  versTailleDto,
  type CategorieDto,
  type MarqueDto,
  type TailleDto,
} from '../dto/referentiels.dto';
import { normaliserRecherche } from '../../domain/valeurs/texte';

const PREFIXE = 'referentiels:v1';
const DUREE_CACHE = 3_600;
const LIMITE_MARQUES = 20;

export interface CategoriesCachees {
  donnees: CategorieDto[];
  etag: string;
}

@Injectable()
export class ListerReferentiels {
  constructor(
    @Inject(REFERENTIEL_REPOSITORY) private readonly referentiels: ReferentielRepository,
    @Inject(CACHE_REFERENTIELS) private readonly cache: CachePort,
  ) {}

  async categories(): Promise<CategoriesCachees> {
    const cle = `${PREFIXE}:categories`;
    const cachees = await this.cache.lire<CategorieDto[]>(cle);

    if (cachees) {
      return { donnees: cachees, etag: this.etag(cachees) };
    }

    const plates = await this.referentiels.listerCategories();
    const donnees = this.construireArbre(plates);
    await this.cache.ecrire(cle, donnees, DUREE_CACHE);

    return { donnees, etag: this.etag(donnees) };
  }

  async marques(requete: string): Promise<MarqueDto[]> {
    const normalisee = normaliserRecherche(requete);
    const cle = `${PREFIXE}:marques:${normalisee}`;
    const cachees = await this.cache.lire<MarqueDto[]>(cle);

    if (cachees) return cachees;

    const marques = await this.referentiels.rechercherMarques(normalisee, LIMITE_MARQUES);
    const donnees = marques.map(versMarqueDto);
    await this.cache.ecrire(cle, donnees, DUREE_CACHE);

    return donnees;
  }

  async tailles(categorieId: string): Promise<TailleDto[]> {
    const categorie = await this.referentiels.trouverCategorie(categorieId);

    if (!categorie || !categorie.actif) {
      throw new DomainError('categorie_invalide', 'La catégorie est introuvable.', 404);
    }

    const cle = `${PREFIXE}:tailles:${categorieId}`;
    const cachees = await this.cache.lire<TailleDto[]>(cle);

    if (cachees) return cachees;

    const tailles = await this.referentiels.listerTailles(categorieId);
    const donnees = tailles.map(versTailleDto);
    await this.cache.ecrire(cle, donnees, DUREE_CACHE);

    return donnees;
  }

  async invalider(): Promise<void> {
    await this.cache.supprimerParPrefixe(PREFIXE);
  }

  private construireArbre(categories: Categorie[]): CategorieDto[] {
    const parId = new Map(categories.map((categorie) => [categorie.id, categorie]));
    const enfantsParParent = new Map<string | null, Categorie[]>();

    for (const categorie of categories) {
      const parent =
        categorie.parentId && parId.has(categorie.parentId) ? categorie.parentId : null;
      const liste = enfantsParParent.get(parent) ?? [];
      liste.push(categorie);
      enfantsParParent.set(parent, liste);
    }

    const construire = (parentId: string | null, profondeur: number): CategorieDto[] => {
      if (profondeur > 3) return [];

      return (enfantsParParent.get(parentId) ?? [])
        .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, 'fr'))
        .map((categorie) => versCategorieDto(categorie, construire(categorie.id, profondeur + 1)));
    };

    return construire(null, 0);
  }

  private etag(donnees: unknown): string {
    const hash = createHash('sha256').update(JSON.stringify(donnees)).digest('base64url');
    return `"${hash.slice(0, 32)}"`;
  }
}
