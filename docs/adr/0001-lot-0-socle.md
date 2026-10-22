# ADR-0001 — Socle du lot 0

- Statut : accepté pour le lot 0
- Date : 22/10/2026
- Portée : M1, prérequis à l’étape 1

## Contexte

Le dépôt ne contenait que la documentation. Le plan M1 a été validé avec un **lot 0
séparé** (D02), avant toute table ou route métier de M1.

## Décisions

1. **Monorepo pnpm** avec `apps/api`, `packages/contracts` et `packages/config`.
2. **NestJS 11 / TypeScript 5.9**, cible Node.js 22. L’environnement de développement
   disponible utilise Node 24 ; le socle est compilé et testé avec cette version, sans
   changer la cible de production.
3. **Prisma 6 / PostgreSQL 16**, migration initiale limitée aux tables `outbox_evenements`
   et `inbox_evenements`.
4. **Outbox dans la transaction métier** ; publication BullMQ avec `jobId` stable et
   reprise des événements non publiés. Consommation idempotente via `inbox_evenements`.
5. **Redis 7 / BullMQ 5** pour la file `outbox`.
6. **Guards transverses** : `JwtAuthGuard` (HS256 + `kid`), `RolesGuard`,
   `ProprietaireGuard` (refus en `404` pour ne pas révéler l’existence d’une ressource).
7. **Erreurs normalisées** : filtre global, `traceId` propagé, aucune fuite de stack.
8. **Tests** : Vitest pour les unités ; Testcontainers pour PostgreSQL/Redis. Le harnais
   d’intégration est présent mais ne s’exécute que si Docker est disponible.

## Conséquences

- L’étape 1 de M1 peut démarrer sur un socle testé : configuration, base, outbox, guards.
- Le client S3/MinIO et OpenAPI restent à faire ; ils ne bloquent pas l’étape 1.
- La migration devra être appliquée avec `prisma migrate deploy` sur une base PostgreSQL 16
  réelle avant les tests d’intégration.
