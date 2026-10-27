import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../common/database/prisma.service';
import type { CreerExport, ExportRepository } from '../../../domain/ports';
import type { ExportRgpd } from '../../../domain/entities';
import { versExport } from './mappers';

@Injectable()
export class ExportPrismaRepository implements ExportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async creer(donnees: CreerExport): Promise<ExportRgpd> {
    const row = await this.prisma.exportRgpd.create({
      data: { utilisateurId: donnees.utilisateurId },
    });

    return versExport(row);
  }

  async trouver(utilisateurId: string, id: string): Promise<ExportRgpd | null> {
    const row = await this.prisma.exportRgpd.findFirst({
      where: { id, utilisateurId },
    });

    return row ? versExport(row) : null;
  }

  async trouverParId(id: string): Promise<ExportRgpd | null> {
    const row = await this.prisma.exportRgpd.findUnique({ where: { id } });
    return row ? versExport(row) : null;
  }

  async marquerPret(id: string, urlSignee: string, expireLe: Date, termineLe: Date): Promise<void> {
    await this.prisma.exportRgpd.update({
      where: { id },
      data: { statut: 'pret', urlSignee, expireLe, termineLe },
    });
  }

  async marquerEchoue(id: string, termineLe: Date): Promise<void> {
    await this.prisma.exportRgpd.update({
      where: { id },
      data: { statut: 'echoue', termineLe },
    });
  }

  async marquerExpire(id: string, expireLe: Date): Promise<void> {
    await this.prisma.exportRgpd.update({
      where: { id },
      data: { statut: 'expire', expireLe },
    });
  }
}
