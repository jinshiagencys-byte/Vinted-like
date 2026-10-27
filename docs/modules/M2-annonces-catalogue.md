# M2 — Annonces et catalogue — Plan d’exécution

> Statut : **implémenté et validé localement** au 28/10/2026 — suite d’intégration à
> exécuter en CI (Docker absent sur la machine de développement).
> Référence de conception : [`docs/conception/M2-annonces-catalogue.md`](../conception/M2-annonces-catalogue.md)
> Runbook : [`docs/runbooks/annonces.md`](../runbooks/annonces.md)
> OpenAPI : [`docs/openapi/m2-annonces.yaml`](../openapi/m2-annonces.yaml)
> Dépend de M1 (comptes, guards, outbox) et du socle lot 0.

## 1. Objectif

Livrer l’offre : création et gestion d’annonces, photos traitées, publication contrôlée,
favoris, référentiels et cycle de vie lié aux commandes. M2 ne fait ni recherche (M3), ni
transaction (M5), ni décision de modération (M7).

## 2. Décisions d’exécution

Les points ouverts du document de conception sont tranchés provisoirement ainsi :

| Réf. | Décision provisoire | Mise en œuvre |
|---|---|---|
| M2-Q1 | Quota de 20 annonces actives = `en_revue + publiee + reservee` | `politique-quota.ts`, verrou consultatif PostgreSQL |
| M2-Q2 | Republication : même identifiant et même référence | `RepublierAnnonce` depuis `archivee` |
| M2-Q3 | Brouillons purgés à 90 jours (job documenté, activation après M9) | Job non activé, port `photosSansTraitementAvant` prêt |
| M2-Q4 | Poids obligatoire à la publication, optionnel en brouillon | `verifierPrealablesPublication` |
| M2-Q5 | Catégories et marques : seed versionné + endpoints de lecture | `referentiels.v1.json`, cache Redis + ETag |
| M2-Q6 | Doublon exact global refusé ; quasi-doublon intra-vendeur en revue | pHash DCT 64 bits, seuil 6 |
| M2-Q7 | Acheteur d’une annonce réservée : via le snapshot M5 | Aucun champ acheteur dans M2 |
| M2-Q8 | Titre, description et photos repassent par les contrôles après publication | Texte à l’édition ; photos au worker (pHash), `moderation.demande` si doute |
| M2-Q9 | Vues : M3 seule source, M2 consomme `interaction.vue` | `ConsommerEvenementsAnnonces.interactionVue` |
| M2-Q10 | Photos : 400 × 400 minimum, ratio 1:3 à 3:1, 8 Mo, 12 maximum | `PreparerPhoto` + `TraitementImageSharpAdapter` |
| M2-Q11 | Mots interdits : fichier versionné en v1, pilotage M9 ensuite | `mots-interdits.v1.ts` |
| M2-Q12 | Pas de FK physique `favoris.utilisateur_id` ; intégrité applicative via M1 | Purge RGPD explicite à `compte.supprime` |
| M2-Q13 | Vendeur suspendu : annonces masquées sans archivage | Visibilité évaluée à chaque lecture |

Décisions complémentaires prises pendant l’implémentation :

- **Liste des favoris** : `GET /v1/moi/favoris` n’est pas exposé par M2, conformément à
  la conception (§6.1). Le cas d’usage interne `GererFavoris.listerFavoris` et le
  repository sont prêts pour M3, qui exposera la route.
- **Réponse de création/modification** : M2 renvoie la représentation complète de
  l’annonce (avec `photos`) plutôt que le sous-ensemble `{id, reference, statut, version,
  creeLe}`. Le client typé et l’OpenAPI documentent cette représentation.
- **Contact dans le texte** : un titre ou une description contenant e-mail, URL ou
  téléphone est refusé dès l’écriture avec `422` par les objets-valeurs. Le contrôle de
  publication reste en défense en profondeur pour des données importées ou historiques.
- **Complétude à l’édition** : une annonce déjà soumise (`en_revue` ou `publiee`) ne peut
  pas perdre un champ obligatoire (`couleur`, `etat`, `prixCents`…). Le contrôle renvoie
  `422 annonce_incomplete` avant d’atteindre la contrainte SQL.
