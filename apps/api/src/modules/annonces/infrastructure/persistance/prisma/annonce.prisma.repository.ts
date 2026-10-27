import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../common/database/prisma.service';
import { decoderCurseur, encoderCurseur } from '../../../domain/curseur';
import type { Annonce, AnnonceAvecPhotos } from '../../../domain/entities';
import type { StatutAnnonce } from '../../../domain/enums';
import type {
  AnnonceRepository,
  DonneesAnnonce,
  FiltreMesAnnonces,
  MiseAJourAnnonce,
  PageAnnonces,
  TransitionAnnonce,
} from '../../../domain/ports';
import { versAnnonce, versAnnonceAvecPhotos } from './mappers';

const INCLUSION_PHOTOS = { photos: { orderBy: { ordre: 'asc' as const } } };

@Injectable()
export class AnnoncePrismaRepository implements AnnonceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async creer(donnees: DonneesAnnonce): Promise<Annonce> {
    const row = await this.prisma.annonce.create({ data: donnees });
    return versAnnonce(row);
  }

  async trouverParId(id: string): Promise<AnnonceAvecPhotos | null> {
    const row = await this.prisma.annonce.findUnique({
      where: { id },
      include: INCLUSION_PHOTOS,
    });

    return row ? versAnnonceAvecPhotos(row) : null;
  }

  async modifier(
    id: string,
    version: number,
    donnees: MiseAJourAnnonce,
    statut?: StatutAnnonce,
    motifRefus?: string | null,
  ): Promise<Annonce | null> {
    const resultat = await this.prisma.annonce.updateMany({
      where: { id, version },
      data: {
        ...donnees,
        ...(statut ? { statut } : {}),
        ...(motifRefus !== undefined ? { motifRefus } : {}),
        version: { increment: 1 },
      },
    });

    if (resultat.count === 0) return null;

    const row = await this.prisma.annonce.findUnique({ where: { id } });
    return row ? versAnnonce(row) : null;
  }

  async listerParVendeur(
    vendeurId: string,
    filtre: FiltreMesAnnonces,
  ): Promise<PageAnnonces<AnnonceAvecPhotos>> {
    const curseur = decoderCurseur(filtre.curseur);
    const where: Prisma.AnnonceWhereInput = {
      vendeurId,
      ...(filtre.statut ? { statut: filtre.statut } : {}),
      ...(curseur
        ? {
            OR: [
              { majLe: { lt: curseur.majLe } },
              { majLe: curseur.majLe, id: { lt: curseur.id } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.annonce.findMany({
      where,
      include: INCLUSION_PHOTOS,
      orderBy: [{ majLe: 'desc' }, { id: 'desc' }],
      take: filtre.limite + 1,
    });

    const items = rows.slice(0, filtre.limite).map(versAnnonceAvecPhotos);
    const dernier = items.at(-1);

    return {
      items,
      curseurSuivant:
        rows.length > filtre.limite && dernier ? encoderCurseur(dernier.majLe, dernier.id) : null,
    };
  }

  async compterActives(vendeurId: string): Promise<number> {
    return this.prisma.annonce.count({
      where: { vendeurId, statut: { in: ['en_revue', 'publiee', 'reservee'] } },
    });
  }

  async transitionner(id: string, transition: TransitionAnnonce): Promise<boolean> {
    const resultat = await this.prisma.annonce.updateMany({
      where: { id, statut: { in: [...transition.de] } },
      data: {
        statut: transition.vers,
        version: { increment: 1 },
        ...(transition.publieeLe !== undefined ? { publieeLe: transition.publieeLe } : {}),
        ...(transition.archiveeLe !== undefined ? { archiveeLe: transition.archiveeLe } : {}),
        ...(transition.motifRefus !== undefined ? { motifRefus: transition.motifRefus } : {}),
      },
    });

    return resultat.count > 0;
  }

  async referenceExiste(reference: string): Promise<boolean> {
    return (await this.prisma.annonce.count({ where: { reference } })) > 0;
  }

  async incrementerVues(id: string, nombre: number): Promise<void> {
    if (nombre <= 0) return;

    await this.prisma.annonce.updateMany({
      where: { id },
      data: { nbVues: { increment: nombre } },
    });
  }

  async archiverParVendeur(vendeurId: string): Promise<number> {
    const resultat = await this.prisma.annonce.updateMany({
      where: {
        vendeurId,
        statut: { in: ['brouillon', 'en_revue', 'publiee', 'refusee'] },
      },
      data: {
        statut: 'archivee',
        archiveeLe: new Date(),
        motifRefus: null,
        version: { increment: 1 },
      },
    });

    return resultat.count;
  }

  async supprimerFavorisParAnnonce(annonceId: string): Promise<void> {
    await this.prisma.favori.deleteMany({ where: { annonceId } });
  }
}

export function estStatutAnnonce(valeur: string): valeur is StatutAnnonce {
  return ['brouillon', 'en_revue', 'publiee', 'reservee', 'vendue', 'archivee', 'refusee'].includes(
    valeur,
  );
}
