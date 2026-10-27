# Conception SecondeVie

Ce dossier contient les plans de conception détaillés, module par module. Ils sont écrits
**avant** le codage et servent de contrat de travail : structure, modèle de données, API,
règles métier, événements, tests et lots d'implémentation.

## Documents

| Document | Contenu | Statut |
|---|---|---|
| [`00-socle-commun.md`](./00-socle-commun.md) | Conventions, structure monorepo, erreurs, outbox, sécurité, tests, lot 0 | Proposition |
| [`M1-comptes-identite.md`](./M1-comptes-identite.md) | Comptes, authentification, profils, adresses, appareils, vérifications, RGPD | Proposition |
| [`M2-annonces-catalogue.md`](./M2-annonces-catalogue.md) | Annonces, photos, publication, favoris, référentiels, cycle de vie | Implémenté (décisions provisoires) |
| M3 — Recherche et découverte | À concevoir | En attente |
| M4 — Messagerie et négociation | À concevoir | En attente |
| M5 — Commandes et paiements | À concevoir | En attente |
| M6 — Expédition et logistique | À concevoir | En attente |
| M7 — Confiance et modération | À concevoir | En attente |
| M8 — Notifications | À concevoir | En attente |
| M9 — Administration et pilotage | À concevoir | En attente |

> **Plan d’exécution de M1** : le document opérationnel au format du guide étudiant est
> [`docs/modules/comptes-identite.md`](../modules/comptes-identite.md). Son cadrage a été
> validé le 22/10/2026 ; le **lot 0** (socle) est validé depuis le 22/10/2026 par la CI
> GitHub. Les **étapes 1 à 4** sont implémentées au 27/10/2026 ; l’étape 5 (recette CI et
> signature humaine) reste à exécuter. Le runbook est dans
> [`docs/runbooks/comptes.md`](../runbooks/comptes.md). Les documents de ce dossier restent
> des annexes de conception détaillée.
>
> **M2** : la conception détaillée est dans
> [`M2-annonces-catalogue.md`](./M2-annonces-catalogue.md). Le plan opérationnel et les
> décisions d’exécution sont consignés dans
> [`docs/modules/M2-annonces-catalogue.md`](../modules/M2-annonces-catalogue.md).
> L’implémentation est validée localement (lint, typecheck, tests, build) au 28/10/2026 ;
> la suite HTTP Testcontainers reste à exécuter en CI. Voir le runbook
> [`docs/runbooks/annonces.md`](../runbooks/annonces.md) et l’OpenAPI
> [`docs/openapi/m2-annonces.yaml`](../openapi/m2-annonces.yaml).

## Ordre de conception proposé

L'ordre suit les dépendances de service du document d'architecture, avec un socle commun
d'abord :

1. **Socle** (lot 0) — sans lui, M1 et M2 réinventeraient l'outbox, les guards et les tests.
2. **M1** — identité, car M2, M4, M5, M7 et M8 en dépendent.
3. **M2** — catalogue, car M3, M4 et M5 en dépendent.
4. **M3** — recherche, dépend de M1 et M2.
5. **M7** — confiance, nécessaire au cycle de vie des annonces et des comptes.
6. **M4** — messagerie, dépend de M1 et M2.
7. **M5** — commandes, dépend de M1, M2, M4, M6, M7 et M8.
8. **M6** — expédition, dépend de M5 (et fournit les étiquettes).
9. **M8** — notifications, transverse mais peut démarrer après M1/M2 avec des modèles.
10. **M9** — administration, consomme les autres modules et n'a pas de dépendance sortante.

> Cet ordre est un ordre de **conception**, pas nécessairement de livraison : M8 et M9
> peuvent être développés en parallèle avec des contrats stubs.

## Décisions de cadrage

### M1 — validées le 22/10/2026

1. **Langue** : domaine et tables en français, frameworks en anglais (D01).
2. **Téléphone** : facultatif à l’inscription, obligatoire avant le premier achat et le
   premier virement (D03) ; **unique lorsqu’il est renseigné** (D14).
3. **Statut `restreint`** : lecture et gestion du compte uniquement, sans publication,
   achat ni nouvelle conversation ; les commandes en cours continuent (D12).
4. **HIBP** : mode de panne `fail-open` avec alerte (D13).
5. **Profil public** : M1 renvoie le profil sans les annonces ; le mobile compose avec M3
   (D09).
6. **Socle** : lot 0 séparé, prérequis à l’étape 1 de M1 (D02).
7. **Matrice des accès, contrat API et modèle de données M1** : validés.

### Encore ouvertes

- **M1** : suppression immédiate ou délai de grâce (Q04), changement de pseudo (Q06),
  changement d’e-mail (Q07), périmètre de l’export RGPD (Q08), bibliothèque UI (Q11),
  authentification du back-office (Q12), limite par appareil (Q14).
- **M2** : les décisions M2-Q1 à M2-Q13 sont tranchées provisoirement et implémentées
  (quota, republication, poids, référentiels, doublons, acheteur, revue après édition,
  vues, photos, mots interdits, favoris sans FK, suspension). Restent à confirmer en
  recette : le quota de 20, le seuil de quasi-doublon à 6 et l’absence de
  `GET /v1/moi/favoris` avant M3.
- **Contrat d'événements** : M5 émet `commande.payee` puis M2 émet `annonce.reservee`
  (proposition), ou M5 émet directement `annonce.reservee`. M2 implémente la première
  option et attend l’arbitrage final.

Chaque plan se termine par une section « Points à valider ». Tant qu'ils ne sont pas
tranchés, le code correspondant ne doit pas être figé.