- **Photos après publication** : une photo ajoutée est traitée puis contrôlée par pHash.
  Un doublon exact est rejeté sans toucher aux autres photos ; un quasi-doublon passe la
  photo en `a_verifier` et l’annonce en `en_revue` avec `moderation.demande`. Une photo
  traitée sur une annonce `publiee` émet `annonce.mise_a_jour` pour la réindexation M3.
- **Contraintes SQL manuelles** : l’unicité différée `(annonce_id, ordre)`, les index
  partiels sur les catégories et les contraintes `CHECK` métier ne sont pas exprimables
  dans le schéma Prisma. Ils sont portés par la migration et documentés dans le runbook ;
  ne pas régénérer la migration sans les reporter.

## 3. Lots et critères de sortie

### L1 — Données, domaine, référentiels — terminé

- Schéma Prisma M2, migration up/down, contraintes SQL, seed catégories/marques/tailles.
- Objets-valeurs, machine à états, politiques, repositories.
- Tests : transitions, invariants, référence, quota, visibilité.
- **Sortie** : `prisma:generate`, typecheck, tests unitaires, migration applicable.

### L2 — Brouillon et gestion — terminé

- `POST /v1/annonces`, `PATCH /v1/annonces/{id}`, `GET /v1/annonces/{id}`,
  `GET /v1/moi/annonces`.
- Version optimiste, pagination curseur, visibilité, IDOR.
- **Sortie** : 409 de version, 404 des annonces masquées, tests HTTP.

### L3 — Photos — terminé

- Préparation avec URL signée, confirmation, suppression, ordre, principale.
- Worker : validation magic bytes, ré-encodage, EXIF, variantes, pHash, rejeu idempotent.
- Doublons après publication : rejet de la photo exacte, revue du quasi-doublon, émission
  de `annonce.mise_a_jour` pour la réindexation.
- **Sortie** : photo traitée avant publication, variantes, objets nettoyés.

### L4 — Publication et événements — terminé

- `POST /publier`, `archiver`, `republier`, contrôles automatiques, file de revue.
- Outbox : `annonce.publiee`, `annonce.refusee`, `annonce.archivee`, etc.
- **Sortie** : trois issues testées, événements transactionnels, idempotence.

### L5 — Favoris, vues, cache — terminé

- Favoris idempotents et compteur exact ; port interne de liste pour M3.
- Consommation `interaction.vue`, cache Redis des référentiels avec ETag.
- **Sortie** : compteurs sous concurrence, 304, invalidation.

### L6 — Cycle de vie et exploitation — terminé (câblage M9 en attente)

- Consommation `commande.*`, `moderation.annonce_decision`, `compte.*`, `interaction.vue`,
  `referentiel.modifie`.
- Runbook M2, vérifications SQL et événements outbox.
- **Sortie** : transitions conditionnelles idempotentes, aucune régression M1. Les
  métriques et alertes dédiées seront branchées avec l’exploitation M9.

## 4. Règles de sécurité et de données

- Toute route d’écriture exige un JWT valide ; la création, les photos et l’ajout d’un
  favori exigent un e-mail vérifié. Le propriétaire est toujours déduit du JWT, jamais du
  corps. Les routes protégées revalident la version de sécurité : un jeton invalidé par
  un changement de mot de passe, une suspension ou une suppression est refusé.
- Un identifiant d’annonce ou de photo d’autrui renvoie `404`, pas `403`.
- Aucune PII dans les événements : identifiants, prix, catégories, URLs publiques.
- Les originaux restent privés ; seules les variantes sont publiques.
- Les logs ne contiennent ni contenu d’annonce, ni adresse, ni e-mail.
- Les erreurs suivent `{ code, message, details?, traceId }`.
- En production, les marqueurs de développement (`change-me…`, identifiants MinIO par
  défaut) sont refusés au démarrage.

## 5. Contrat HTTP

La table des endpoints est celle de la conception (§6.1). Le contrat est publié dans
[`docs/openapi/m2-annonces.yaml`](../openapi/m2-annonces.yaml) et le client typé dans
[`packages/contracts/src/api-annonces.ts`](../../packages/contracts/src/api-annonces.ts).

## 6. Événements

