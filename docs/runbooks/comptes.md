# Runbook — M1 Comptes et identité

Ce document décrit l’installation, l’exploitation, la recette et le rollback du module M1.
Il ne remplace pas le plan [`docs/modules/comptes-identite.md`](../modules/comptes-identite.md).

## 1. Périmètre

- API NestJS sous `/v1` : inscription, vérification e-mail/téléphone, connexion, refresh,
  déconnexion, profil, adresses, appareils, mot de passe, export RGPD, suppression.
- Mobile Expo Router : parcours visiteur/membre, profil public, états réseau.
- Données PostgreSQL 16 et Redis 7. Aucun autre module (M2+) n’est requis.

## 2. Prérequis

- Node.js 22+ et pnpm 9 (`corepack enable`).
- Docker + Docker Compose pour PostgreSQL 16, Redis 7 (et MinIO si les avatars sont activés
  dans un lot ultérieur).
- Pour le mobile : Expo Go ou un émulateur iOS/Android.

## 3. Configuration

```bash
cp .env.example apps/api/.env
```

Variables obligatoires en production (32 caractères minimum, générées avec
`openssl rand -base64 48`) :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | PostgreSQL 16 |
| `REDIS_URL` | Redis 7 (rate limiting, BullMQ) |
| `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_KID` | jetons d’accès HS256, 15 min |
| `AUTH_CODE_PEPPER` | hachage HMAC des codes e-mail/SMS |
| `AUTH_REFRESH_PEPPER` | hachage des jetons de refresh |
| `AUTH_RESET_PEPPER` | hachage des jetons de réinitialisation |
| `EXPORT_SIGNING_SECRET` | signature des URLs d’export |
| `EXPORT_DIR` | répertoire des archives JSON |

Le mobile lit `EXPO_PUBLIC_API_URL` (par défaut `http://localhost:3000`). Aucun secret
serveur ne doit être exposé dans cette variable.

Ne jamais committer `apps/api/.env`. Les valeurs de `.env.example` sont des marqueurs de
développement, refusées par la validation dès que `NODE_ENV=production`.

## 4. Installation et démarrage

```bash
pnpm install
pnpm prisma:generate
docker compose -f infra/docker/docker-compose.yml up -d
pnpm --filter @secondevie/api prisma:deploy
pnpm --filter @secondevie/api start:dev
```

- Santé : `GET http://localhost:3000/v1/sante`.
- OpenAPI : [`docs/openapi/m1-comptes.yaml`](../openapi/m1-comptes.yaml).
- Mobile : `pnpm --filter @secondevie/mobile start`, puis Expo Go / émulateur.

## 5. Migrations

Ordre appliqué :

1. `20261022130000_lot_0_socle`
2. `20261022140000_m1_comptes`
3. `20261027100000_m1_exports`

```bash
pnpm --filter @secondevie/api prisma:deploy
```

Vérification :

```bash
psql "$DATABASE_URL" -c '\dt'
psql "$DATABASE_URL" -c 'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at;'
```

### Rollback

Les scripts de descente sont dans `infra/migrations/down/`. Ils sont destructifs et ne
doivent être exécutés qu’après sauvegarde et autorisation explicite.

```bash
psql "$DATABASE_URL" -f infra/migrations/down/20261027100000_m1_exports_down.sql
psql "$DATABASE_URL" -f infra/migrations/down/20261022140000_m1_comptes_down.sql
```

Le rollback M1 supprime les tables du module et leurs données. Il ne touche pas au socle
lot 0. Après rollback, retirer les lignes correspondantes de `_prisma_migrations` selon la
procédure Prisma, ou restaurer la sauvegarde.

## 6. Recette CA01–CA06

Les commandes ci-dessous supposent une API locale et un compte de test. Les codes sont lus
dans l’outbox locale (aucun e-mail réel en développement) :

```bash
psql "$DATABASE_URL" -c \
  "SELECT payload FROM outbox_evenements WHERE type = 'notification.envoyer' ORDER BY cree_le DESC LIMIT 1;"
```

