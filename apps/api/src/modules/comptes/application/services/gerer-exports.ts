import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../../../common/database/prisma.service';
import { DomainError } from '../../../../common/errors/domain-error';
import type { ExportRepository, StockageExport } from '../../domain/ports';
import { EXPORT_REPOSITORY, STOCKAGE_EXPORT } from '../../domain/ports';
import { LimiteurDebitService } from '../../infrastructure/securite/limiteur-debit.service';
import { EXPORTS_QUEUE, EXPORT_JOB } from './export.constants';
import { ServiceSignatureExport } from './service-signature-export';

export interface ExportResume {
  id: string;
  statut: string;
  urlSignee: string | null;
  expireLe: string | null;
  creeLe: string;
  termineLe: string | null;
}

@Injectable()
export class GererExports {
  constructor(
    @Inject(EXPORT_REPOSITORY) private readonly exports: ExportRepository,
    @Inject(STOCKAGE_EXPORT) private readonly stockage: StockageExport,
    private readonly signature: ServiceSignatureExport,
    private readonly limiteur: LimiteurDebitService,
    private readonly prisma: PrismaService,
    @InjectQueue(EXPORTS_QUEUE) private readonly queue: Queue,
  ) {}

  async demander(utilisateurId: string): Promise<{ exportId: string }> {
    await this.limiteur.consommer(`export:${utilisateurId}`, 3, 3_600);

    const exportCree = await this.exports.creer({ utilisateurId });
    await this.queue.add(
      EXPORT_JOB,
      { exportId: exportCree.id },
      {
        jobId: exportCree.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 500,
        removeOnFail: 1_000,
      },
    );

    return { exportId: exportCree.id };
  }

  async consulter(utilisateurId: string, id: string): Promise<ExportResume> {
    const exportRgpd = await this.exports.trouver(utilisateurId, id);

    if (!exportRgpd) {
      throw new DomainError('export_introuvable', 'Export introuvable.', 404);
    }

    if (
      exportRgpd.statut === 'pret' &&
      exportRgpd.expireLe !== null &&
      exportRgpd.expireLe <= new Date()
    ) {
      await this.exports.marquerExpire(exportRgpd.id, exportRgpd.expireLe);
      exportRgpd.statut = 'expire';
      exportRgpd.urlSignee = null;
    }

    return {
      id: exportRgpd.id,
      statut: exportRgpd.statut,
      urlSignee: exportRgpd.statut === 'pret' ? exportRgpd.urlSignee : null,
      expireLe: exportRgpd.expireLe?.toISOString() ?? null,
      creeLe: exportRgpd.creeLe.toISOString(),
      termineLe: exportRgpd.termineLe?.toISOString() ?? null,
    };
  }

  async executer(exportId: string): Promise<void> {
    const exportRgpd = await this.exports.trouverParId(exportId);

    if (!exportRgpd || exportRgpd.statut !== 'en_attente') {
      return;
    }

    try {
      const utilisateur = await this.prisma.utilisateur.findUnique({
        where: { id: exportRgpd.utilisateurId },
        include: {
          profil: true,
          adresses: true,
          appareils: true,
          verifications: true,
        },
      });

      if (!utilisateur) {
        await this.exports.marquerEchoue(exportId, new Date());
        return;
      }

      const contenu = JSON.stringify(
        {
          genereLe: new Date().toISOString(),
          perimetre: 'M1-comptes',
          compte: {
            id: utilisateur.id,
            email: utilisateur.email,
            telephone: utilisateur.telephone,
            pseudo: utilisateur.pseudo,
            nomComplet: utilisateur.nomComplet,
            dateNaissance: utilisateur.dateNaissance,
            pays: utilisateur.pays,
            statut: utilisateur.statut,
            emailVerifieLe: utilisateur.emailVerifieLe,
            telephoneVerifieLe: utilisateur.telephoneVerifieLe,
            noteMoyenne: utilisateur.noteMoyenne,
            nbVentes: utilisateur.nbVentes,
            nbAchats: utilisateur.nbAchats,
            creeLe: utilisateur.creeLe,
            majLe: utilisateur.majLe,
          },
          profil: utilisateur.profil
            ? {
                avatarUrl: utilisateur.profil.avatarUrl,
                bio: utilisateur.profil.bio,
                tailleCm: utilisateur.profil.tailleCm,
                pointure: utilisateur.profil.pointure,
                stylesPreferes: utilisateur.profil.stylesPreferes,
                visibilite: utilisateur.profil.visibilite,
                langue: utilisateur.profil.langue,
              }
            : null,
          adresses: utilisateur.adresses.map((adresse) => ({
            id: adresse.id,
            libelle: adresse.libelle,
            destinataire: adresse.destinataire,
            ligne1: adresse.ligne1,
            ligne2: adresse.ligne2,
            codePostal: adresse.codePostal,
            ville: adresse.ville,
            pays: adresse.pays,
            telephone: adresse.telephone,
            estDefaut: adresse.estDefaut,
            supprimeeLe: adresse.supprimeeLe,
            creeLe: adresse.creeLe,
          })),
          appareils: utilisateur.appareils.map((appareil) => ({
            id: appareil.id,
            plateforme: appareil.plateforme,
            deviceId: appareil.deviceId,
            derniereActiviteLe: appareil.derniereActiviteLe,
            revoqueLe: appareil.revoqueLe,
            creeLe: appareil.creeLe,
          })),
          verifications: utilisateur.verifications.map((verification) => ({
            id: verification.id,
            type: verification.type,
            statut: verification.statut,
            expireLe: verification.expireLe,
            valideLe: verification.valideLe,
            creeLe: verification.creeLe,
          })),
        },
        null,
        2,
      );

      await this.stockage.ecrire(exportId, contenu);
      const { url, expireLe } = this.signature.signer(exportId, utilisateur.id);
      await this.exports.marquerPret(exportId, url, expireLe, new Date());
    } catch (error: unknown) {
      await this.exports.marquerEchoue(exportId, new Date());
      throw error;
    }
  }

  async telecharger(
    exportId: string,
    expiration: number,
    signature: string,
  ): Promise<{ contenu: string; nomFichier: string }> {
    const exportRgpd = await this.exports.trouverParId(exportId);

    if (!exportRgpd || exportRgpd.statut !== 'pret' || !exportRgpd.expireLe) {
      throw new DomainError('export_introuvable', 'Export introuvable.', 404);
    }

    if (
      !this.signature.verifier(exportId, exportRgpd.utilisateurId, expiration, signature) ||
      exportRgpd.expireLe <= new Date()
    ) {
      throw new DomainError('lien_export_invalide', 'Ce lien a expiré.', 401);
    }

    const contenu = await this.stockage.lire(exportId);

    if (!contenu) {
      throw new DomainError('export_introuvable', 'Export introuvable.', 404);
    }

    return { contenu, nomFichier: `secondevie-export-${exportId}.json` };
  }
}
