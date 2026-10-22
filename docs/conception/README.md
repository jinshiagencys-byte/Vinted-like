# Conception SecondeVie

Ce dossier contient les plans de conception détaillés, module par module. Ils sont écrits
**avant** le codage et servent de contrat de travail : structure, modèle de données, API,
règles métier, événements, tests et lots d'implémentation.

## Documents

| Document | Contenu | Statut |
|---|---|---|
| [`00-socle-commun.md`](./00-socle-commun.md) | Conventions, structure monorepo, erreurs, outbox, sécurité, tests, lot 0 | Proposition |
| [`M1-comptes-identite.md`](./M1-comptes-identite.md) | Comptes, authentification, profils, adresses, appareils, vérifications, RGPD | Proposition |
| [`M2-annonces-catalogue.md`](./M2-annonces-catalogue.md) | Annonces, photos, publication, favoris, référentiels, cycle de vie | Proposition |
| M3 — Recherche et découverte | À concevoir | En attente |
| M4 — Messagerie et négociation | À concevoir | En attente |
| M5 — Commandes et paiements | À concevoir | En attente |
| M6 — Expédition et logistique | À concevoir | En attente |
| M7 — Confiance et modération | À concevoir | En attente |
| M8 — Notifications | À concevoir | En attente |
| M9 — Administration et pilotage | À concevoir | En attente |

> **Plan d’exécution de M1** : le document opérationnel au format du guide étudiant est
> [`docs/modules/comptes-identite.md`](../modules/comptes-identite.md). Son cadrage a été
> validé le 22/10/2026 ; le **lot 0** (socle) est démarré. L’étape 1 ne commence qu’après
> validation du lot 0. Les documents de ce dossier restent des annexes de conception
> détaillée.

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
- **M2** : définition d'une annonce « active » ; republication avec la même référence ;
  poids obligatoire à la publication.
- **Contrat d'événements** : M5 émet `commande.payee` puis M2 émet `annonce.reservee`
  (proposition), ou M5 émet directement `annonce.reservee`.

Chaque plan se termine par une section « Points à valider ». Tant qu'ils ne sont pas
tranchés, le code correspondant ne doit pas être figé.
