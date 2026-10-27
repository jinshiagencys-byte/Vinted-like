# Runbook — M2 Annonces et catalogue

Ce document décrit l’installation, l’exploitation, la recette et le rollback du module M2.
Il ne remplace pas le plan [`docs/modules/M2-annonces-catalogue.md`](../modules/M2-annonces-catalogue.md)
ni la conception [`docs/conception/M2-annonces-catalogue.md`](../conception/M2-annonces-catalogue.md).

## 1. Périmètre

- API NestJS sous `/v1` : brouillons, édition, consultation publique, photos, publication,
  archivage, republication, favoris, référentiels.
- Worker BullMQ `photos` : validation magic bytes, rotation EXIF, suppression des
  métadonnées, variantes WebP `s/m/l`, pHash.
- Dépendances : PostgreSQL 16, Redis 7, stockage S3/MinIO, M1 pour les comptes et les jetons.
- Hors périmètre M2 : recherche (M3), commandes (M5), décisions de modération (M7),
  back-office (M9), écrans mobiles M2.

## 2. Prérequis

- Node.js 22+ et pnpm 9 (`corepack enable`).
- Docker + Docker Compose pour PostgreSQL, Redis et MinIO.
- Un bucket S3 en production, avec les préfixes `variantes/` publics et `originaux/`,
  `tmp/` privés.

## 3. Configuration

```bash
cp .env.example apps/api/.env
```

Variables M2 :

| Variable | Rôle | Défaut local |
|---|---|---|
| `S3_ENDPOINT` | Endpoint S3/MinIO | `http://localhost:9000` |
| `S3_REGION` | Région S3 | `eu-west-1` |
| `S3_ACCESS_KEY_ID` | Clé d’accès | `secondevie` |
| `S3_SECRET_ACCESS_KEY` | Secret d’accès | `secondevie-secret` |
| `S3_BUCKET` | Bucket | `secondevie` |
| `S3_PUBLIC_BASE_URL` | Base des URLs publiques de variantes | `http://localhost:9000/secondevie` |
| `S3_FORCE_PATH_STYLE` | Style de chemin MinIO | `true` |
| `S3_PRESIGN_SECONDS` | Durée des URLs PUT signées | `900` |

En production, `NODE_ENV=production` refuse les marqueurs de développement
(`change-me…`, identifiants MinIO par défaut). `S3_PUBLIC_BASE_URL` doit pointer vers le
CDN ou le domaine public du bucket, jamais vers un préfixe privé.

## 4. Installation et démarrage

```bash
pnpm install
pnpm prisma:generate
docker compose -f infra/docker/docker-compose.yml up -d
pnpm --filter @secondevie/api prisma:deploy
pnpm --filter @secondevie/api seed
pnpm --filter @secondevie/api start:dev
```

Le service `minio-init` crée le bucket `secondevie` et ouvre la lecture anonyme sur
`variantes/` uniquement. Vérifier :

```bash
docker compose -f infra/docker/docker-compose.yml logs minio-init
curl -I http://localhost:9000/secondevie/variantes/exemple/s.webp
```

Le `seed` est idempotent et versionné (`infra/scripts/seed/referentiels.v1.json`). Il crée
les catégories, les marques et les grilles de tailles. Les référentiels sont en lecture
seule dans M2.

## 5. Migrations

Ordre appliqué :

1. `20261022130000_lot_0_socle`
2. `20261022140000_m1_comptes`
3. `20261027100000_m1_exports`
4. `20261028090000_m2_annonces`

```bash
pnpm --filter @secondevie/api prisma:deploy
psql "$DATABASE_URL" -c '\dt'
psql "$DATABASE_URL" -c 'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at;'
```

### Contraintes manuelles

La migration M2 porte des éléments non exprimables dans `schema.prisma` :

- `photos_ordre_unique UNIQUE (annonce_id, ordre) DEFERRABLE INITIALLY DEFERRED`, qui
  permet de réordonner les photos dans une transaction ;
- les index partiels d’unicité des catégories racines et des noms par parent ;
- les contraintes `CHECK` métier (`annonce_complete_si_soumise`, bornes de prix et de
  poids, date de publication, motif de refus, ordre photo positif, compteurs positifs).

