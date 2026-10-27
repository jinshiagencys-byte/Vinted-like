import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../common/database/prisma.service';
import type {
  AppareilRepository,
  CreerAppareil,
  OuvrirSessionAppareil,
  RotationRefresh,
} from '../../../domain/ports';
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

  async trouverParIdGlobal(id: string): Promise<Appareil | null> {
    const row = await this.prisma.appareil.findUnique({ where: { id } });
    return row ? versAppareil(row) : null;
  }

  async trouverParDeviceId(utilisateurId: string, deviceId: string): Promise<Appareil | null> {
    const row = await this.prisma.appareil.findUnique({
      where: { utilisateurId_deviceId: { utilisateurId, deviceId } },
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

  async ouvrirSession(donnees: OuvrirSessionAppareil): Promise<Appareil> {
    const row = await this.prisma.appareil.upsert({
      where: {
        utilisateurId_deviceId: {
          utilisateurId: donnees.utilisateurId,
          deviceId: donnees.deviceId,
        },
      },
      create: {
        utilisateurId: donnees.utilisateurId,
        plateforme: donnees.plateforme,
        deviceId: donnees.deviceId,
        refreshTokenHash: donnees.refreshTokenHash,
        refreshTokenExpireLe: donnees.refreshTokenExpireLe,
        pushToken: donnees.pushToken ?? null,
        derniereActiviteLe: new Date(),
      },
      update: {
        plateforme: donnees.plateforme,
        refreshTokenHash: donnees.refreshTokenHash,
        refreshTokenPrecedentHash: null,
        refreshTokenRotatedLe: null,
        refreshTokenExpireLe: donnees.refreshTokenExpireLe,
        pushToken: donnees.pushToken ?? null,
        derniereActiviteLe: new Date(),
        revoqueLe: null,
      },
    });

    return versAppareil(row);
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

  async rotationConditionnelle(
    id: string,
    hashAttendu: string,
    rotation: RotationRefresh,
  ): Promise<boolean> {
    const resultat = await this.prisma.appareil.updateMany({
      where: { id, refreshTokenHash: hashAttendu, revoqueLe: null },
      data: {
        refreshTokenHash: rotation.refreshTokenHash,
        refreshTokenPrecedentHash: rotation.refreshTokenPrecedentHash,
        refreshTokenRotatedLe: rotation.refreshTokenRotatedLe,
        refreshTokenExpireLe: rotation.refreshTokenExpireLe,
        derniereActiviteLe: rotation.refreshTokenRotatedLe,
      },
    });

    return resultat.count === 1;
  }

  async revoquer(utilisateurId: string, id: string, revoqueLe: Date): Promise<void> {
    await this.prisma.appareil.updateMany({
      where: { id, utilisateurId, revoqueLe: null },
      data: { revoqueLe },
    });
  }

  async revoquerParId(id: string, revoqueLe: Date): Promise<void> {
    await this.prisma.appareil.updateMany({
      where: { id, revoqueLe: null },
      data: { revoqueLe },
    });
  }

  async revoquerTous(utilisateurId: string, revoqueLe: Date): Promise<void> {
    await this.prisma.appareil.updateMany({
      where: { utilisateurId, revoqueLe: null },
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
