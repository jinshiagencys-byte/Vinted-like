# Socle de conception partagé — SecondeVie

> Statut : proposition à valider avant codage — v0.1 — 22/10/2026
> S'applique aux modules **M1 — Comptes et identité** et **M2 — Annonces et catalogue**,
> et sera réutilisé pour les modules suivants.
> Référence : `Document-architecture-SecondeVie.md`, sections 4, 7, 8 et 10.

---

## 1. Objet

Ce document fixe les conventions communes pour éviter que chaque module invente sa propre
structure, son propre format d'erreur ou sa propre façon d'émettre des événements. Les plans
M1 et M2 s'y appuient et ne redéfinissent que ce qui leur est spécifique.

---

## 2. Structure cible du dépôt

Conforme à la section 10.1 du document d'architecture :

```
secondevie/
├── apps/
│   ├── api/                  # NestJS — monolithe modulaire
│   ├── mobile/               # React Native + Expo
│   └── admin/                # React + Vite
├── packages/
│   ├── contracts/            # OpenAPI + types générés
│   ├── ui/
│   └── config/               # ESLint, Prettier, tsconfig, Vitest
├── infra/
│   ├── docker/
│   ├── migrations/
│   └── scripts/
├── docs/
│   ├── architecture/         # document de référence
│   ├── conception/           # présents documents
│   └── adr/
└── .github/workflows/
```

Le dépôt n'est pas encore initialisé en monorepo : les plans ci-dessous supposent cette
structure comme cible, sans imposer sa création avant validation.

---

## 3. Anatomie d'un module

Chaque module NestJS suit la même découpe :

```
apps/api/src/modules/<module>/
├── domain/
│   ├── entites/              # agrégats et entités, sans dépendance framework
│   ├── valeurs/              # objets-valeurs (Email, Prix, Reference…)
│   ├── politiques/           # règles métier pures
│   ├── evenements/           # événements de domaine
│   ├── erreurs/              # erreurs métier typées
│   └── ports/                # interfaces dont le domaine a besoin
├── application/
│   ├── cas-usage/            # un fichier par cas d'usage
│   └── dto/                  # commandes/queries applicatives
├── infrastructure/
│   ├── persistance/          # repositories Prisma + mappers
│   ├── adaptateurs/          # S3, Redis, BullMQ, clients d'autres modules
│   └── securite/             # Argon2, JWT, HMAC…
├── presentation/
│   └── http/
│       ├── controleurs/
│       └── schemas/          # Zod + OpenAPI
└── <module>.module.ts
```

Règles :

- `domain/` n'importe ni NestJS, ni Prisma, ni HTTP.
- Un contrôleur traduit HTTP ↔ cas d'usage ; aucune règle métier dedans.
- Un cas d'usage ouvre une transaction, charge l'agrégat, applique la règle, persiste et
  écrit l'événement outbox dans la même transaction.
- Un module ne lit jamais les tables d'un autre module : il passe par un port exposé ou un
  événement.

---

## 4. Conventions de nommage

| Élément | Convention | Exemple |
|---|---|---|
| Langage métier | **Français** (langage ubiquitaire du document) | `Utilisateur`, `Annonce`, `publier()` |
| Code technique | Anglais (framework) | `Controller`, `Repository`, `Module` |
| Identifiants TS | camelCase sans accents | `motDePasseHash`, `prixCents` |
| Modèles Prisma | PascalCase singulier français | `Utilisateur`, `ReferentielTaille` |
| Tables / colonnes | snake_case français | `utilisateurs`, `prix_cents` |
| Enums | valeurs snake_case françaises | `neuf_avec_etiquette`, `en_revue` |
| JSON HTTP | camelCase français | `prixCents`, `creeLe` |
| URLs | français, pluriel | `/v1/annonces`, `/v1/moi/adresses` |
| Événements | `<domaine>.<action>` au passé | `annonce.publiee`, `compte.cree` |

Justification : le document d'architecture, les entités et les états sont déjà en français ;
traduire introduirait un vocabulaire parallèle et des erreurs de correspondance.

---

## 5. Contrat HTTP

### 5.1 Format des erreurs

Reprise des codes de la section 12.3, sans en inventer de nouveaux sauf nécessité
documentée :

```json
{
  "code": "regle_metier_violee",
  "message": "L'annonce doit contenir au moins une photo.",
  "details": { "raison": "photos_insuffisantes", "minimum": 1 },
  "traceId": "0f3c2b9e8d414a63"
}
```

- `400 validation_echec` : `details.champs[] = { champ, code, message }`.
- `401 authentification_requise` : jeton absent, invalide ou expiré.
- `401 identifiants_invalides` *(ajout proposé)* : couple e-mail/mot de passe incorrect,
  message volontairement générique.
