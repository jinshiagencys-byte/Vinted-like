import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../common/database/prisma.service';
import type { CreerReinitialisation, ReinitialisationRepository } from '../../../domain/ports';
import type { ReinitialisationMotDePasse } from '../../../domain/entities';
import { versReinitialisation } from './mappers';

@Injectable()
export class ReinitialisationPrismaRepository implements ReinitialisationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async creer(donnees: CreerReinitialisation): Promise<ReinitialisationMotDePasse> {
    const row = await this.prisma.reinitialisationMotDePasse.create({
      data: {
        utilisateurId: donnees.utilisateurId,
        jetonHash: donnees.jetonHash,
        expireLe: donnees.expireLe,
      },
    });

    return versReinitialisation(row);
  }

  async trouverParJetonHash(jetonHash: string): Promise<ReinitialisationMotDePasse | null> {
    const row = await this.prisma.reinitialisationMotDePasse.findUnique({
      where: { jetonHash },
    });

    return row ? versReinitialisation(row) : null;
  }

  async marquerUtilise(id: string, utiliseLe: Date): Promise<void> {
    await this.prisma.reinitialisationMotDePasse.update({
      where: { id },
      data: { utiliseLe },
    });
  }

  async invaliderPourUtilisateur(utilisateurId: string, date: Date): Promise<void> {
    await this.prisma.reinitialisationMotDePasse.updateMany({
      where: { utilisateurId, utiliseLe: null },
      data: { utiliseLe: date },
    });
  }
}