| Critère | Preuve automatisée | Vérification manuelle |
|---|---|---|
| CA01 inscription → vérification → session | `comptes-http.integration.spec.ts` | inscription, code, `/v1/moi` |
| CA02 compte non vérifié refusé | même suite, test export `403 email_non_verifie` | export avant vérification |
| CA03 rotation/réutilisation/déconnexion | même suite, test refresh | rejouer un refresh après la grâce |
| CA04 périmètre des données | tests IDOR + profil public | deux comptes, tentative d’accès croisé |
| CA05 suppression et blocages | test suppression/anonymisation | suppression avec mot de passe |
| CA06 concurrence | tests d’intégration PostgreSQL | deux inscriptions simultanées |

Exécution automatisée :

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
RUN_INTEGRATION_TESTS=true pnpm test:integration   # Docker requis
```

Sans Docker local, l’exécution de référence est le job CI `integration` (Testcontainers),
qui applique les migrations puis lance la suite HTTP.

## 7. Exploitation

- **Logs** : Pino, niveau `info`, `traceId` par requête. Aucun mot de passe, code, jeton,
  e-mail, téléphone ni adresse complète ne doit être journalisé. Vérifier avant livraison :
  `pnpm test` couvre les réponses, et la revue grep doit rester vide sur les champs sensibles.
- **Rate limiting** : Redis, clés hachées (IP/e-mail jamais en clair). `429` avec
  `Retry-After`. Verrouillage progressif : 5 échecs → 15 min, 10 → 1 h.
- **Outbox** : les notifications sont écrites dans `outbox_evenements`. En développement,
  aucun envoi réel : le worker journalise et l’échec est absorbé.
- **Exports** : BullMQ `exports`; archives JSON dans `EXPORT_DIR`, URL signée 15 min.
  Purger périodiquement les fichiers expirés.
- **Sessions** : access 15 min, refresh 30 jours, format `v1.<appareilId>.<secret>`,
  rotation avec grâce de 60 s. Une réutilisation hors grâce révoque l’appareil.
- **Appareils** : maximum 10 appareils actifs ; au-delà, révoquer un appareil existant.

## 8. Limites connues

- Suppression **immédiate** et anonymisation : la période de grâce de 30 jours (Q04) n’est
  pas implémentée. Décision D04 provisoire.
- Changement d’e-mail **exclu** de la v1 (Q07/D11) ; changement de pseudo libre dans la
  limite de l’unicité (Q06 non tranchée).
- Export limité au périmètre M1 (Q08/D08 provisoire).
- Aucun port réel M5 (commandes), M7 (litiges) ni M9 (back-office) : les fakes renvoient
  « aucun blocage ». Les blocages de suppression sont couverts par tests unitaires, pas par
  un parcours inter-modules réel.
- Pas de bibliothèque UI mobile (Q11) : composants natifs et Expo Router. Pas encore de
  tests de composants automatisés ; parcours manuel à exécuter sur iOS et Android.
- Limite d’appareils fixée à 10 (Q14 partiellement tranchée).
- OpenAPI maintenu manuellement, pas généré depuis Zod.
- HIBP **fail-open** avec alerte (D13) : une panne laisse passer un mot de passe compromis.
- Aucun envoi réel e-mail/SMS : l’intégration fournisseur reste à brancher.
- Le téléphone est facultatif à l’inscription mais requis avant le premier achat ; le
  contrôle d’achat appartient à M5 et n’est pas encore branché.

## 9. Sécurité et données personnelles

- Jetons mobiles : **Expo SecureStore uniquement**, jamais `AsyncStorage`.
- Réponses : aucun hash, code, jeton de refresh, e-mail d’un tiers ni adresse complète dans
  les profils publics.
- Adresses : accès filtré par propriétaire ; un identifiant d’un autre membre renvoie `404`.
- Export : URL signée courte, `Cache-Control: no-store`, aucune donnée de mot de passe.
- Suppression : anonymisation de l’e-mail, du téléphone, du nom, de la date de naissance,
  des adresses et des appareils ; révocation de toutes les sessions.
- Avant production : révoquer tout jeton GitHub/CI exposé, activer l’alerte HIBP, brancher
  un fournisseur e-mail/SMS, restreindre `CORS_ORIGINS`, et faire relire les migrations.

## 10. Déploiement

Le déploiement est une action distincte, soumise à autorisation. Séquence recommandée :

1. Sauvegarde PostgreSQL.
2. `prisma:deploy` sur une base de préproduction.
3. Recette CA01–CA06 et contrôle des logs.
4. Déploiement API, puis mobile.
5. Surveillance : erreurs `5xx`, `429`, échecs d’export, files BullMQ.
