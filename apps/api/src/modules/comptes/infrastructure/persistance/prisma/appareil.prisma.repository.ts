import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../common/database/prisma.service';
import type { AppareilRepository, CreerAppareil, RotationRefresh } from '../../../domain/ports';
import type { Appareil } from '../../../domain/entities';
import { versAppareil } from './mappers';

@Injectable()
export class AppareilPrismaRepository implements AppareilRepository {
  constructor(private readonly prisma: PrismaService) {}

  async creer(donnees: CreerAppareil): Promise<Appareil> {
    const row = await this.prisma.appareil.create({
      data: {
        utilisateurId: donnees.utilisateurId,
        plateforme: donnees.plateforme,
        deviceId: donnees.deviceId,
        refreshTokenHash: donnees.refreshTokenHash ?? null,
        refreshTokenExpireLe: donnees.refreshTokenExpireLe ?? null,
        pushToken: donnees.pushToken ?? null,
        derniereActiviteLe: new Date(),
      },
    });

    return versAppareil(row);
  }

  async listerActifs(utilisateurId: string): Promise<Appareil[]> {
    const rows = await this.prisma.appareil.findMany({
      where: { utilisateurId, revoqueLe: null },
      orderBy: { creeLe: 'desc' },
    });

    return rows.map(versAppareil);
  }

  async trouverParId(utilisateurId: string, id: string): Promise<Appareil | null> {
    const row = await this.prisma.appareil.findFirst({
      where: { id, utilisateurId },
    });

    return row ? versAppareil(row) : null;
  }

  async trouverParHash(refreshTokenHash: string): Promise<Appareil | null> {
    const row = await this.prisma.appareil.findFirst({
      where: {
        revoqueLe: null,
        OR: [{ refreshTokenHash }, { refreshTokenPrecedentHash: refreshTokenHash }],
      },
    });

    return row ? versAppareil(row) : null;
  }

  async enregistrerRotation(id: string, rotation: RotationRefresh): Promise<void> {
    await this.prisma.appareil.update({
      where: { id },
      data: {
        refreshTokenHash: rotation.refreshTokenHash,
        refreshTokenPrecedentHash: rotation.refreshTokenPrecedentHash,
        refreshTokenRotatedLe: rotation.refreshTokenRotatedLe,
        refreshTokenExpireLe: rotation.refreshTokenExpireLe,
        derniereActiviteLe: rotation.refreshTokenRotatedLe,
      },
    });
  }

  async revoquer(id: string, revoqueLe: Date): Promise<void> {
    await this.prisma.appareil.updateMany({
      where: { id, revoqueLe: null },
      data: { revoqueLe },
    });
  }

  async mettreAJourPushToken(
    utilisateurId: string,
    deviceId: string,
    pushToken: string,
  ): Promise<void> {
    await this.prisma.appareil.updateMany({
      where: { utilisateurId, deviceId, revoqueLe: null },
      data: { pushToken, derniereActiviteLe: new Date() },
    });
  }
}