Ne pas régénérer cette migration sans reporter ces contraintes, sinon Prisma proposera de
les supprimer. Le schéma Prisma reste la source des modèles ; la migration reste la source
des contraintes SQL avancées. Vérification rapide après déploiement :

```bash
psql "$DATABASE_URL" -c "SELECT conname, contype FROM pg_constraint WHERE conrelid IN ('annonces'::regclass, 'photos'::regclass, 'categories'::regclass, 'favoris'::regclass) ORDER BY conname;"
psql "$DATABASE_URL" -c "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('categories', 'photos') ORDER BY indexname;"
```

### Rollback

```bash
psql "$DATABASE_URL" -f infra/migrations/down/20261028090000_m2_annonces_down.sql
```

Le rollback supprime les tables M2 et leurs données. Il ne touche pas aux comptes M1. Les
favoris n’ayant pas de FK vers `utilisateurs` (M2-Q12), aucune contrainte M1 ne bloque la
descente. Après rollback, retirer la ligne de `_prisma_migrations` selon la procédure
Prisma ou restaurer la sauvegarde.

## 6. Parcours de recette

Les commandes supposent une API locale et un compte vérifié (`ACCESS` = jeton d’accès).

### 6.1 Créer et compléter un brouillon

```bash
annonce=$(curl -s -X POST http://localhost:3000/v1/annonces \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' -d '{}')
id=$(echo "$annonce" | jq -r .id)
version=$(echo "$annonce" | jq -r .version)

curl -s -X PATCH "http://localhost:3000/v1/annonces/$id" \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d "{\"version\":$version,\"titre\":\"Jean Levi’s 501 W30\",
       \"description\":\"Jean porté quelques fois, très bon état, aucune tache visible.\",
       \"categorieId\":\"$CATEGORIE\",\"taille\":\"38\",\"etat\":\"tres_bon\",
       \"couleur\":\"bleu\",\"matiere\":\"coton\",\"prixCents\":2800,
       \"prixOrigineCents\":9900,\"poidsG\":450}"
```

Contrôles attendus :

- une version périmée renvoie `409` avec `details.versionActuelle` ;
- l’accès à l’annonce d’un autre vendeur renvoie `404` ;
- une annonce non publiée renvoie `404` au public.

### 6.2 Photo

```bash
photo=$(curl -s -X POST "http://localhost:3000/v1/annonces/$id/photos" \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d '{"nomFichier":"jean.jpg","mimeType":"image/jpeg",
       "tailleOctets":2450000,"largeur":3024,"hauteur":4032}')
url=$(echo "$photo" | jq -r .urlTeleversement)
photo_id=$(echo "$photo" | jq -r .photoId)

curl -s -X PUT "$url" -H 'Content-Type: image/jpeg' --data-binary @jean.jpg
curl -s -X POST "http://localhost:3000/v1/annonces/$id/photos/$photo_id/confirmer" \
  -H "Authorization: Bearer $ACCESS"
```

Le worker remplace ensuite la photo par des WebP `s/m/l`, efface les EXIF et calcule le
pHash. Vérifier :

```bash
psql "$DATABASE_URL" -c \
  "SELECT id, statut_traitement, largeur, hauteur, percept_hash FROM photos WHERE annonce_id = '$id';"
docker compose -f infra/docker/docker-compose.yml logs -f minio
```

### 6.3 Publication

```bash
curl -s -X POST "http://localhost:3000/v1/annonces/$id/publier" \
  -H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json' \
  -d "{\"version\":$VERSION}"
```

Issues :

- `200 publiee` : annonce visible par `GET /v1/annonces/$id` sans jeton ;
- `200 en_revue` : quasi-doublon ou édition douteuse, `moderation.demande` dans l’outbox ;
- `200 refusee` : contact, mot interdit, doublon exact, catégorie/taille invalide ;
- `422` : annonce incomplète, photo absente ou non traitée, quota atteint, compte non actif.

### 6.4 Favoris et référentiels

```bash
curl -s -X POST "http://localhost:3000/v1/annonces/$id/favori" -H "Authorization: Bearer $ACCESS"
curl -s -X DELETE "http://localhost:3000/v1/annonces/$id/favori" -H "Authorization: Bearer $ACCESS"
curl -s http://localhost:3000/v1/referentiels/categories
curl -s -H 'If-None-Match: "<etag>"' http://localhost:3000/v1/referentiels/categories
```

