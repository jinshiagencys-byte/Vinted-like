import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../common/database/prisma.service';
import type { CreerVerification, VerificationRepository } from '../../../domain/ports';
import type { Verification } from '../../../domain/entities';
import type { StatutVerification, TypeVerification } from '../../../domain/enums';
import { versVerification } from './mappers';

@Injectable()
export class VerificationPrismaRepository implements VerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async creer(donnees: CreerVerification): Promise<Verification> {
    const row = await this.prisma.verification.create({
      data: {
        utilisateurId: donnees.utilisateurId,
        type: donnees.type,
        codeHash: donnees.codeHash,
        expireLe: donnees.expireLe,
        fournisseurRef: donnees.fournisseurRef ?? null,
      },
    });

    return versVerification(row);
  }

  async trouverEnAttente(
    utilisateurId: string,
    type: TypeVerification,
  ): Promise<Verification | null> {
    const row = await this.prisma.verification.findFirst({
      where: { utilisateurId, type, statut: 'en_attente' },
      orderBy: { creeLe: 'desc' },
    });

    return row ? versVerification(row) : null;
  }

  async incrementerTentatives(id: string): Promise<Verification> {
    const row = await this.prisma.verification.update({
      where: { id },
      data: { tentatives: { increment: 1 } },
    });

    return versVerification(row);
  }

  async marquerStatut(
    id: string,
    statut: StatutVerification,
    date: Date | null = null,
  ): Promise<Verification> {
    const row = await this.prisma.verification.update({
      where: { id },
      data: {
        statut,
        ...(statut === 'valide' ? { valideLe: date ?? new Date() } : {}),
      },
    });

    return versVerification(row);
  }

  async invaliderEnAttente(
    utilisateurId: string,
    type: TypeVerification,
    statut: StatutVerification,
  ): Promise<number> {
    const resultat = await this.prisma.verification.updateMany({
      where: { utilisateurId, type, statut: 'en_attente' },
      data: { statut },
    });

    return resultat.count;
  }

  async compterDepuis(
    utilisateurId: string,
    type: TypeVerification,
    depuis: Date,
  ): Promise<number> {
    return this.prisma.verification.count({
      where: { utilisateurId, type, creeLe: { gte: depuis } },
    });
  }

  async purgerPourUtilisateur(utilisateurId: string, date: Date): Promise<void> {
    await this.prisma.verification.updateMany({
      where: { utilisateurId, statut: 'en_attente' },
      data: { statut: 'expire', codeHash: null, expireLe: date },
    });
  }
}
