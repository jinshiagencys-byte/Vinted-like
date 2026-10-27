import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../../common/database/prisma.service';
import { DomainError } from '../../../../common/errors/domain-error';
import { OutboxService } from '../../../../common/outbox/outbox.service';
import type { Appareil, Utilisateur } from '../../domain/entities';
import { PolitiqueSession } from '../../domain/policies/politique-session';
import type { AppareilRepository, UtilisateurRepository } from '../../domain/ports';
import { APPAREIL_REPOSITORY, UTILISATEUR_REPOSITORY } from '../../domain/ports';
import { JetonRefresh } from '../../domain/value-objects/jeton-refresh';
import type { AppareilDemande, SessionEmise } from '../types';
import { resumerUtilisateur } from '../types';
import { Inject } from '@nestjs/common';

const JOUR_MS = 24 * 60 * 60 * 1000;
const DUREE_REFRESH_MS = 30 * JOUR_MS;
const PLAFOND_REFRESH_MS = 90 * JOUR_MS;

interface ChargeJeton {
  sub: string;
  role: string;
  emailVerifie: boolean;
  ver: number;
  sid: string;
}

@Injectable()
export class ServiceSessions {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(APPAREIL_REPOSITORY) private readonly appareils: AppareilRepository,
    @Inject(UTILISATEUR_REPOSITORY) private readonly utilisateurs: UtilisateurRepository,
    private readonly politiqueSession: PolitiqueSession,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async ouvrir(utilisateur: Utilisateur, demande: AppareilDemande): Promise<SessionEmise> {
    const secret = JetonRefresh.generer();
    const maintenant = new Date();
    const expireLe = this.expirationRefresh(maintenant, maintenant);

    const appareil = await this.appareils.ouvrirSession({
      utilisateurId: utilisateur.id,
      plateforme: demande.plateforme,
      deviceId: demande.deviceId,
      refreshTokenHash: secret.hacher(this.config.getOrThrow<string>('AUTH_REFRESH_PEPPER')),
      refreshTokenExpireLe: expireLe,
      pushToken: demande.pushToken ?? null,
    });

    await this.fermerAppareilsExcedentaires(utilisateur.id, appareil.id);

    return this.construireSession(
      utilisateur,
      appareil.id,
      `v1.${appareil.id}.${secret.reveler()}`,
    );
  }

  async rafraichir(refreshToken: string): Promise<SessionEmise> {
    const { appareilId, secret } = this.analyser(refreshToken);
    let appareil = await this.appareils.trouverParIdGlobal(appareilId);

    if (!appareil || appareil.revoqueLe !== null) {
      throw new DomainError('refresh_invalide', 'Session expirée ou révoquée.', 401);
    }

    const utilisateur = await this.utilisateurs.trouverParId(appareil.utilisateurId);

    if (!utilisateur || utilisateur.statut === 'suspendu' || utilisateur.statut === 'supprime') {
      await this.appareils.revoquerParId(appareil.id, new Date());
      throw new DomainError('refresh_invalide', 'Session expirée ou révoquée.', 401);
    }

    if (!appareil.refreshTokenExpireLe || appareil.refreshTokenExpireLe <= new Date()) {
      await this.appareils.revoquerParId(appareil.id, new Date());
      throw new DomainError('refresh_invalide', 'Session expirée ou révoquée.', 401);
    }

    const poivre = this.config.getOrThrow<string>('AUTH_REFRESH_PEPPER');
    const hash = JetonRefresh.depuis(secret).hacher(poivre);

    if (appareil.refreshTokenHash === hash) {
      const rotation = await this.rotater(appareil, hash, utilisateur);
      if (rotation) {
        return rotation;
      }

      appareil = await this.appareils.trouverParIdGlobal(appareilId);
      if (!appareil) {
        throw new DomainError('refresh_invalide', 'Session expirée ou révoquée.', 401);
      }
    }

    if (appareil.refreshTokenPrecedentHash === hash) {
      const dansGrace =
        appareil.refreshTokenRotatedLe !== null &&
        this.politiqueSession.estDansGrace(appareil.refreshTokenRotatedLe);

      if (dansGrace) {
        const rotation = await this.rotater(appareil, appareil.refreshTokenHash, utilisateur);
        if (rotation) {
          return rotation;
        }
      }
    }

    await this.compromettre(appareil, utilisateur.id);
    throw new DomainError('refresh_invalide', 'Session expirée ou révoquée.', 401);
  }

