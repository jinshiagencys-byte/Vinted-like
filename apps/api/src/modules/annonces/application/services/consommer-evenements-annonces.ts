import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../common/errors/domain-error';
import { InboxService, type ResultatConsommation } from '../../../../common/outbox/inbox.service';
import { OutboxService } from '../../../../common/outbox/outbox.service';
import { CACHE_REFERENTIELS } from '../../domain/ports';
import type { CachePort } from '../../domain/ports';
import { ProjectionAnnonce } from '../services/projection-annonce';
import { ecrireEvenements, evenement } from '../services/evenements';
import { versPhoto } from '../../infrastructure/persistance/prisma/mappers';

export interface CommandeAnnoncePayload {
  annonceId: string;
  commandeId: string;
  vendeurId?: string;
}

export interface DecisionModerationPayload {
  annonceId: string;
  decision: 'approuvee' | 'refusee' | 'masquee';
  motif?: string;
}

export interface InteractionVuePayload {
  annonceId: string;
  nombre: number;
}

@Injectable()
export class ConsommerEvenementsAnnonces {
  constructor(
    private readonly inbox: InboxService,
    private readonly outbox: OutboxService,
    private readonly projection: ProjectionAnnonce,
    @Inject(CACHE_REFERENTIELS) private readonly cache: CachePort,
  ) {}

  async commandePayee(
    evenementId: string,
    payload: CommandeAnnoncePayload,
  ): Promise<ResultatConsommation | 'ignore'> {
    if (!payload?.annonceId || !payload.commandeId) return 'ignore';

    return this.appliquerTransition(
      evenementId,
      'annonces.commande.payee',
      payload,
      'publiee',
      'reservee',
      'annonce.reservee',
      (annonceId) => ({
        annonceId,
        commandeId: payload.commandeId,
        vendeurId: payload.vendeurId ?? null,
        reserveeLe: new Date().toISOString(),
      }),
    );
  }

  async commandeAnnulee(
    evenementId: string,
    payload: CommandeAnnoncePayload,
  ): Promise<ResultatConsommation | 'ignore'> {
    if (!payload?.annonceId || !payload.commandeId) return 'ignore';

    return this.appliquerTransition(
      evenementId,
      'annonces.commande.annulee',
      payload,
      'reservee',
      'publiee',
      'annonce.liberee',
      (annonceId) => ({ annonceId, commandeId: payload.commandeId }),
    );
  }

  async commandeCloturee(
    evenementId: string,
    payload: CommandeAnnoncePayload,
  ): Promise<ResultatConsommation | 'ignore'> {
    if (!payload?.annonceId || !payload.commandeId) return 'ignore';

    return this.appliquerTransition(
      evenementId,
      'annonces.commande.cloturee',
      payload,
      'reservee',
      'vendue',
      'annonce.vendue',
      (annonceId) => ({
        annonceId,
        commandeId: payload.commandeId,
        vendeurId: payload.vendeurId ?? null,
        vendueLe: new Date().toISOString(),
      }),
    );
  }

  async moderationDecision(
    evenementId: string,
    payload: DecisionModerationPayload,
  ): Promise<ResultatConsommation | 'ignore'> {
    if (!payload?.annonceId || !payload.decision) return 'ignore';

    return this.inbox.traiter(evenementId, 'annonces.moderation.decision', async (tx) => {
      const annonce = await tx.annonce.findUnique({
        where: { id: payload.annonceId },
        include: { photos: { orderBy: { ordre: 'asc' } } },
      });

      if (!annonce) {
        throw new DomainError('annonce_introuvable', 'Annonce introuvable.', 404);
      }

      if (annonce.statut === 'vendue') {
        throw new DomainError(
          'etat_incompatible',
          'Une annonce vendue ne peut plus recevoir de décision.',
          409,
          { statutActuel: annonce.statut },
        );
      }

      if (payload.decision === 'approuvee') {
        const publieeLe = annonce.publieeLe ?? new Date();
        await tx.annonce.update({
          where: { id: annonce.id },
          data: { statut: 'publiee', publieeLe, version: { increment: 1 } },
        });

        const miseAJour = await tx.annonce.findUniqueOrThrow({
          where: { id: annonce.id },
          include: { photos: { orderBy: { ordre: 'asc' } } },
        });

        await ecrireEvenements(tx, this.outbox, [
          evenement(
            'annonce.publiee',
            'annonce',
            annonce.id,
            await this.projection.construire(
              {
                ...annonce,
                statut: 'publiee',
                publieeLe,
                version: miseAJour.version,
                majLe: miseAJour.majLe,
              },
              miseAJour.photos.map(versPhoto),
            ),
          ),
        ]);
        return;
      }

      if (payload.decision === 'refusee') {
        await tx.annonce.update({
          where: { id: annonce.id },
          data: {
            statut: 'refusee',
            motifRefus: payload.motif?.slice(0, 300) ?? 'Annonce refusée par la modération.',
            version: { increment: 1 },
          },
        });
        await ecrireEvenements(tx, this.outbox, [
          evenement('annonce.refusee', 'annonce', annonce.id, {
            annonceId: annonce.id,
            motif: payload.motif ?? 'Annonce refusée par la modération.',
            refuseeLe: new Date().toISOString(),
          }),
        ]);
        return;
      }

      await tx.annonce.update({
        where: { id: annonce.id },
        data: { statut: 'archivee', archiveeLe: new Date(), version: { increment: 1 } },
      });
      await ecrireEvenements(tx, this.outbox, [
        evenement('annonce.archivee', 'annonce', annonce.id, {
          annonceId: annonce.id,
          raison: 'moderation',
          archiveeLe: new Date().toISOString(),
        }),
      ]);
    });
  }

