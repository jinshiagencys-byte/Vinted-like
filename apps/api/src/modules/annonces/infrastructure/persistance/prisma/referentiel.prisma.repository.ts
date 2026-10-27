import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../common/database/prisma.service';
import type { Categorie, Marque, ReferentielTaille } from '../../../domain/entities';
import type { ReferentielRepository } from '../../../domain/ports';
import { normaliserRecherche } from '../../../domain/valeurs/texte';
import { versCategorie, versMarque, versTaille } from './mappers';

@Injectable()
export class ReferentielPrismaRepository implements ReferentielRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listerCategories(): Promise<Categorie[]> {
    const rows = await this.prisma.categorie.findMany({
      where: { actif: true },
      orderBy: [{ niveau: 'asc' }, { ordre: 'asc' }, { nom: 'asc' }],
    });

    return rows.map(versCategorie);
  }

  async trouverCategorie(id: string): Promise<Categorie | null> {
    const row = await this.prisma.categorie.findUnique({ where: { id } });
    return row ? versCategorie(row) : null;
  }

  async compterEnfantsActifs(id: string): Promise<number> {
    return this.prisma.categorie.count({ where: { parentId: id, actif: true } });
  }

  async rechercherMarques(requete: string, limite: number): Promise<Marque[]> {
    const normalisee = normaliserRecherche(requete);

    const rows = await this.prisma.marque.findMany({
      where: {
        actif: true,
        ...(normalisee ? { nomNormalise: { startsWith: normalisee } } : {}),
      },
      orderBy: [{ verifiee: 'desc' }, { nomNormalise: 'asc' }],
      take: limite,
    });

    return rows.map(versMarque);
  }

  async trouverMarque(id: string): Promise<Marque | null> {
    const row = await this.prisma.marque.findUnique({ where: { id } });
    return row ? versMarque(row) : null;
  }

  async listerTailles(categorieId: string): Promise<ReferentielTaille[]> {
    const rows = await this.prisma.referentielTaille.findMany({
      where: { categorieId },
      orderBy: [{ systeme: 'asc' }, { ordre: 'asc' }, { libelle: 'asc' }],
    });

    return rows.map(versTaille);
  }

  async tailleExiste(categorieId: string, libelle: string): Promise<boolean> {
    return (
      (await this.prisma.referentielTaille.count({
        where: { categorieId, libelle: libelle.trim().toUpperCase() },
      })) > 0
    );
  }
}