  async revoquer(utilisateurId: string, appareilId: string): Promise<void> {
    await this.appareils.revoquer(utilisateurId, appareilId, new Date());
  }

  parseAppareilId(refreshToken: string): string {
    return this.analyser(refreshToken).appareilId;
  }

  private async rotater(
    appareil: Appareil,
    hashAttendu: string | null,
    utilisateur: Utilisateur,
  ): Promise<SessionEmise | null> {
    if (!hashAttendu) {
      return null;
    }

    const maintenant = new Date();
    const secret = JetonRefresh.generer();
    const poivre = this.config.getOrThrow<string>('AUTH_REFRESH_PEPPER');
    const nouveauHash = secret.hacher(poivre);
    const expireLe = this.expirationRefresh(maintenant, appareil.creeLe);

    if (expireLe <= maintenant) {
      await this.appareils.revoquerParId(appareil.id, maintenant);
      return null;
    }

    const reussi = await this.appareils.rotationConditionnelle(appareil.id, hashAttendu, {
      refreshTokenHash: nouveauHash,
      refreshTokenPrecedentHash: hashAttendu,
      refreshTokenRotatedLe: maintenant,
      refreshTokenExpireLe: expireLe,
    });

    if (!reussi) {
      return null;
    }

    return this.construireSession(
      utilisateur,
      appareil.id,
      `v1.${appareil.id}.${secret.reveler()}`,
    );
  }

  private async construireSession(
    utilisateur: Utilisateur,
    appareilId: string,
    refreshToken: string,
  ): Promise<SessionEmise> {
    const charge: ChargeJeton = {
      sub: utilisateur.id,
      role: utilisateur.role,
      emailVerifie: utilisateur.emailVerifieLe !== null,
      ver: utilisateur.versionSecurite,
      sid: appareilId,
    };
    const accessToken = await this.jwt.signAsync(charge);

    return {
      accessToken,
      refreshToken,
      expireDans: 900,
      utilisateur: resumerUtilisateur(utilisateur),
    };
  }

  private analyser(refreshToken: string): { appareilId: string; secret: string } {
    const morceaux = refreshToken.split('.');

    if (morceaux.length !== 3 || morceaux[0] !== 'v1') {
      throw new DomainError('refresh_invalide', 'Jeton de refresh invalide.', 401);
    }

    const appareilId = morceaux[1];
    const secret = morceaux[2];

    if (!appareilId || !secret) {
      throw new DomainError('refresh_invalide', 'Jeton de refresh invalide.', 401);
    }

    JetonRefresh.depuis(secret);
    return { appareilId, secret };
  }

  private expirationRefresh(maintenant: Date, creation: Date): Date {
    return new Date(
      Math.min(maintenant.getTime() + DUREE_REFRESH_MS, creation.getTime() + PLAFOND_REFRESH_MS),
    );
  }

  private async fermerAppareilsExcedentaires(
    utilisateurId: string,
    appareilCourantId: string,
  ): Promise<void> {
    const actifs = await this.appareils.listerActifs(utilisateurId);
    const autres = actifs.filter((appareil) => appareil.id !== appareilCourantId);
    const excedentaires = autres.slice(PolitiqueSession.MAX_APPAREILS_ACTIFS - 1);

    for (const appareil of excedentaires) {
      await this.appareils.revoquer(utilisateurId, appareil.id, new Date());
    }
  }

  private async compromettre(appareil: Appareil, utilisateurId: string): Promise<void> {
    const detecteLe = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.appareil.updateMany({
        where: { id: appareil.id, revoqueLe: null },
        data: { revoqueLe: detecteLe },
      });
      await this.outbox.enregistrer(tx, {
        type: 'securite.session_compromise',
        agregatType: 'appareil',
        agregatId: appareil.id,
        payload: {
          utilisateurId,
          appareilId: appareil.id,
          detecteLe: detecteLe.toISOString(),
        },
      });
    });
  }
}