  async interactionVue(
    evenementId: string,
    payload: InteractionVuePayload,
  ): Promise<ResultatConsommation | 'ignore'> {
    if (!payload?.annonceId || !Number.isInteger(payload.nombre) || payload.nombre <= 0) {
      return 'ignore';
    }

    return this.inbox.traiter(evenementId, 'annonces.interaction.vue', async (tx) => {
      await tx.annonce.updateMany({
        where: { id: payload.annonceId },
        data: { nbVues: { increment: payload.nombre } },
      });
    });
  }

  async compteStatutModifie(evenementId: string): Promise<ResultatConsommation> {
    return this.inbox.traiter(evenementId, 'annonces.compte.statut', async () => {
      // Le statut du vendeur est lu à chaque consultation : aucune copie à
      // invalider, la visibilité s'applique immédiatement (M2-Q13).
    });
  }

  async compteSupprime(
    evenementId: string,
    payload: { utilisateurId: string },
  ): Promise<ResultatConsommation | 'ignore'> {
    if (!payload?.utilisateurId) return 'ignore';

    return this.inbox.traiter(evenementId, 'annonces.compte.supprime', async (tx) => {
      await tx.annonce.updateMany({
        where: {
          vendeurId: payload.utilisateurId,
          statut: { in: ['brouillon', 'en_revue', 'publiee', 'refusee'] },
        },
        data: {
          statut: 'archivee',
          archiveeLe: new Date(),
          version: { increment: 1 },
        },
      });

      // `favoris.utilisateur_id` n'a pas de FK vers M1 (M2-Q12) : la purge
      // RGPD des favoris déposés par le compte supprimé est donc explicite.
      // On purge aussi les favoris portés par ses annonces ; une seule requête
      // et un seul décompte par annonce évitent tout double décrément.
      const filtrePurge = {
        OR: [
          { utilisateurId: payload.utilisateurId },
          { annonce: { vendeurId: payload.utilisateurId } },
        ],
      };
      const favoris = await tx.favori.findMany({
        where: filtrePurge,
        select: { annonceId: true },
      });
      const parAnnonce = new Map<string, number>();

      for (const favori of favoris) {
        parAnnonce.set(favori.annonceId, (parAnnonce.get(favori.annonceId) ?? 0) + 1);
      }

      await tx.favori.deleteMany({ where: filtrePurge });

      for (const [annonceId, nombre] of parAnnonce) {
        await tx.annonce.updateMany({
          where: { id: annonceId, nbFavoris: { gte: nombre } },
          data: { nbFavoris: { decrement: nombre } },
        });
      }
    });
  }

  async referentielModifie(evenementId: string): Promise<ResultatConsommation> {
    return this.inbox.traiter(evenementId, 'annonces.referentiel', async () => {
      await this.cache.supprimerParPrefixe('referentiels:v1');
    });
  }

  private async appliquerTransition(
    evenementId: string,
    consommateur: string,
    payload: CommandeAnnoncePayload,
    de: 'publiee' | 'reservee',
    vers: 'publiee' | 'reservee' | 'vendue',
    typeEvenement: string,
    payloadEvenement: (annonceId: string) => Record<string, unknown>,
  ): Promise<ResultatConsommation> {
    return this.inbox.traiter(evenementId, consommateur, async (tx) => {
      const maj = await tx.annonce.updateMany({
        where: { id: payload.annonceId, statut: de },
        data: { statut: vers, version: { increment: 1 } },
      });

      if (maj.count === 0) {
        const actuelle = await tx.annonce.findUnique({
          where: { id: payload.annonceId },
          select: { statut: true },
        });

        if (!actuelle) {
          throw new DomainError('annonce_introuvable', 'Annonce introuvable.', 404);
        }

        if (actuelle.statut === vers) return;

        throw new DomainError(
          'etat_incompatible',
          'Transition de commande incompatible avec le statut de l’annonce.',
          409,
          { statutActuel: actuelle.statut, statutAttendu: de },
        );
      }

      await ecrireEvenements(tx, this.outbox, [
        evenement(typeEvenement, 'annonce', payload.annonceId, payloadEvenement(payload.annonceId)),
      ]);
    });
  }
}