Le second appel doit renvoyer `304`. Un double ajout ou retrait de favori ne change pas
le compteur.

## 7. Exploitation

- **Outbox** : les événements M2 sont écrits dans la même transaction que l’état métier.
  Les consommateurs (`commande.*`, `moderation.annonce_decision`, `interaction.vue`,
  `compte.*`, `referentiel.modifie`) sont implémentés mais leur abonnement BullMQ sera
  câblé avec M9.
- **Worker photos** : file `photos`, 5 tentatives, backoff exponentiel. Un job déjà
  `traitee`/`rejetee` est ignoré (rejeu après commit). Une photo ajoutée à une annonce
  `publiee` est contrôlée par pHash : doublon exact → photo `rejetee` ; quasi-doublon →
  photo `a_verifier`, annonce `en_revue` et `moderation.demande`. Une photo traitée sur
  une annonce publiée émet `annonce.mise_a_jour`. Surveiller les jobs échoués ; une photo
  en échec définitif doit être supprimée puis renvoyée.
- **Stockage** : `originaux/` et `tmp/` privés ; `variantes/` publics. Configurer une règle
  de cycle de vie S3 pour expirer `tmp/` à 7 jours. Le CDN doit respecter le paramètre
  `?v=<pHash>`.
- **Cache** : les référentiels sont cachés 1 h dans Redis sous `referentiels:v1:*` et
  invalidés par `referentiel.modifie`.
- **Compteurs** : `nb_favoris` est maintenu en transaction ; `nb_vues` est incrémenté sur
  `interaction.vue`. Une réconciliation périodique reste à planifier avec M9.
- **Logs** : aucun titre, description, e-mail, téléphone ni adresse complète. Utiliser
  `annonceId`, `vendeurId`, transition et `traceId`.

## 8. Vérifications SQL utiles

```sql
-- Annonces actives d'un vendeur (quota 20)
SELECT statut, count(*) FROM annonces
WHERE vendeur_id = $1 AND statut IN ('en_revue','publiee','reservee')
GROUP BY statut;

-- Divergence du compteur de favoris
SELECT a.id, a.nb_favoris, count(f.id) AS reels
FROM annonces a LEFT JOIN favoris f ON f.annonce_id = a.id
GROUP BY a.id HAVING a.nb_favoris <> count(f.id);

-- Photos bloquées en traitement
SELECT id, annonce_id, statut_traitement, cree_le
FROM photos
WHERE statut_traitement IN ('en_attente','televersee')
  AND cree_le < now() - interval '24 hours';

-- Événements M2 en attente de publication
SELECT type, count(*) FROM outbox_evenements
WHERE type LIKE 'annonce.%' AND publie_le IS NULL
GROUP BY type;
```

## 9. Recette automatisée

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm --filter @secondevie/mobile typecheck
pnpm test
pnpm build
RUN_INTEGRATION_TESTS=true pnpm test:integration   # Docker requis
```

La suite `apps/api/test/integration/annonces-http.integration.spec.ts` couvre le parcours
HTTP complet. Sans Docker local, la référence reste le job CI `integration`, qui applique
toutes les migrations sur PostgreSQL 16 puis lance les conteneurs de test.
Les configurations Vitest utilisent `unplugin-swc` (métadonnées de décorateurs) ; si la
suite échoue avec « Nest can't resolve dependencies … (?) », vérifier que le plugin est
toujours actif.

## 10. Limites connues

- Aucun écran mobile M2 : l’API et les contrats sont prêts.
- Aucun job planifié pour purger les brouillons à 90 jours, les photos `en_attente` de
  plus de 24 h ni réconcilier `nb_favoris`.
- Quasi-doublon global non couvert (limite v1 assumée).
- Rate limiting non branché sur les routes M2.
- Les abonnements de consommation d’événements seront activés avec M9.
- Une confirmation de photo ne rejoue pas un job BullMQ déjà terminé ; supprimer la photo
  et recommencer en cas d’échec définitif. Le worker, lui, ignore un job déjà
  `traitee`/`rejetee` pour rester idempotent.
- Une annonce passée `en_revue` par un quasi-doublon photo attend la décision M7, même si
  la photo litigieuse est supprimée entre-temps.
- L’unicité différée de l’ordre des photos et les index partiels sont manuels.
- Le back-office M9 n’existe pas : référentiels et mots interdits sont versionnés.