- `403 autorisation_refusee` : rôle ou propriété insuffisants ; `details.raison` peut valoir
  `email_non_verifie`, `compte_suspendu`.
- `404 ressource_introuvable` : identifiant inconnu **ou masqué** (pas de fuite d'existence).
- `409 etat_incompatible` : transition interdite ou conflit de version
  (`details.versionActuelle`).
- `422 regle_metier_violee` : quota, photos en cours, limite d'appareils, etc.
- `429 trop_de_requetes` : en-tête `Retry-After` en secondes.
- `502 fournisseur_indisponible` : Stripe, transporteur, e-mail.

### 5.2 Pagination

Pagination **par curseur** uniquement, jamais par `OFFSET` :

```json
{
  "items": [],
  "curseurSuivant": "eyJtIjoiMjAyNi0xMC0yMlQxMDowMDowMFoiLCJpIjoiLi4uIn0",
  "aSuivant": true
}
```

- Curseur opaque : base64 de `{ m: <tri primaire>, i: <uuid> }`.
- `limite` : défaut 20, maximum 50.
- Le tri par défaut de `GET /v1/moi/annonces` est `majLe DESC, id DESC`.

### 5.3 Statuts HTTP

| Situation | Code |
|---|---|
| Création avec ressource retournée | `201` |
| Lecture / mise à jour | `200` |
| Traitement asynchrone accepté | `202` |
| Suppression logique ou action idempotente | `204` |
| Conflit d'état | `409` |

### 5.4 Idempotence

- `Idempotency-Key` obligatoire sur les opérations financières (M5) et recommandé sur
  `POST /v1/annonces/{id}/publier`.
- Les actions naturellement idempotentes (ajout/retrait de favori, archivage, révocation
  d'appareil) ne renvoient jamais d'erreur si l'état final est déjà atteint.
- Les consommateurs d'événements sont idempotents (table `inbox_evenements` ou mise à jour
  conditionnelle).

### 5.5 Versionnement

- API `/v1`, champs additifs uniquement ; pas de suppression de champ sans nouvelle version.
- OpenAPI généré depuis les schémas Zod ; client typé généré dans `packages/contracts`.
- Toute route ajoutée par rapport au document d'architecture est marquée **(+)** dans les
  plans et doit être validée avant implémentation.

---

## 6. Événements et outbox

### 6.1 Enveloppe

```json
{
  "id": "b1d4f0e2-6f2a-4f7b-8a11-2c9e5d3b7a10",
  "type": "annonce.publiee",
  "version": 1,
  "occurredAt": "2026-10-22T10:00:00.000Z",
  "aggregateType": "annonce",
  "aggregateId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "traceId": "0f3c2b9e8d414a63",
  "payload": {}
}
```

### 6.2 Règles

1. L'événement est écrit dans `outbox_evenements` **dans la transaction métier**.
2. Un publisher BullMQ dépile l'outbox (`SELECT … FOR UPDATE SKIP LOCKED`), publie, marque
   `publie_le`. Livraison **au moins une fois**.
3. Aucune donnée personnelle dans le payload (e-mail, téléphone, adresse, contenu de
   message). On transporte des identifiants ; le consommateur interroge le port du module
   propriétaire s'il a besoin d'une donnée.
4. Les événements sont versionnés ; un changement cassant impose `version: 2` et une
   période de double publication.
5. Un consommateur qui échoue réessaie avec backoff puis part en *dead-letter* avec alerte.

### 6.3 Tables du socle

```prisma
model OutboxEvenement {
  id             String    @id @db.Uuid
  type           String    @db.VarChar(80)
  version        Int       @default(1)
  agregatType    String    @map("agregat_type") @db.VarChar(40)
  agregatId      String    @map("agregat_id") @db.Uuid
  payload        Json
  traceId        String?   @map("trace_id") @db.VarChar(32)
  creeLe         DateTime  @default(now()) @map("cree_le") @db.Timestamptz(3)
  publieLe       DateTime? @map("publie_le") @db.Timestamptz(3)
  tentatives     Int       @default(0)
  derniereErreur String?   @map("derniere_erreur")

  @@index([publieLe, creeLe])
  @@map("outbox_evenements")
}

model InboxEvenement {
  evenementId  String   @map("evenement_id") @db.Uuid
  consommateur String   @db.VarChar(80)
  traiteLe     DateTime @map("traite_le") @db.Timestamptz(3)

  @@id([evenementId, consommateur])
  @@map("inbox_evenements")
}
```

---

## 7. Sécurité transversale

- **Authentification** : JWT d'accès 15 min + refresh opaque rotatif 30 jours (détail M1).
- **Autorisation** : `JwtAuthGuard` (signature/expiration) → `RolesGuard` (rôle) →
  `ProprietaireGuard` (propriété de la ressource, vérifiée côté serveur).
- **Validation** : Zod sur toutes les entrées, rejet des champs inconnus, coercion
  explicite, limites de taille.
- **Rate limiting** : Redis, 100 req/min/IP par défaut ; 10 req/min sur `/auth/*` ;
  quotas spécifiques documentés par module.
- **Journal d'audit** : port `AuditPort` (M9) pour les actions sensibles (mot de passe,
  suppression, export, sanction, remboursement).
