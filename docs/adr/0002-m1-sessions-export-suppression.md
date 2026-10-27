# ADR 0002 — Sessions, export et suppression de M1

- Statut : accepté pour l’implémentation, à confirmer en recette
- Date : 27/10/2026
- Portée : M1 — comptes et identité

## Contexte

M1 doit délivrer une session sûre, permettre l’export des données et la suppression du
compte. Plusieurs questions du cadrage (Q04, Q06–Q08, Q14) ne sont pas tranchées. Il faut
une implémentation cohérente, réversible et documentée, sans bloquer le mobile et l’API.

## Décisions

1. **Jetons d’accès** : JWT HS256, 15 minutes, `iss`/`aud`/`kid` vérifiés. Le secret est
   fourni par `JWT_SECRET`; la rotation de clé se fera par `kid` lors d’un lot
   d’exploitation dédié.
2. **Refresh** : 30 jours, format `v1.<appareilId>.<secret>`, seul le HMAC du secret est
   stocké. Rotation à chaque usage, ancien hash conservé 60 secondes pour absorber les
   courses réseau. Une réutilisation hors grâce révoque l’appareil et émet
   `securite.session_compromise`.
3. **Suppression** : immédiate, avec vérification du mot de passe et des blocages
   commande/litige/portefeuille (ports M5/M7/M9, fakes en v1). Anonymisation de l’e-mail,
   du téléphone, du nom, de la date de naissance, des adresses et des appareils ;
   révocation de toutes les sessions. D04 reste provisoire.
4. **Export RGPD** : asynchrone via BullMQ, limité au périmètre M1 (D08 provisoire),
   archive JSON stockée localement (`EXPORT_DIR`), URL signée HMAC valable 15 minutes,
   `Cache-Control: no-store`. Aucun hash de mot de passe, code ou refresh n’est exporté.
5. **Appareils** : maximum 10 appareils actifs (D05 provisoire) ; au-delà, l’utilisateur
   doit en révoquer un.
6. **Changement d’e-mail** : exclu de la v1 (D11 provisoire). Le changement de pseudo est
   autorisé dans la limite de l’unicité (Q06 ouverte).

## Conséquences

- Le mobile et l’API peuvent avancer sans attendre les décisions produit restantes.
- Toute modification de Q04/Q08/Q14 devra mettre à jour ce document, le runbook et les
  tests concernés.
- Le stockage local des exports convient au développement et à la CI ; un stockage objet
  privé est requis avant une mise en production multi-instances.
- L’absence de fournisseur e-mail/SMS réel et de ports M5/M7/M9 réels est une limite
  connue, documentée dans `docs/runbooks/comptes.md`.