| Sens | Événement | Déclencheur |
|---|---|---|
| Émis | `annonce.publiee` | publication directe ou décision d’approbation |
| Émis | `annonce.mise_a_jour` | édition d’une annonce publiée, photo modifiée |
| Émis | `annonce.refusee` | refus automatique ou décision M7 |
| Émis | `annonce.archivee` | archivage vendeur, masquage M7, suppression de compte |
| Émis | `annonce.reservee`, `annonce.liberee`, `annonce.vendue` | consommation des commandes M5 |
| Émis | `moderation.demande` | quasi-doublon ou édition sensible douteuse |
| Émis | `favori.ajoute`, `favori.retire` | favoris |
| Émis | `photo.traitee` | fin ou rejet du worker photo |
| Consommé | `commande.payee`, `commande.annulee`, `commande.cloturee` | M5 |
| Consommé | `moderation.annonce_decision` | M7 |
| Consommé | `interaction.vue` | M3 |
| Consommé | `compte.statut_modifie`, `compte.supprime` | M1 |
| Consommé | `referentiel.modifie` | M9 |

Les consommateurs sont prêts mais ne sont pas encore branchés à un processor de file :
comme pour M1, le câblage des abonnements BullMQ appartient à M9.

## 7. Validation

Exécuté localement le 28/10/2026 :

```text
pnpm format
pnpm lint
pnpm typecheck
pnpm --filter @secondevie/mobile typecheck
pnpm test          # 36 fichiers, 138 tests
pnpm build
```

La suite `apps/api/test/integration/annonces-http.integration.spec.ts` couvre la création,
la modification, le conflit de version, l’IDOR, la publication, l’archivage, les favoris,
les référentiels et la pagination. Elle nécessite Docker et s’exécute via
`pnpm test:integration` ou le job CI `integration`.

## 8. Limites connues à documenter

- Pas de back-office M9 : référentiels en lecture seule, mots interdits versionnés.
- Pas de M3/M5/M7/M8 réels : événements et ports simulés par des fakes en attendant.
- Le traitement d’image dépend de `sharp` et du stockage S3/MinIO ; le compose local
  fournit MinIO, le bucket et la lecture publique des variantes.
- La détection de quasi-doublon global reste hors v1.
- Une annonce passée `en_revue` après l’ajout d’une photo quasi-doublon attend la décision
  M7 ; M2 ne la republie pas automatiquement après suppression de la photo.
- `compte.supprime` archive les annonces du compte mais n’émet pas un `annonce.archivee`
  par ligne : M3 doit consommer `compte.supprime` pour purger son index, ou M2 émettra ces
  événements lors du câblage M9.
- La purge planifiée des brouillons et la réconciliation nightly sont des jobs à activer
  avec M9. Le compteur `nb_favoris` est maintenu en transaction mais la réconciliation
  periodique n’est pas planifiée.
- Aucune interface mobile M2 n’est livrée dans ce lot : les contrats et l’API sont prêts,
  les écrans seront ajoutés lors du lot mobile.
- Les routes M2 ne sont pas encore soumises au rate limiting M1 ; à cadrer avec M9.
- Aucune métrique ou alerte dédiée M2 n’est exposée : la supervision repose sur les logs
  applicatifs, l’outbox et les requêtes du runbook jusqu’au lot M9.
- La confirmation de photo ne rejoue pas un job terminé (identifiant BullMQ stable). Une
  photo en échec définitif doit être supprimée puis renvoyée.
- L’unicité de l’ordre des photos et les index partiels des catégories sont différés ou
  manuels : les modifications du schéma Prisma doivent préserver la migration.

## 9. Journal

| Date | Décision | Auteur | Impact |
|---|---|---|---|
| 28/10/2026 | Ouverture de M2 avec les décisions provisoires ci-dessus | Responsable technique | L1–L6 |
| 28/10/2026 | L1–L4 : schéma, domaine, référentiels, CRUD, photos, publication | Responsable technique | API M2 |
| 28/10/2026 | L5–L6 : favoris, cache, consommateurs de cycle de vie | Responsable technique | Événements |
| 28/10/2026 | Validation locale, OpenAPI, runbook, client typé | Responsable technique | Livraison |
| 28/10/2026 | Purge RGPD des favoris d’un compte supprimé sans FK | Responsable technique | M2-Q12 |
| 28/10/2026 | Refus des secrets de développement en production | Responsable technique | Sécurité |
| 28/10/2026 | Complétude obligatoire après édition d’une annonce en ligne | Responsable technique | Édition |
| 28/10/2026 | Contrôles pHash et réindexation après ajout de photo publiée | Responsable technique | M2-Q8 |
| 28/10/2026 | Rejeu idempotent du worker photo | Responsable technique | Exploitation |