- **Logs** : pino structuré, `redact` sur `email`, `telephone`, `authorization`,
  `refreshToken`, `code` ; identifiant de corrélation `traceId`.
- **Secrets** : variables d'environnement validées au démarrage (Zod) ; aucun secret dans
  le dépôt.

---

## 8. Persistance

- PostgreSQL 16 + Prisma ; migrations versionnées dans `infra/migrations`.
- UUID v4 générés côté application (`randomUUID()`), utiles pour les clés S3 et les
  réponses avant insertion.
- Montants : entiers en centimes (`Int`), jamais de `Float`/`Decimal` applicatif.
- Dates : `timestamptz(3)`, UTC ; conversion côté client.
- Suppressions logiques dès qu'une obligation comptable ou probatoire existe.
- Contraintes `CHECK` ajoutées manuellement dans les migrations Prisma (non supportées par
  le DSL).
- Index partiels et contraintes `DEFERRABLE` ajoutés manuellement.
- Chaque repository reçoit un `TransactionContext` optionnel pour participer à la
  transaction du cas d'usage.

---

## 9. Tests et Definition of Done

| Niveau | Outil | Ce qu'on couvre |
|---|---|---|
| Unitaire | Vitest | Objets-valeurs, politiques, transitions d'état, calculs |
| Intégration | Vitest + Testcontainers + Supertest | Cas d'usage, PostgreSQL/Redis/MinIO réels, outbox |
| Contrat | Schemathesis / snapshot OpenAPI | Conformité des routes et des erreurs |
| Sécurité | Tests ciblés | IDOR, JWT falsifié, rate limit, énumération |
| E2E | Maestro (plus tard) | Parcours mobile publié → acheté → livré |

Seuils proposés : domaine ≥ 90 % de couverture, global ≥ 70 %, **100 % des transitions
d'état** testées (table de transitions exhaustive).

Definition of Done :

- critère d'acceptation couvert par un test ;
- migration réversible et rétrocompatible ;
- OpenAPI à jour et client régénéré ;
- aucun secret ni donnée personnelle dans les logs ;
- métriques et alertes ajoutées si le parcours est critique ;
- documentation de conception mise à jour si une décision change.

---

## 10. Lot 0 — socle à construire avant M1/M2

1. Monorepo pnpm, `apps/api` NestJS, `packages/contracts`, `packages/config`.
2. Configuration validée par Zod, filtre d'erreurs normalisé, `traceId`.
3. Prisma + PostgreSQL + migrations + seed de base.
4. Redis (cache, rate limit) et BullMQ.
5. Outbox/inbox + publisher + consommation idempotente.
6. `JwtAuthGuard`, `RolesGuard`, `ProprietaireGuard`.
7. Client S3/MinIO + URLs signées.
8. OpenAPI + génération du client typé.
9. Harnais de test Testcontainers (Postgres, Redis, MinIO).
10. Observabilité minimale : logs pino, métriques HTTP, Sentry.

M1 peut démarrer dès que les points 1 à 6 et 9 sont prêts. M2 ajoute le point 7.

---

## 11. Décisions transverses à valider

| Réf. | Décision proposée | Alternative |
|---|---|---|
| S1 | Domaine et base en français, frameworks en anglais | Tout en anglais |
| S2 | UUID v4 générés côté application | `gen_random_uuid()` en base |
| S3 | Curseur opaque base64 `{m,i}` | Curseur signé HMAC |
| S4 | Erreurs existantes du document + 2 ajouts (`identifiants_invalides`, conflit de version via `etat_incompatible`) | Créer un code par cas |
| S5 | Événements sans PII | Payload autoporteur avec PII |
| S6 | Un module = un schéma Prisma logique, base unique | Un schéma PostgreSQL par module |
| S7 | `version` entier en corps de requête pour l'optimistic locking | En-tête `If-Match` / ETag |
