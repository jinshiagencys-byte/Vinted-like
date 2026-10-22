# SecondeVie

Monorepo du projet SecondeVie. Le lot 0 met en place le socle technique avant le module
M1 (comptes et identité).

## Prérequis

- Node.js 22+ (le socle est testé ici avec Node 24, la cible reste Node 22)
- pnpm 9 (`corepack enable`)
- Docker et Docker Compose pour PostgreSQL 16, Redis 7 et MinIO

## Démarrage local

```bash
cp .env.example apps/api/.env
pnpm install
pnpm prisma:generate
docker compose -f infra/docker/docker-compose.yml up -d
pnpm --filter @secondevie/api prisma:deploy
pnpm --filter @secondevie/api seed
pnpm --filter @secondevie/api start:dev
```

L’API écoute sur `http://localhost:3000/v1`. Le contrôle de santé est disponible sur
`GET /v1/sante` et vérifie PostgreSQL et Redis.

## Commandes utiles

```bash
pnpm test                 # tests unitaires
pnpm test:integration     # tests Testcontainers (Docker requis)
pnpm typecheck
pnpm lint
pnpm build
```

## Structure

```text
apps/api/                 API NestJS
packages/contracts/       contrats partagés (OpenAPI/client à venir)
packages/config/          configuration TypeScript/Prettier partagée
infra/docker/             PostgreSQL, Redis, MinIO
docs/                     architecture, conception, ADR
```

## État du lot 0

- [x] monorepo pnpm, API NestJS, packages partagés
- [x] configuration Zod, filtre d’erreurs, `traceId`
- [x] Prisma, migration outbox/inbox, seed de base (migration non appliquée ici : Docker absent)
- [x] Redis et BullMQ
- [x] outbox/inbox, publisher BullMQ et consommation idempotente
- [x] guards `JwtAuthGuard`, `RolesGuard`, `ProprietaireGuard`
- [x] harnais Testcontainers (PostgreSQL, Redis) — à exécuter avec Docker
- [ ] alerte dead-letter outbox (les événements à 5 échecs restent en attente)
- [ ] client S3/MinIO (utile à l’étape 3 de M1)
- [ ] OpenAPI et client typé (étape 2 de M1)

## Limites de l’environnement de développement

- Node 24 est installé localement ; la cible reste Node 22, également utilisée en CI.
- Docker n’est pas installé sur cette machine : les tests unitaires et le build passent,
  mais les tests Testcontainers sont ignorés et la migration n’a pas été appliquée.
- Il faudra lancer PostgreSQL 16 et Redis 7 avant l’étape 1 de M1.

Le détail des décisions et le plan M1 se trouvent dans
[`docs/modules/comptes-identite.md`](docs/modules/comptes-identite.md).
