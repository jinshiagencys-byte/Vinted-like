import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../common/database/prisma.service';
import { DomainError } from '../../../../../common/errors/domain-error';
import type { AdresseRepository, CreerAdresse, MiseAJourAdresse } from '../../../domain/ports';
import type { Adresse } from '../../../domain/entities';
import { versAdresse } from './mappers';

@Injectable()
export class AdressePrismaRepository implements AdresseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async creer(donnees: CreerAdresse): Promise<Adresse> {
    const estDefaut = donnees.estDefaut ?? false;

    return this.prisma.$transaction(async (tx) => {
      if (estDefaut) {
        await this.verrouillerUtilisateur(tx, donnees.utilisateurId);
        await tx.adresse.updateMany({
          where: {
            utilisateurId: donnees.utilisateurId,
            estDefaut: true,
            supprimeeLe: null,
          },
          data: { estDefaut: false },
        });
      }

      const row = await tx.adresse.create({
        data: {
          utilisateurId: donnees.utilisateurId,
          libelle: donnees.libelle,
          destinataire: donnees.destinataire,
          ligne1: donnees.ligne1,
          ligne2: donnees.ligne2 ?? null,
          codePostal: donnees.codePostal,
          ville: donnees.ville,
          pays: donnees.pays ?? 'FR',
          telephone: donnees.telephone,
          estDefaut,
        },
      });

      return versAdresse(row);
    });
  }

  async listerActives(utilisateurId: string): Promise<Adresse[]> {
    const rows = await this.prisma.adresse.findMany({
      where: { utilisateurId, supprimeeLe: null },
      orderBy: [{ estDefaut: 'desc' }, { creeLe: 'desc' }],
    });

    return rows.map(versAdresse);
  }

  async trouverActive(utilisateurId: string, id: string): Promise<Adresse | null> {
    const row = await this.prisma.adresse.findFirst({
      where: { id, utilisateurId, supprimeeLe: null },
    });

    return row ? versAdresse(row) : null;
  }

  async mettreAJour(
    utilisateurId: string,
    id: string,
    donnees: MiseAJourAdresse,
  ): Promise<Adresse> {
    const resultat = await this.prisma.adresse.updateMany({
      where: { id, utilisateurId, supprimeeLe: null },
      data: {
        ...(donnees.libelle !== undefined ? { libelle: donnees.libelle } : {}),
        ...(donnees.destinataire !== undefined ? { destinataire: donnees.destinataire } : {}),
        ...(donnees.ligne1 !== undefined ? { ligne1: donnees.ligne1 } : {}),
        ...(donnees.ligne2 !== undefined ? { ligne2: donnees.ligne2 } : {}),
        ...(donnees.codePostal !== undefined ? { codePostal: donnees.codePostal } : {}),
        ...(donnees.ville !== undefined ? { ville: donnees.ville } : {}),
        ...(donnees.pays !== undefined ? { pays: donnees.pays } : {}),
        ...(donnees.telephone !== undefined ? { telephone: donnees.telephone } : {}),
      },
    });

    if (resultat.count === 0) {
      throw new DomainError('adresse_introuvable', 'Adresse introuvable.', 404);
    }

    const row = await this.prisma.adresse.findUniqueOrThrow({ where: { id } });
    return versAdresse(row);
  }

  async marquerSupprimee(utilisateurId: string, id: string, supprimeeLe: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.verrouillerUtilisateur(tx, utilisateurId);

      const adresse = await tx.adresse.findFirst({
        where: { id, utilisateurId, supprimeeLe: null },
      });

      if (!adresse) {
        throw new DomainError('adresse_introuvable', 'Adresse introuvable.', 404);
      }

      await tx.adresse.update({
        where: { id },
        data: { supprimeeLe, estDefaut: false },
      });

      if (adresse.estDefaut) {
        const remplacement = await tx.adresse.findFirst({
          where: { utilisateurId, supprimeeLe: null },
          orderBy: { creeLe: 'desc' },
        });

        if (remplacement) {
          await tx.adresse.update({
            where: { id: remplacement.id },
            data: { estDefaut: true },
          });
        }
      }
    });
  }

  async definirDefaut(utilisateurId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.verrouillerUtilisateur(tx, utilisateurId);

      const adresse = await tx.adresse.findFirst({
        where: { id, utilisateurId, supprimeeLe: null },
      });

      if (!adresse) {
        throw new DomainError('adresse_introuvable', 'Adresse introuvable.', 404);
      }

      await tx.adresse.updateMany({
        where: { utilisateurId, estDefaut: true, supprimeeLe: null },
        data: { estDefaut: false },
      });
      await tx.adresse.update({ where: { id }, data: { estDefaut: true } });
    });
  }

  private async verrouillerUtilisateur(
    tx: Prisma.TransactionClient,
    utilisateurId: string,
  ): Promise<void> {
    const lignes = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "utilisateurs" WHERE "id" = ${utilisateurId}::uuid FOR UPDATE`;

    if (lignes.length === 0) {
      throw new DomainError('utilisateur_introuvable', 'Utilisateur introuvable.', 404);
    }
  }
}
