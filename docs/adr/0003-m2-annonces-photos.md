# ADR 0003 — M2 : annonces, photos et favoris

- **Date** : 28/10/2026
- **Statut** : accepté (décisions provisoires, à confirmer en recette)
- **Contexte** : M2 livre le catalogue après le socle et M1. Les points ouverts de la
  conception devaient être tranchés sans inventer de tables ni d’API.

## Décisions

1. **Statuts** : les sept statuts de la conception sont conservés. `archivee` sert de
   suppression logique ; aucun statut `masquee` n’est ajouté. Une suspension de vendeur
   masque les annonces à la lecture sans changer leur statut.
2. **Référence** : `SV-` + 6 caractères Crockford base32, unique globalement. Une
   republication réutilise le même identifiant et la même référence.
3. **Quota** : 20 annonces actives (`en_revue`, `publiee`, `reservee`). Le comptage et la
   transition sont protégés par un verrou consultatif PostgreSQL par vendeur.
4. **Publication** : trois issues métier (`publiee`, `en_revue`, `refusee`). Les préalables
   incomplets ou les photos non prêtes renvoient `422` sans transition. Les refus et les
   demandes de revue sont écrits dans l’outbox dans la même transaction.
5. **Photos** : upload direct S3 via URL signée, confirmation avec `HEAD`, worker BullMQ.
   Le contenu est validé par magic bytes, ré-encodé en WebP, débarrassé des EXIF, décliné
   en `s/m/l`, puis empreinté par pHash 64 bits. Les originaux et `tmp/` restent privés ;
   seules les variantes sont publiques. Le worker est idempotent sur un job déjà terminé
   et rejoue les contrôles de doublon pour toute photo ajoutée après publication.
6. **Doublons** : doublon exact global refusé, quasi-doublon (Hamming ≤ 6) limité au même
   vendeur et envoyé en revue. Après publication, un doublon exact rejette la nouvelle
   photo et un quasi-doublon remet l’annonce `en_revue`. Le quasi-doublon global reste
   hors v1.
7. **Favoris** : pas de FK physique `favoris.utilisateur_id` vers M1 (frontière de
   modules). L’intégrité est applicative ; `compte.supprime` purge explicitement les
   favoris du compte et décrémente les compteurs concernés.
8. **Référentiels** : seed JSON versionné, lecture seule en v1, cache Redis avec ETag.
   Les index partiels d’unicité des catégories sont portés par la migration.
9. **Ordre des photos** : unicité `(annonce_id, ordre)` **différée** pour permettre le
   réordonnancement en une transaction.
10. **Visibilité** : évaluée à chaque lecture à partir du statut de l’annonce et du statut
    du vendeur. Le propriétaire et les modérateurs conservent l’accès ; le public reçoit
    `404` pour tout ce qui n’est pas `publiee` chez un vendeur actif ou restreint.

## Conséquences

- Le schéma Prisma ne peut pas représenter la contrainte différée ni les index partiels :
  la migration est la source de vérité pour ces objets. Toute régénération doit les
  reporter.
- La suppression d’un compte doit passer par le consommateur `compte.supprime` pour purger
  les favoris, faute de cascade SQL.
- Une photo en échec définitif nécessite une suppression puis un nouvel envoi, le job BullMQ
  utilisant un identifiant stable.
- Les jobs de purge (brouillons 90 jours, photos en attente 24 h) et la réconciliation des
  compteurs restent à planifier avec M9.
- Aucune interface mobile M2 n’est incluse dans ce lot ; les contrats sont prêts.
- Les configurations Vitest passent par `unplugin-swc` avec métadonnées de décorateurs :
  le transpileur par défaut de Vitest n’en émet pas et l’injection NestJS par type échoue
  dans les tests qui instancient `AppModule`.
