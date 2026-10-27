# Plan d’implémentation — Comptes et identité (M1)

## 1. Identification

| Champ | Valeur |
|---|---|
| Module | **M1 — Comptes et identité** |
| Version du plan | 1.1 |
| Auteur | Étudiant / équipe projet — *à compléter* |
| Date | 22/10/2026 |
| Statut | **Cadrage validé** — décisions Q01–Q03, Q05, Q09, Q10, Q13 et documents validés le 22/10/2026 |
| Validateur | **[nom à compléter]** — validation reçue le 22/10/2026 |
| Dépôt | `Vinted-like` (SecondeVie) |
| Documents de référence | `Document-architecture-SecondeVie.md` (§5.2.1), `Guide_etudiant_plan_module_avant_implementation.pdf` |
| Annexes | `docs/conception/00-socle-commun.md`, `docs/conception/M1-comptes-identite.md` (conception détaillée antérieure, non validée) |

> Ce document est le **plan d’exécution** du module M1. L’annexe de conception détaillée
> reste utile pour le modèle Prisma et les flux, mais en cas de divergence, c’est le présent
> plan, une fois validé, qui fait foi.

---

## 2. Contexte, problème et objectifs

### 2.1 Contexte

SecondeVie est une application mobile de vente de vêtements de seconde main. Le dépôt ne
contient aujourd’hui **aucun code applicatif** : uniquement des documents d’architecture et
des supports. M1 est le premier module à construire ; il doit fournir la brique d’identité
sur laquelle s’appuieront les annonces (M2), la messagerie (M4), les commandes (M5), la
confiance (M7) et les notifications (M8).

### 2.2 Problème observable

Aujourd’hui, un visiteur ne peut pas :

- créer un compte fiable et vérifier son adresse e-mail ;
- se reconnecter sur un appareil sans ressaisir ses identifiants à chaque action ;
- gérer ses adresses de livraison et ses appareils ;
- supprimer son compte ou exporter ses données ;
- et les autres modules n’ont aucune source de vérité pour savoir **qui** agit, si son compte
  est actif, vérifié ou suspendu.

Le résultat attendu est un membre identifié, vérifié, capable de gérer ses informations
personnelles, et une API qui permet aux autres modules de contrôler l’identité et les droits
sans jamais lire les tables de M1.

### 2.3 Objectifs

1. Permettre une inscription en moins de 2 minutes, suivie d’une vérification e-mail.
2. Délivrer des sessions sûres (JWT court + refresh rotatif) sur iOS, Android et web admin.
3. Garantir qu’un membre ne voit et ne modifie que ses données privées.
4. Permettre la gestion des adresses, appareils et préférences.
5. Permettre la suppression/anonymisation et l’export RGPD.
6. Exposer aux autres modules une interface stable : statut, vérification, sanctions,
   réputation, adresses.
7. Ne jamais stocker ni journaliser de secret en clair.

### 2.4 Acteurs

| Acteur | Rôle dans M1 |
|---|---|
| **Visiteur** | Consulte un profil public, s’inscrit, se connecte, demande une réinitialisation |
| **Membre** | Gère son compte, ses adresses, ses appareils, ses sessions, son export |
| **Modérateur** | Consulte les comptes via le back-office M9 ; ne modifie pas les données privées |
| **Admin** | Suspend, réactive ou supprime un compte via M9 ; M1 applique la décision |
| **Système** | M5/M7/M8 consomment les événements et fournissent les données de sanction, commande et notification |

---

## 3. Périmètre

### 3.1 Inclus dans ce module

- Inscription par e-mail et mot de passe.
- Vérification de l’e-mail par code à 6 chiffres.
- Vérification du téléphone ; le téléphone est requis avant le premier achat (D03).
- Connexion, rafraîchissement de session, déconnexion.
- Réinitialisation du mot de passe par lien à usage unique.
- Profil privé (`/v1/moi`) et profil public (`/v1/utilisateurs/{pseudo}`).
- Adresses de livraison/facturation, adresse par défaut, suppression logique.
- Appareils, jetons push, révocation d’une session.
- Avatar : téléversement par URL signée, variantes 256/512, suppression à l’anonymisation.
- Suppression/anonymisation du compte, avec blocages.
- Export RGPD asynchrone.
- Lecture des sanctions actives (M7) et de la réputation (M5/M7).
- Guards d’authentification, d’autorisation et de vérification.
- Rate limiting des routes sensibles.
- OpenAPI, client typé et tests.

### 3.2 Explicitement exclu

- Connexion Apple/Google (v1.1).
- MFA, biométrie, clés de sécurité.
- Vérification d’identité renforcée (KYC prestataire).
- Décision de sanction (M7) et journal de modération (M9).
- Envoi réel d’e-mails/SMS/push (M8) : M1 produit l’intention, M8 exécute.
- Commandes, paiements, portefeuille, virements (M5).
- Annonces, recherche, messagerie (M2/M3/M4).
- Interface back-office complète (M9) : M1 expose seulement les ports nécessaires.
- Changement d’e-mail avec double confirmation (à décider Q07).
- Suppression physique d’un compte ou d’une adresse historique.

### 3.3 Prérequis, à ne pas reconstruire

| Prérequis | État constaté | Conséquence |
|---|---|---|
| E-mail transactionnel | Inexistant (M8 à créer) | Stub Mailpit/fake en développement ; contrat `NotificationPort` |
| SMS | Inexistant | Téléphone optionnel ; stub |
| Sanctions | Inexistant (M7 à créer) | `SanctionPort` avec fake en test |
| Commandes/litiges/solde | Inexistant (M5/M7 à créer) | Ports avec fake ; suppression fail-closed |
| Audit | Inexistant (M9 à créer) | `AuditPort` avec fake/log |
| Socle monorepo, Prisma, outbox, guards | **Inexistant** | Lot 0 à créer ou à inclure dans l’étape 1 (Q02) |

---

## 4. Existant, stack et contraintes

### 4.1 Existant vérifié dans le dépôt

Vérifications effectuées le 22/10/2026 :

- Le dépôt Git existe mais **ne contient aucun commit**.
- Aucun `package.json`, `pnpm-lock.yaml`, `turbo.json` ou équivalent.
- Aucun dossier `apps/`, `packages/`, `infra/`, `database/`, `src/`.
- Aucun schéma Prisma, aucune migration, aucun test, aucun composant mobile.
- Aucune authentification, aucun guard, aucun client HTTP existant.
- Seuls existent : les documents d’architecture, les supports PDF, une capture d’écran,
  `.vscode/mcp.json` et les documents de conception rédigés précédemment.

**Conclusion** : tout ce qui est proposé ci-dessous est **à créer**. Il n’existe aucune table,
aucune API, aucun écran à réutiliser pour M1. Le seul « existant » est la cible
architecturale décrite dans le document de référence.

### 4.2 Stack cible (à vérifier et verrouiller à l’étape 0)

| Couche | Choix du document d’architecture | Version exacte vérifiée ? |
|---|---|---|
| Langage | TypeScript strict | Non (aucun `package.json`) |
| Gestionnaire | pnpm + workspaces | Non |
| API | NestJS 11, Node.js 22 | Non |
| Base | PostgreSQL 16 + Prisma | Non |
| Cache/files | Redis 7 + BullMQ | Non |
| Fichiers | S3 compatible, MinIO en local | Non |
| Mobile | React Native + Expo, Expo Router | Non (SDK non fixé) |
| État serveur | TanStack Query | Non |
| UI mobile | NativeWind ou Tamagui (à trancher) | Non |
| Contrats | OpenAPI + client typé | Non |
| Tests | Vitest, Testcontainers, Supertest | Non |
| Observabilité | pino, Sentry, OpenTelemetry | Non |

> Les versions ci-dessus sont des **cibles**, pas des faits. Conformément à D02 (lot 0
> séparé), leur vérification et leur verrouillage exacts (`package.json`, `pnpm-lock.yaml`)
> sont réalisés dans le lot 0, avant l’étape 1.

### 4.3 Contraintes structurantes

1. **Monolithe modulaire** : un seul déployable API, modules à frontières explicites.
2. **Pas d’accès aux tables d’un autre module** : services/ports ou événements uniquement.
3. **Domaine sans dépendance framework** : NestJS, Prisma et HTTP restent en périphérie.
4. **Transactions par cas d’usage**, pas par requête HTTP.
5. **Outbox** : tout événement est écrit dans la même transaction que l’état.
6. **Idempotence** sur les opérations sensibles et les consommateurs.
7. **Aucun secret dans le dépôt** ; configuration par variables d’environnement.
8. **RGPD** : minimisation, durées de conservation, export, suppression.
9. **Mobile first**, interface en français, accessibilité minimale (WCAG AA, cibles 44 pt).
10. **Pas de vérité métier côté mobile** : le serveur décide, le client affiche.

### 4.4 Éléments à créer

| Élément | Nature | Étape |
|---|---|---|
| Monorepo, API NestJS, configuration, CI minimale | Socle (lot 0) | 0/1 |
| Postgres + Redis + MinIO locaux (Docker Compose) | Socle | 0/1 |
| Schéma Prisma M1 + migrations | Données | 1 |
| Domaine, objets-valeurs, politiques, repositories | Code | 1 |
| Inscription, vérification, connexion, refresh | API | 2 |
| Profil, adresses, appareils, réinitialisation | API | 3 |
| Suppression, export, réputation | API | 3 |
| Écrans mobiles et client typé | Mobile | 4 |
| OpenAPI, tests, recette, runbook | Qualité | 2-5 |

### 4.5 Contraintes de nommage et de contrat

- **Langue du code et de la base** : **français** pour le domaine et les tables, anglais
  pour les frameworks (D01, validée le 22/10/2026).
- **API** : `/v1`, JSON camelCase, erreurs normalisées, pagination par curseur.
- **Dates** : UTC en base, affichage dans le fuseau de l’appareil.
- **Montants** : non concernés dans M1 (les éventuels montants de M5 restent en centimes).
- **Identifiants** : UUID v4.
- **Routes ajoutées** par rapport au document d’architecture : marquées `(+)` et validées
  le 22/10/2026.

---

## 5. Règles métier et autorisations

### 5.1 Règles métier

Chaque règle est formulée pour être testable. Les règles marquées **bloquantes** doivent être
tranchées avant l’étape indiquée.

| Réf. | Règle | Vérification attendue |
|---|---|---|
| **R01** | L’e-mail est normalisé (espaces de bord supprimés, Unicode NFKC, minuscules) avant stockage. Un e-mail normalisé appartient à **un seul** compte. | Deux inscriptions avec ` Alice@Example.com ` et `alice@example.com` : la seconde renvoie `409`, un seul compte existe. |
| **R02** | Le pseudo fait 3 à 30 caractères, sans espace, avec `A-Z a-z 0-9 . _ -`, et est unique **insensible à la casse**. Les noms réservés (`admin`, `support`, `secondevie`…) sont refusés. | `Alice` puis `alice` : refus. `a b` : refus. `admin` : refus. |
| **R03** | La date de naissance est obligatoire, valide, non future, et l’âge est ≥ 18 ans à l’inscription. | 17 ans : refus ; 18 ans : accepté ; date future : refus. |
| **R04** | Le mot de passe fait 10 à 128 caractères, n’est pas un mot de passe compromis connu, ne contient pas l’e-mail local ni le pseudo, et est stocké en Argon2id. Il n’est jamais renvoyé, journalisé ni stocké en clair. Si le service de fuites (HIBP) est indisponible, la vérification est **fail-open** avec alerte et métrique (D13). | Hash Argon2id vérifiable ; le champ n’apparaît dans aucune réponse ; le log de test ne contient pas le mot de passe. HIBP indisponible → l’inscription reste possible et une alerte est émise. |
| **R05** | La vérification e-mail utilise un code à 6 chiffres, valable 15 minutes, limité à 5 tentatives, renvoyable après 60 secondes et 5 fois par jour. Le code est haché, à usage unique. **L’inscription seule n’émet aucun token** ; les jetons sont délivrés à la vérification, ou à la connexion d’un compte non vérifié avec les capacités limitées par R06. | Code faux 5 fois → blocage ; code expiré → refus ; un code utilisé ne fonctionne plus ; l’inscription seule ne renvoie aucun token. |
| **R06** | Un compte non vérifié peut se connecter et gérer son compte, mais ne peut pas effectuer d’action nécessitant la vérification (publier, acheter, initier un paiement). L’API expose `emailVerifie` et un guard dédié refuse ces actions. | Un membre non vérifié reçoit `403 autorisation_refusee` avec `details.raison = email_non_verifie` sur une route protégée ; il peut toujours lire `/v1/moi`. |
| **R07** | L’access token dure 15 minutes ; le refresh token dure 30 jours, est **rotatif** et stocké haché par appareil. Un refresh réutilisé après une grâce de 60 secondes révoque l’appareil. Un membre a au plus 10 appareils actifs ; les plus anciens sont révoqués. | Ancien refresh après grâce → `401` et appareil révoqué. Deux refresh simultanés → un seul nouveau couple. 11e appareil → le plus ancien est révoqué. |
| **R08** | Un membre ne lit et ne modifie que **ses** données privées : profil privé, adresses, appareils, export. Le profil public ne montre que les champs publics. L’accès à une ressource privée d’un autre membre renvoie `404` (pas `403`, pour ne pas révéler son existence). | Membre A appelle `/v1/moi/adresses/{id_de_B}` → `404`. Le profil public ne contient ni e-mail, ni téléphone, ni date de naissance, ni adresse. |
| **R09** | Un membre a **au plus une adresse par défaut active**. Supprimer l’adresse par défaut promeut la plus récente des autres adresses actives, ou laisse le compte sans défaut s’il n’en reste aucune. Une adresse référencée par une commande est supprimée **logiquement**, jamais physiquement. | Deux requêtes concurrentes « définir par défaut » → une seule adresse par défaut. Suppression d’une adresse utilisée par une commande → `supprimee_le` renseigné, ligne conservée. |
| **R10** | Les statuts sont `actif`, `restreint`, `suspendu`, `supprime`. Un compte `suspendu` ne peut plus s’authentifier et tous ses refresh tokens sont révoqués. Un compte `restreint` peut se connecter mais ne peut ni publier, ni acheter, ni initier de nouvelle conversation ; les commandes en cours ne sont pas interrompues. `supprime` est terminal. | Suspension → `401` au prochain refresh et à la connexion ; access token en cours refusé sur les routes sensibles. `restreint` → `403` sur publication/achat. |
| **R11** | La suppression du compte exige le mot de passe. Elle est refusée si une commande est en cours, un litige est ouvert ou le solde du portefeuille est non nul. Sinon : anonymisation immédiate, révocation de tous les appareils, profil vidé, annonces archivées via M2 ; les données comptables et les avis restent pseudonymisés chez M5/M7. | Suppression sans blocage → e-mail technique, profil vide, sessions révoquées. Avec commande ouverte → `409` avec raison explicite, compte intact. |
| **R12** | Toute modification d’e-mail ou de mot de passe déclenche une notification de sécurité. Un changement de mot de passe révoque tous les refresh tokens (y compris les autres appareils). | Après changement, les autres appareils ne peuvent plus rafraîchir ; un événement de sécurité est produit. |
| **R13** | Le `telephone` est obligatoire avant le **premier achat**. `nomComplet`, `dateNaissance` et `telephone` sont obligatoires avant le **premier virement** (KYC léger). M1 expose `telephoneVerifie` et `kycLegerComplet` ; il ne réalise ni achat ni virement. | `telephone` absent → M5 refuse l’achat ; `kycLegerComplet = false` sans les trois champs, `true` avec. |
| **R14** | Les codes de vérification et jetons de réinitialisation sont hachés, à usage unique, expirants (15 min pour un code, 30 min pour un lien) et purgés après expiration. | Le code n’est jamais stocké en clair ; un jeton de reset utilisé une seconde fois → `401`. |
| **R15** | Aucune donnée sensible (mot de passe, code, token, e-mail, téléphone, adresse complète) n’apparaît dans les logs. Les actions sensibles (changement de mot de passe, suppression, export, suspension) sont auditées via M9. | Capture de logs sur les scénarios : aucun secret ni PII. Un événement d’audit existe pour chaque action sensible. |
| **R16** | Les routes d’authentification sont limitées : inscription 5/h/IP, connexion 10/min/IP + 5 échecs/compte → blocage 15 min, renvoi de code 3/15 min, réinitialisation 3/h. Les réponses `429` portent `Retry-After`. | 6 inscriptions → `429`. 5 échecs → blocage. La réponse et le délai ne révèlent pas l’existence du compte. |

### 5.2 Autorisations

| Action | Visiteur | Membre | Modérateur | Admin | Système |
|---|---|---|---|---|---|
| S’inscrire, vérifier, se connecter, réinitialiser | ✅ | — | — | — | — |
| Lire un profil public | ✅ (si visibilité `public`) | ✅ | ✅ | ✅ | — |
| Lire/modifier `/v1/moi` | ❌ | ✅ (soi) | ❌ | ❌ | — |
| Gérer ses adresses | ❌ | ✅ (soi) | ❌ | ❌ | — |
| Gérer ses appareils / jetons push | ❌ | ✅ (soi) | ❌ | ❌ | — |
| Supprimer son compte | ❌ | ✅ (soi + mot de passe) | ❌ | ❌ | — |
| Exporter ses données | ❌ | ✅ (soi) | ❌ | ❌ | — |
| Suspendre / réactiver un compte | ❌ | ❌ | ❌ | ✅ via M9 | — |
| Lire les sanctions actives | ❌ | ✅ (les siennes) | ✅ via M7 | ✅ via M7 | — |
| Consommer `ComptesQueryPort` | ❌ | ❌ | ❌ | ❌ | ✅ (M2/M4/M5/M7/M8) |

Précisions :

- Le modérateur **ne modifie pas** les données privées d’un membre. Il agit sur les
  signalements (M7) et le back-office (M9).
- Un admin ne « lit » pas les mots de passe : ils sont hachés et jamais exposés.
- Les routes internes ne sont pas exposées au public : elles utilisent un mécanisme de
  service-to-service (à définir à l’étape 0, par exemple un token interne ou un réseau privé).

---

## 6. Données, API et interface

### 6.1 Données

Les tables ci-dessous sont **à créer**. Aucune n’existe dans le dépôt.

> **Ajouts par rapport à la fiche d’architecture §5.2.1**, validés le 22/10/2026 :
> `pseudo_normalise` (unicité insensible à la casse), `version_securite` (révocation),
> `reputation_version` (idempotence des événements), `supprime_le`, et la table
> `reinitialisations_mot_de_passe` (le document ne prévoit qu’un type `Verification`) et
> `exports_rgpd` (suivi des exports). Ces ajouts ne remplacent aucun champ existant ; ils
> sont justifiés dans les règles R02, R07, R10 et R14.

| Table | Champs principaux | Contraintes |
|---|---|---|
| `utilisateurs` | `id`, `email`, `telephone`, `mot_de_passe_hash`, `pseudo`, `pseudo_normalise`, `nom_complet`, `date_naissance`, `pays`, `statut`, `role`, `email_verifie_le`, `telephone_verifie_le`, `note_moyenne`, `nb_ventes`, `nb_achats`, `reputation_version`, `version_securite`, `version`, `derniere_connexion_le`, `supprime_le`, `cree_le`, `maj_le` | `email` unique ; `pseudo_normalise` unique ; `telephone` unique si non nul ; `statut` et `role` en enum ; `supprime` ⇒ `supprime_le` non nul ; index sur `statut` et `cree_le` |
| `profils` | `id`, `utilisateur_id`, `avatar_url`, `bio`, `taille_cm`, `pointure`, `styles_preferes`, `visibilite`, `langue`, `cree_le`, `maj_le` | `utilisateur_id` unique, FK `utilisateurs` ; 1-1 ; `taille_cm` 120–230, `pointure` 15–50, `styles_preferes` ≤ 5 |
| `adresses` | `id`, `utilisateur_id`, `libelle`, `destinataire`, `ligne1`, `ligne2`, `code_postal`, `ville`, `pays`, `telephone`, `est_defaut`, `supprimee_le`, `cree_le`, `maj_le` | FK `utilisateurs` ; index `utilisateur_id` ; index partiel unique `(utilisateur_id) WHERE est_defaut AND supprimee_le IS NULL` |
| `appareils` | `id`, `utilisateur_id`, `plateforme`, `device_id`, `refresh_token_hash`, `refresh_token_precedent_hash`, `refresh_token_rotated_le`, `refresh_token_expire_le`, `push_token`, `derniere_activite_le`, `revoque_le`, `cree_le` | unique `(utilisateur_id, device_id)` ; `refresh_token_hash` unique si non nul ; FK `utilisateurs` |
| `verifications` | `id`, `utilisateur_id`, `type`, `statut`, `fournisseur_ref`, `code_hash`, `tentatives`, `expire_le`, `valide_le`, `cree_le` | FK `utilisateurs` ; index `(utilisateur_id, type, statut)` ; index `expire_le` ; index partiel unique d’un code `en_attente` par `(utilisateur_id, type)` |
| `reinitialisations_mot_de_passe` | `id`, `utilisateur_id`, `jeton_hash`, `expire_le`, `utilise_le`, `cree_le` | `jeton_hash` unique ; FK `utilisateurs` ; index `utilisateur_id` |
| `exports_rgpd` | `id`, `utilisateur_id`, `statut`, `url_signee`, `expire_le`, `cree_le`, `termine_le` | FK `utilisateurs` ; statut `en_attente`/`pret`/`echoue`/`expire` ; index `(utilisateur_id, cree_le)` |
| `outbox_evenements` | `id`, `type`, `version`, `agregat_type`, `agregat_id`, `payload`, `trace_id`, `cree_le`, `publie_le`, `tentatives`, `derniere_erreur` | Socle commun ; index `(publie_le, cree_le)` |
| `inbox_evenements` | `evenement_id`, `consommateur`, `traite_le` | Clé primaire composite ; idempotence |

Points de vigilance :

- `telephone` est normalisé en **E.164** avant stockage ; toute modification du numéro
  remet `telephone_verifie_le` à `NULL` et crée une vérification de type `telephone`.
- `email` est normalisé (NFKC, minuscules, espaces de bord supprimés) avant stockage (R01).
- **Aucune FK physique entre M1 et les tables des autres modules** (`annonces`, `commandes`,
  `avis`…). Les références croisées sont des UUID vérifiés par les ports.
- Les FK internes à M1 sont en `RESTRICT` : on ne supprime pas physiquement un utilisateur
  qui a un profil, des adresses ou des appareils. L’anonymisation remplace les valeurs.
- Les statuts dérivés (par exemple « en retard ») ne sont pas stockés. Pour M1, seul
  `kycLegerComplet` est calculé à la volée, pas stocké.
- `note_moyenne`, `nb_ventes`, `nb_achats` sont **dénormalisés** et mis à jour par événements
  avec `reputation_version` pour ignorer un événement ancien.
- `version_securite` est incrémentée à la suspension et au changement de mot de passe ; elle
  est incluse dans l’access token et vérifiée sur les routes sensibles.
- `refresh_token_rotated_le` date la dernière rotation : il permet d’accorder la grâce de
  60 secondes à l’ancien hash sans confondre un retry réseau avec une réutilisation après
  expiration.
- Les codes et jetons sont stockés **hachés** (HMAC-SHA256 avec poivre pour les codes,
  SHA-256/HMAC pour les jetons de reset).

### 6.2 Contrat API

Toutes les routes sont sous `/v1`. Les routes marquées `(+)` sont des ajouts au document
d’architecture, validés le 22/10/2026.

#### Authentification

| Méthode | Route | Acteur | Demande | Réponse | Erreurs |
|---|---|---|---|---|---|
| POST | `/v1/auth/inscription` | Visiteur | `email`, `pseudo`, `motDePasse`, `dateNaissance`, `pays?` | `201` : `utilisateurId`, `email`, `emailVerifie: false`, `expireLe` | `400`, `409`, `422`, `429` |
| POST | `/v1/auth/email/verifier` (+) | Visiteur | `email`, `code`, `appareil { deviceId, plateforme, pushToken? }` | `200` : `accessToken`, `refreshToken`, `expireDans`, `utilisateur` | `400`, `422`, `429` |
| POST | `/v1/auth/email/renvoyer` (+) | Visiteur | `email` | `202` (réponse générique) | `202` même si inconnu, `429` |
| POST | `/v1/auth/telephone/verifier` (+) | Membre | `code` | `200` : `telephoneVerifie: true` | `400`, `401`, `422` |
| POST | `/v1/auth/telephone/renvoyer` (+) | Membre | — | `202` | `401`, `429` |
| POST | `/v1/auth/connexion` | Visiteur | `email`, `motDePasse`, `appareil { deviceId, plateforme }` | `200` : jetons + utilisateur | `401`, `403`, `429` |
| POST | `/v1/auth/refresh` | Visiteur (refresh) | `refreshToken` | `200` : nouveau couple | `401`, `429` |
| POST | `/v1/auth/deconnexion` | Membre | — | `204` | `401` |
| POST | `/v1/auth/mot-de-passe/reinitialiser` | Visiteur | `email` | `202` (générique) | `429` |
| POST | `/v1/auth/mot-de-passe/reinitialiser/confirmer` (+) | Visiteur | `jeton`, `nouveauMotDePasse` | `204` | `400`, `401`, `422` |

#### Compte

| Méthode | Route | Acteur | Demande | Réponse | Erreurs |
|---|---|---|---|---|---|
| GET | `/v1/moi` | Membre | — | Profil privé, préférences, `emailVerifie`, `kycLegerComplet`, sanctions actives | `401`, `403` |
| PATCH | `/v1/moi` | Membre | `version`, champs autorisés | `200` : profil mis à jour | `400`, `401`, `409`, `422` |
| PATCH | `/v1/moi/mot-de-passe` (+) | Membre | `motDePasseActuel`, `nouveauMotDePasse` | `204` | `400`, `401`, `422` |
| GET | `/v1/moi/adresses` | Membre | — | Liste des adresses actives | `401` |
| POST | `/v1/moi/adresses` | Membre | Adresse | `201` | `400`, `401`, `422` |
| PATCH | `/v1/moi/adresses/{id}` (+) | Membre | Champs adresse | `200` | `401`, `404`, `422` |
| DELETE | `/v1/moi/adresses/{id}` | Membre | — | `204` | `401`, `404` |
| POST | `/v1/moi/adresses/{id}/defaut` (+) | Membre | — | `204` | `401`, `404` |
| POST | `/v1/moi/avatar` (+) | Membre | `mimeType`, `tailleOctets`, `largeur`, `hauteur` | `201` : URL signée | `400`, `401`, `422` |
| POST | `/v1/moi/avatar/confirmer` (+) | Membre | `avatarId` | `202` | `401`, `404` |
| GET | `/v1/moi/appareils` (+) | Membre | — | Liste sans jetons | `401` |
| DELETE | `/v1/moi/appareils/{id}` (+) | Membre | — | `204` | `401`, `404` |
| PUT | `/v1/moi/appareils/push-token` (+) | Membre | `deviceId`, `pushToken` | `204` | `401`, `422` |
| GET | `/v1/utilisateurs/{pseudo}` | Public | — | Profil public seul, sans annonces (D09) | `404` |
| DELETE | `/v1/moi` | Membre | `motDePasse` | `204` | `401`, `409`, `422` |
| POST | `/v1/moi/export` (+) | Membre | — | `202` : `exportId` | `401`, `429` |
| GET | `/v1/moi/export/{id}` (+) | Membre | — | `200` : statut + URL signée si prêt | `401`, `404` |

#### Exemples de contrat

**Inscription**

```http
POST /v1/auth/inscription
Content-Type: application/json

{
  "email": "alice@example.com",
  "pseudo": "alice_vintage",
  "motDePasse": "un-mot-de-passe-solide",
  "dateNaissance": "1997-04-12",
  "pays": "FR"
}
```

```json
{
  "utilisateurId": "b1d4f0e2-6f2a-4f7b-8a11-2c9e5d3b7a10",
  "email": "alice@example.com",
  "emailVerifie": false,
  "expireLe": "2026-10-22T10:15:00Z"
}
```

**Vérification e-mail**

```http
POST /v1/auth/email/verifier
Content-Type: application/json

{
  "email": "alice@example.com",
  "code": "428193",
  "appareil": { "deviceId": "ios-9f2c", "plateforme": "ios" }
}
```

```json
{
  "accessToken": "eyJ…",
  "refreshToken": "v1.<appareilId>.<secret>",
  "expireDans": 900,
  "utilisateur": {
    "id": "b1d4f0e2-6f2a-4f7b-8a11-2c9e5d3b7a10",
    "pseudo": "alice_vintage",
    "emailVerifie": true
  }
}
```

**Erreur normalisée**

```json
{
  "code": "regle_metier_violee",
  "message": "Le compte ne peut pas être supprimé : une commande est en cours.",
  "details": { "raison": "commande_en_cours", "commandeId": "…" },
  "traceId": "0f3c2b9e8d414a63"
}
```

Codes HTTP : `400 validation_echec`, `401 authentification_requise` /
`identifiants_invalides`, `403 autorisation_refusee`, `404 ressource_introuvable`,
`409 etat_incompatible`, `422 regle_metier_violee`, `429 trop_de_requetes`.

Règles de contrat :

- Aucun token, mot de passe ou code n’apparaît dans une réponse hors le couple de jetons
  attendu.
- Les réponses de connexion, réinitialisation et renvoi de code ne révèlent pas l’existence
  d’un compte.
- `PATCH /v1/moi` exige `version` ; un conflit renvoie `409` avec `details.versionActuelle`.
- `DELETE` et les actions idempotentes renvoient `204` même si l’état final est déjà atteint,
  sauf ressource inexistante ou non autorisée.
- L’export est asynchrone : `202` puis polling, URL signée valable 15 minutes.

### 6.3 Interface mobile

Écrans à prévoir (noms indicatifs, Expo Router) :

| Écran | Route indicative | Acteur | Contenu | États obligatoires |
|---|---|---|---|---|
| Inscription | `app/(auth)/inscription.tsx` | Visiteur | E-mail, pseudo, mot de passe, date de naissance, CGU | chargement, erreurs par champ, succès, hors ligne (brouillon local) |
| Vérification e-mail | `app/(auth)/verification.tsx` | Visiteur | 6 cases/champ code, renvoyer, compte à rebours | chargement, code faux, code expiré, tentatives restantes, succès |
| Connexion | `app/(auth)/connexion.tsx` | Visiteur | E-mail, mot de passe, mot de passe oublié | chargement, identifiants invalides, compte suspendu, verrouillage |
| Mot de passe oublié | `app/(auth)/mot-de-passe-oublie.tsx` | Visiteur | E-mail, puis nouveau mot de passe | envoi, lien expiré, succès |
| Profil privé | `app/(tabs)/moi.tsx` | Membre | Avatar, pseudo, bio, mensurations, préférences | chargement, vide, erreur + réessai, succès |
| Adresses | `app/(tabs)/moi/adresses.tsx` | Membre | Liste, ajouter/modifier, définir par défaut, supprimer | chargement, liste vide, erreur, confirmation, succès |
| Sécurité / sessions | `app/(tabs)/moi/securite.tsx` | Membre | Appareils, révocation, changement de mot de passe | chargement, liste vide, erreur, action en cours, succès |
| Suppression | `app/(tabs)/moi/suppression.tsx` | Membre | Avertissement, mot de passe, blocages éventuels | chargement, blocage expliqué, confirmation, succès |
| Export | `app/(tabs)/moi/export.tsx` | Membre | Demande, statut, téléchargement | en attente, prêt, expiré, erreur |
| Profil public | `app/utilisateur/[pseudo].tsx` | Tous | Pseudo, avatar, bio, note, compteurs | chargement, 404, profil privé, erreur |

Règles d’interface :

- Les jetons sont stockés dans **Expo SecureStore**, jamais dans `AsyncStorage`.
- En cas d’échec réseau, le formulaire conserve la saisie et propose « Réessayer ».
- Après une réponse ambiguë (timeout), recharger l’état serveur avant de proposer une
  nouvelle action.
- Aucun bouton ne doit permettre une action que le serveur refusera : les droits sont
  reflétés, mais le serveur reste l’autorité.
- Accessibilité : libellés, contrastes AA, cibles ≥ 44 pt, navigation clavier sur le web
  admin, messages d’erreur explicites en français.
- Le profil public ne contient jamais e-mail, téléphone, date de naissance, adresse.

### 6.4 Contrats partagés

- OpenAPI généré depuis les schémas Zod de l’API.
- Client typé généré dans `packages/contracts`, consommé par le mobile.
- Toute modification de contrat casse le build du client : c’est volontaire.
- Les types de réponse ne contiennent jamais de champs privés, même optionnels.

---

## 7. Qualité et risques

### 7.1 Sécurité

- Argon2id : mémoire 64 Mo, 3 itérations, parallélisme 1 ; paramètres versionnés.
- JWT HS256, clé ≥ 32 octets, `kid` pour rotation ; `iss`, `aud`, `sub`, `sid`, `ver`.
- Refresh opaque 32 octets, haché, rotatif, grâce de 60 s, détection de réutilisation.
- Codes et jetons de reset hachés, à usage unique, expirants.
- Rate limiting Redis sur `/auth/*`, verrouillage progressif, réponses génériques.
- Anti-énumération : même code et même temps de réponse pour e-mail inconnu et mot de passe
  faux ; hash factice pour l’e-mail inconnu.
- IDOR : toute ressource privée est filtrée par `utilisateurId` côté serveur.
- Secrets uniquement en variables d’environnement ; `.env.example` documenté.
- Logs pino avec `redact` ; jamais de PII, token, code ou mot de passe.
- Audit via M9 pour mot de passe, suppression, export, suspension.
- RGPD : export, suppression, durées de conservation documentées.

### 7.2 Concurrence

| Risque | Mitigation | Test |
|---|---|---|
| Deux inscriptions avec le même e-mail/pseudo | Index uniques + gestion `409` | Test concurrent |
| Deux adresses par défaut | Index partiel unique + transaction | Test concurrent |
| Deux refresh avec le même token | Rotation + grâce + révocation | Test concurrent |
| Suppression pendant une commande | Ports M5/M7 en **fail-closed** | Fake M5 indisponible → `503`/refus |
| Suspension pendant une requête | `version_securite` + cache court | Access token obsolète → refus |
| Double retour/consommation de code | Mise à jour conditionnelle + état | Deux requêtes → un seul effet |

### 7.3 Performance

- Objectif API : p95 < 300 ms sur les lectures courantes, p99 < 800 ms.
- Argon2id est volontairement coûteux : ne jamais l’appeler dans une boucle ou sur une route
  non authentifiée sans rate limit.
- Index sur `email`, `pseudo_normalise`, `appareils(utilisateur_id)`,
  `verifications(expire_le)`, `adresses(utilisateur_id)`.
- Pas de N+1 : `/v1/moi` charge profil, adresses et sanctions en requêtes maîtrisées.
- Cache Redis pour `version_securite`, statut de compte et sanctions (TTL court).
- Export asynchrone, jamais dans la requête HTTP.

### 7.4 Tests

| Niveau | Outil | Périmètre |
|---|---|---|
| Unitaire | Vitest | Objets-valeurs, politiques, transitions, hachage, rotation |
| Intégration | Vitest + Testcontainers + Supertest | Cas d’usage, PostgreSQL/Redis/MinIO réels, outbox |
| Contrat | Schemathesis / snapshot OpenAPI | Routes, codes, schémas |
| Sécurité | Tests ciblés | IDOR, JWT falsifié, rate limit, énumération |
| Mobile | Tests de composants + Maestro (plus tard) | Parcours inscription → vérification → connexion |

Jeu de tests minimal obligatoire :

1. **Nominal** : inscription → code → vérification → connexion → `/v1/moi`.
2. **Refus d’accès** : membre A tente de lire/modifier l’adresse ou l’appareil de B → `404`.
3. **Cas limite** : réutilisation d’un refresh après la grâce → révocation ; suppression avec
   commande ouverte → refus ; deux adresses par défaut concurrentes → une seule.

### 7.5 Documentation

- OpenAPI à jour à chaque étape.
- ADR pour les décisions structurantes (langue, JWT, refresh, RGPD).
- Runbook : migrations, variables d’environnement, seed, restauration, rollback.
- Journal des décisions en fin de document, avec date et validateur.
- Ne jamais écrire « testé » ou « validé » sans commande, résultat et date.

### 7.6 Risques principaux

| Risque | Impact | Mitigation |
|---|---|---|
| Aucun socle existant | Retard sur l’étape 1 | Lot 0 explicite ou étape 1 dédiée (Q02) |
| Délivrabilité e-mail | Inscription bloquée | Mailpit en local, outbox avec retry, fallback support |
| Vol de refresh token | Usurpation | Rotation, détection, révocation, notification |
| Énumération de comptes | Vie privée | Réponses et délais constants, rate limit |
| Suppression avec paiement en cours | Perte financière | Blocages fail-closed via ports M5/M7 |
| Coût SMS | Budget | Téléphone optionnel, vérification avant transaction |
| Complexité KYC Stripe | Retard | Port non implémenté, champs obligatoires avant virement |
| Course sur l’unicité | Doublons | Index uniques + tests concurrents |
| PII dans les logs | Non-conformité | `redact`, tests de logs, revue |
| Mobile hors ligne | Perte de saisie | Brouillon local, reprise, rechargement serveur |

---

## 8. Questions ouvertes et décisions

### 8.1 Décisions

| Réf. | Décision | Impact | Statut |
|---|---|---|---|
| D01 | Domaine et base en **français**, frameworks en anglais | Nommage, migrations, lisibilité | **Validée le 22/10/2026** |
| D02 | Le **lot 0** (monorepo, NestJS, Prisma, outbox, guards, tests) est un prérequis séparé, pas une fonctionnalité de M1 | Planning, étape 1 | **Validée le 22/10/2026** |
| D03 | Téléphone **facultatif à l’inscription**, obligatoire avant le premier achat et le premier virement | R05, R13, écrans | **Validée le 22/10/2026** |
| D04 | Suppression **immédiate** avec anonymisation, sans délai de grâce | R11, support | Proposée — Q04 à trancher |
| D05 | Maximum **10 appareils actifs**, purge après 90 jours d’inactivité | R07, étape 3 | Proposée — à confirmer |
| D06 | Access **15 min** / refresh **30 jours** rotatif, grâce 60 s | R07 | Proposée — à confirmer |
| D07 | Connexion sociale **exclue** de la v1 | Périmètre, schéma | Proposée — à confirmer |
| D08 | Export RGPD limité à M1 dans un premier temps, extensible aux autres modules ensuite | Étape 3/5 | Proposée — Q08 à trancher |
| D09 | `GET /v1/utilisateurs/{pseudo}` renvoie le profil public **sans les annonces** ; le mobile compose avec M3 | Contrat, dépendances | **Validée le 22/10/2026** |
| D10 | JWT **HS256** avec `kid`, pas RS256 en v1 | Sécurité, rotation | Proposée — à confirmer |
| D11 | Le changement d’e-mail **n’est pas inclus** dans ce module (v1.1) | R12, étape 3 | Proposée — Q07 à trancher |
| D12 | Statut `restreint` = **lecture + gestion du compte**, sans publication, achat ni nouvelle conversation ; les commandes en cours continuent | R06, R10, guards M2/M4/M5 | **Validée le 22/10/2026** |
| D13 | Vérification de fuite de mot de passe en **fail-open** avec alerte et métrique si HIBP est indisponible | R04, disponibilité | **Validée le 22/10/2026** |
| D14 | Téléphone **unique lorsqu’il est renseigné** | R01/R13, données | **Validée le 22/10/2026** |

### 8.2 Questions ouvertes

| Réf. | Question | Impact | Décideur | État / décision attendue | Bloque |
|---|---|---|---|---|---|
| Q01 | Langue du code et de la base : français ou anglais ? | Nommage, migrations, revue | Responsable technique | **Validée : D01 — français** | — |
| Q02 | Le socle (monorepo, NestJS, Prisma, outbox, guards) est-il créé dans un lot 0 séparé ou dans l’étape 1 de M1 ? | Planning, dépendances | Responsable technique | **Validée : D02 — lot 0 séparé** | — |
| Q03 | Téléphone obligatoire dès l’inscription ou seulement avant la première transaction ? | R05, R13, UX, coût SMS | Product owner | **Validée : D03 — facultatif puis obligatoire avant achat** | — |
| Q04 | Suppression immédiate ou délai de grâce de 30 jours ? | R11, support, RGPD | Product owner / juriste | D04 à valider | **Étape 3** |
| Q05 | Capacités exactes du statut `restreint` ? | R06, R10, M2/M4/M5 | Product owner | **Validée : D12 — lecture + compte uniquement** | — |
| Q06 | Changement de pseudo : libre, limité, ou immuable ? | R02, API, UX | Product owner | À trancher | Étape 3 |
| Q07 | Changement d’e-mail : exclu de la v1 ou inclus avec double confirmation ? | R12, étape 3, sécurité | Product owner | D11 proposée : exclu | Étape 3 |
| Q08 | Périmètre de l’export RGPD : M1 seul ou tous les modules dès la v1 ? | R11/RGPD, étape 3 | Product owner / juriste | D08 proposée : M1 d’abord | Étape 3 |
| Q09 | La vérification de fuite de mot de passe est-elle **fail-open** (panne HIBP) ou **fail-closed** ? | R04, disponibilité | Responsable technique | **Validée : D13 — fail-open + alerte** | — |
| Q10 | Le profil public doit-il inclure les annonces en vente (document d’architecture) ou le mobile les demande-t-il à M3 ? | D09, dépendances M1↔M3 | Responsable technique | **Validée : D09 — profil seul** | — |
| Q11 | Bibliothèque UI mobile : NativeWind, Tamagui ou composants natifs ? | Étape 4, design system | Responsable technique / designer | À trancher | **Étape 4** |
| Q12 | Authentification du back-office : bearer token ou cookie HttpOnly + CSRF ? | M9, sécurité | Responsable technique | À trancher (hors M1, mais impacte le contrat) | Étape 3 |
| Q13 | Le téléphone doit-il être unique ? | R01/R13, données | Product owner | **Validée : D14 — unique si renseigné** | — |
| Q14 | Faut-il une limite de tentatives par appareil en plus de l’IP ? | R16, anti-abus | Responsable technique | Proposition : oui, 5/compte | Étape 2 |

### 8.3 Décisions validées

| Réf. | Décision | Date | Validateur | Impact |
|---|---|---|---|---|
| D01 | Domaine et base en français, frameworks en anglais | 22/10/2026 | [nom à compléter] | Nommage, migrations |
| D02 | Lot 0 séparé pour le socle | 22/10/2026 | [nom à compléter] | Planning, étape 1 |
| D03 | Téléphone facultatif à l’inscription, obligatoire avant achat/virement | 22/10/2026 | [nom à compléter] | R05, R13, écrans |
| D12 | `restreint` = lecture + gestion du compte uniquement | 22/10/2026 | [nom à compléter] | R06, R10, guards |
| D13 | Vérification de fuite en fail-open avec alerte | 22/10/2026 | [nom à compléter] | R04, disponibilité |
| D09 | Profil public sans annonces ; le mobile compose avec M3 | 22/10/2026 | [nom à compléter] | Contrat, dépendances |
| D14 | Téléphone unique si renseigné | 22/10/2026 | [nom à compléter] | R01/R13, données |

**Documents validés le 22/10/2026** : matrice des accès (§5.2), contrat API (§6.2) et modèle
de données (§6.1).

> Une question qui touche les droits, les données ou une règle métier **bloque l’étape
> concernée**. Les autres travaux peuvent continuer si la dépendance est stubée.

---

## 9. Étapes de réalisation

### Étape 0 — Vérifier et valider le cadrage

**Statut : validée (cadrage) le 22/10/2026**

#### Objectif et prérequis

Rendre ce plan applicable au dépôt réel et obtenir une validation explicite avant d’écrire
du code. Prérequis : accès au dépôt, au document d’architecture et au présent guide ; présence
du responsable technique ou de l’enseignant pour trancher les questions bloquantes.

#### Travaux à réaliser et fichiers concernés

1. Relever l’état exact du dépôt (aucun code, aucun commit) et le consigner dans §4.1.
2. Identifier les versions cibles de la stack (Node, pnpm, NestJS, Prisma, PostgreSQL,
   Redis, Expo, TypeScript) ; leur vérification et leur verrouillage exacts sont réalisés
   dans le lot 0 (D02), dans `package.json` / `pnpm-lock.yaml`.
3. Trancher Q01, Q02, Q03, Q05, Q09, Q10, Q13.
4. Confirmer la matrice des accès (§5.2) et les ajouts d’API marqués `(+)`.
5. Valider le modèle de données et les contraintes (§6.1) sur papier.
6. Faire jouer trois scénarios sur papier : inscription nominale, refus d’accès, cas limite.
7. Mettre à jour ce document (version, décisions, journal).

Fichiers concernés : `docs/modules/comptes-identite.md`, `docs/adr/` (à créer), futur
`package.json`, futur `pnpm-workspace.yaml`.

#### Règles applicables et points de vigilance

Toutes les règles R01–R16 sont relues. Aucune règle ne doit rester ambiguë. Ne pas considérer
les prérequis (M7, M8, M9, M5) comme disponibles : ils sont **stubés**.

#### Livrables

- Ce document mis à jour avec les décisions validées et leurs dates.
- Matrice des accès validée.
- Contrat API v1 validé (routes, erreurs, ajouts `(+)`).
- Liste des versions cibles identifiées ; verrouillage exact prévu dans le lot 0.
- Journal des décisions initialisé.

#### Tests et cas limites

- **Nominal** : un visiteur s’inscrit, reçoit un code, le valide, obtient des jetons.
- **Refus** : un membre tente de lire l’adresse d’un autre → `404`.
- **Cas limite** : suppression demandée alors qu’une commande est ouverte → refus explicite.
- Vérifier que chaque scénario est couvert par une règle et un critère d’acceptation.

#### Critères de sortie

- [x] Les versions cibles sont identifiées ; leur verrouillage exact est planifié dans le lot 0 (D02).
- [x] Q01, Q02, Q03, Q05, Q09, Q10 et Q13 sont tranchées le 22/10/2026 (voir §8.3).
- [x] La matrice des accès est validée (§5.2).
- [x] Le contrat API et les ajouts `(+)` sont validés (§6.2).
- [x] Le modèle de données et les contraintes sont validés (§6.1).
- [x] Les trois scénarios papier sont tracés ci-dessous.
- [x] Le validateur a accepté le cadrage ; le passage à l’étape 1 reste conditionné à la
  livraison du lot 0.

#### Bilan d’exécution

- **Fichiers modifiés** : `docs/modules/comptes-identite.md` (v1.1) et
  `docs/conception/README.md` (lien vers le plan d’exécution).
- **Commandes et résultats** : aucune commande de code exécutée ; validation du cadrage
  reçue le 22/10/2026.
- **Preuves** : décisions D01, D02, D03, D09, D12, D13, D14 consignées au §8.3 ; matrice
  des accès, contrat API et modèle de données approuvés.
- **Limites** : le nom du validateur reste à compléter ; les versions exactes seront
  verrouillées dans le lot 0 ; les scénarios papier seront rejoués en test au début de
  l’étape 1 ; aucun code n’a encore été exécuté.
- **Décision** : cadrage accepté. La prochaine action est le **lot 0** ; l’étape 1 ne démarre
  qu’après la livraison du socle.

##### Scénarios papier tracés

| Scénario | Déroulé attendu | Règles | Résultat |
|---|---|---|---|
| Nominal | Inscription → code → vérification → jetons → `GET /v1/moi` | R01–R08 | `201` puis `200`, compte vérifié, session active |
| Refus d’accès | Membre A lit l’adresse/appareil/export de B | R08 | `404`, aucune donnée privée exposée |
| Cas limite | Refresh réutilisé après 60 s ; suppression avec commande ouverte ; deux adresses par défaut concurrentes | R07, R11, R09 | Révocation + `401` ; `409` explicite ; une seule adresse par défaut |

Ces scénarios sont cohérents avec les règles et le contrat. Ils seront rejoués en test
d’intégration aux étapes 1–3.

#### Validation

| Validateur | Date | Décision |
|---|---|---|
| **[nom à compléter]** | 22/10/2026 | ☑ acceptée ☐ corrections demandées |

> **Suite immédiate** : le **lot 0** (socle) a été validé le 22/10/2026 par la CI GitHub
> (migration PostgreSQL 16, tests Testcontainers, typecheck, lint et build verts). L’étape 1
> du module M1 peut démarrer.

---

### Étape 1 — Construire les données et les autorisations

**Statut : terminé — validé techniquement par la CI le 27/10/2026**

#### Objectif et prérequis

Disposer d’un schéma intègre, migrable et protégé, avant toute route métier. Prérequis :
étape 0 validée ; socle (lot 0) disponible ; PostgreSQL 16 et Redis disponibles en test.

#### Travaux à réaliser et fichiers concernés

1. Créer le schéma Prisma M1 : `Utilisateur`, `Profil`, `Adresse`, `Appareil`,
   `Verification`, `ReinitialisationMotDePasse`.
2. Écrire la migration et les contraintes SQL manuelles (index partiels, `CHECK`).
3. Implémenter les objets-valeurs (`Email`, `Pseudo`, `MotDePasse`, `DateNaissance`,
   `CodeVerification`, `JetonRefresh`).
4. Implémenter les politiques : vérification, suppression, session, mot de passe, adresse.
5. Implémenter les repositories Prisma et les mappers.
6. Créer les guards squelettes (`JwtAuthGuard`, `RolesGuard`, `ProprietaireGuard`,
   `EmailVerifieGuard`).
7. Écrire les factories et le seed de test.
8. Écrire les tests unitaires et d’intégration de l’étape.

Fichiers prévus (conformes à D01/D02) :

```
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/…
apps/api/src/modules/comptes/domain/…
apps/api/src/modules/comptes/infrastructure/persistance/…
apps/api/src/common/auth/…
apps/api/test/comptes/…
infra/scripts/seed/…
```

#### Règles applicables et points de vigilance

R01, R02, R03, R04, R08, R09, R10, R11, R14, R15. Points de vigilance : unicité concurrente,
index partiel de l’adresse par défaut, FK `RESTRICT` (pas de suppression physique),
anonymisation future, aucun champ dérivé stocké.

#### Livrables

- Schéma Prisma et migration up/down.
- Contraintes SQL et index vérifiés sur PostgreSQL 16.
- Domaine, politiques et repositories.
- Factories et seed de test.
- Tests unitaires et d’intégration de l’étape.

#### Tests et cas limites

- E-mail et pseudo uniques sous deux insertions concurrentes.
- Deux adresses par défaut concurrentes → une seule.
- Profil, adresse et appareil d’un autre membre → refus.
- Mot de passe haché en Argon2id, jamais sérialisé.
- Suppression logique d’une adresse référencée par une commande (fake M5).
- Migration `up` puis `down` sans perte de structure.
- Contrainte `supprime` ⇒ `supprime_le` non nul.

#### Critères de sortie

- [x] La migration passe sur PostgreSQL 16 de test et le rollback fonctionne.
- [x] Les index et contraintes existent réellement (vérification SQL).
- [x] Les tests de données et d’autorisations sont verts.
- [x] Aucun secret n’est présent dans le dépôt.
- [ ] Le validateur a signé le passage à l’étape 2.

#### Bilan d’exécution

- **Fichiers modifiés** : schéma Prisma et migration `20261022140000_m1_comptes` ;
  rollback dans `infra/migrations/down/` ; domaine, politiques, repositories et mappers
  sous `apps/api/src/modules/comptes/…` ; `EmailVerifieGuard` et module d’authentification ;
  factories et tests sous `apps/api/test/…` ; dépendance `argon2` et configuration Vitest
  d’intégration.
- **Commandes et résultats** : localement `pnpm format:check`, `pnpm lint`,
  `pnpm typecheck`, `pnpm test` (**68 tests unitaires**) et `pnpm build` sont verts. En CI,
  `prisma migrate deploy` applique les **2 migrations** sur PostgreSQL 16, puis les tests
  Testcontainers passent (**2 fichiers, 16 tests d’intégration**).
- **Preuves** : run de validation
  [`40472083821`](https://github.com/jinshiagencys-byte/Vinted-like/actions/runs/40472083821)
  — jobs `qualite` et `integration` verts ; aucun secret détecté dans les fichiers suivis.
- **Limites** : Docker n’est pas installé localement, donc les tests Testcontainers sont
  exécutés en CI ; le nom du validateur reste à compléter ; les routes et écrans ne sont pas
  encore implémentés (étape 2) ; le PAT utilisé pour le push doit être révoqué.
- **Décision** : étape 1 acceptée techniquement. L’étape 2 ne démarre qu’après validation
  explicite du porteur.

#### Validation

| Validateur | Date | Décision |
|---|---|---|
| CI GitHub (qualité + intégration) | 27/10/2026 | ☑ acceptée techniquement ☐ corrections demandées |
| [nom à compléter] | 27/10/2026 | ☐ acceptée ☐ corrections demandées |

---

### Étape 2 — Implémenter l’inscription, la vérification et les sessions

**Statut : implémenté — validation CI et signature humaine à confirmer**

#### Objectif et prérequis

Permettre à un visiteur de créer un compte, de vérifier son e-mail et d’obtenir une session
sûre. Prérequis : étape 1 validée ; `NotificationPort` avec stub Mailpit/fake ; Redis pour le
rate limiting.

#### Travaux à réaliser et fichiers concernés

1. Cas d’usage : `InscrireCompte`, `VerifierEmail`, `RenvoyerCodeEmail`, `Connecter`,
   `RafraichirSession`, `Deconnecter`.
2. Contrôleurs et schémas Zod pour les routes d’authentification.
3. Génération et hachage des codes ; envoi via outbox → `NotificationPort`.
4. Création de l’appareil à la vérification ; émission des jetons.
5. Guards : JWT, rôle, vérification e-mail, version de sécurité.
6. Rate limiting Redis et verrouillage progressif.
7. OpenAPI et client typé.
8. Tests d’intégration et de sécurité.

Fichiers prévus :

```
apps/api/src/modules/comptes/application/cas-usage/…
apps/api/src/modules/comptes/presentation/http/controleurs/auth.controleur.ts
apps/api/src/modules/comptes/presentation/http/schemas/auth.schema.ts
apps/api/src/modules/comptes/infrastructure/securite/…
apps/api/src/common/auth/…
apps/api/test/comptes/auth/…
packages/contracts/…
```

#### Règles applicables et points de vigilance

R01–R07, R12, R14, R16. Points de vigilance : aucun token délivré par l’inscription seule ; code haché et
à usage unique ; réponses génériques ; grâce de 60 s ; `version_securite` ; aucun PII dans
les logs ; l’échec d’envoi d’e-mail ne doit pas créer un compte inutilisable sans possibilité
de renvoi.

#### Livrables

- Routes d’inscription, vérification, renvoi, connexion, refresh, déconnexion.
- Génération/hachage des codes et jetons.
- Outbox + notification stub.
- Guards et rate limiting.
- OpenAPI et client typé.
- Tests et preuves d’exécution.

#### Tests et cas limites

- **Nominal** : inscription → code → vérification → jetons → `/v1/moi`.
- **Refus** : inscription en double, code faux, code expiré, 5 tentatives, compte suspendu.
- **Cas limite** : renvoi avant 60 s ; refresh réutilisé après la grâce ; deux refresh
  concurrents ; e-mail inconnu à la connexion (même réponse/temps) ; panne d’envoi d’e-mail
  (outbox en retry).
- Aucun token renvoyé par l’inscription seule.
- `429` avec `Retry-After` après 5 échecs.

#### Critères de sortie

- [x] CA01 (inscription → vérification → session) couvert par `comptes-http.integration.spec.ts`.
- [x] CA02 (compte non vérifié refusé sur une action protégée) couvert (export `403 email_non_verifie`).
- [x] CA03 (rotation, réutilisation, déconnexion) couvert.
- [x] Les réponses d’erreur respectent le contrat (`code`, `message`, `details`, `traceId`).
- [x] Aucun secret ni PII dans les réponses du scénario (assertions dédiées).
- [ ] Exécution de la suite d’intégration en CI et signature du validateur.

#### Bilan d’exécution

- **Fichiers modifiés** : cas d’usage `inscrire-compte`, `verifier-email`, `renvoyer-code-email`,
  `connecter`, `rafraichir-session`, `deconnecter`, `verifier-telephone`,
  `renvoyer-code-telephone` ; `service-sessions.ts` ; `auth.controleur.ts` ;
  `auth.schema.ts` ; `limiteur-debit.service.ts` ; guards JWT/email/version ;
  `packages/contracts/src/api.ts` ; `docs/openapi/m1-comptes.yaml` ;
  `apps/api/test/integration/comptes-http.integration.spec.ts`.
- **Commandes et résultats** : `pnpm lint`, `pnpm typecheck`, `pnpm test` (24 fichiers,
  80 tests), `pnpm build` et `pnpm --filter @secondevie/mobile typecheck` passent le
  27/10/2026. La suite d’intégration n’a pas été exécutée localement (Docker absent) :
  exécution de référence en CI.
- **Preuves** : tests HTTP inscription → vérification → `/v1/moi`, code faux/valide/rejoué,
  connexion générique, rotation et réutilisation du refresh, révocation au changement de
  mot de passe, export refusé avant vérification de l’e-mail.
- **Limites** : envoi e-mail/SMS branché sur l’outbox et un adaptateur de notification, sans
  fournisseur réel ; HIBP fail-open ; jetons d’accès HS256 sans rotation de clé.
- **Décision** : implémentation soumise à la validation CI et à la signature humaine.

#### Validation

| Validateur | Date | Décision |
|---|---|---|
| CI GitHub | 27/10/2026 | ☐ acceptée ☐ corrections demandées (exécution à venir) |
| Porteur | — | ☐ acceptée ☐ corrections demandées |

---

### Étape 3 — Implémenter la gestion du compte

**Statut : implémenté — validation CI et signature humaine à confirmer**

#### Objectif et prérequis

Permettre au membre de gérer son profil, ses adresses, ses appareils, son mot de passe, son
export et la suppression de son compte. Prérequis : étape 2 validée ; ports M5/M7/M9 avec
fakes ; S3/MinIO pour l’avatar.

#### Travaux à réaliser et fichiers concernés

1. `GET/PATCH /v1/moi`, profil public, avatar ; mise à jour et vérification du téléphone
   (routes `/v1/auth/telephone/*`, normalisation E.164, code, renvoi, remise à zéro de
   `telephoneVerifie` en cas de changement).
2. CRUD adresses, adresse par défaut, suppression logique.
3. Liste/révocation des appareils, mise à jour du push token.
4. Réinitialisation du mot de passe (demande + confirmation) et changement de mot de passe
   authentifié (`PATCH /v1/moi/mot-de-passe`).
5. Suppression du compte : vérification du mot de passe, blocages via ports, anonymisation.
6. Export asynchrone + URL signée.
7. Consommation de `reputation.recalculer` et `commande.cloturee` (compteurs) de façon
   idempotente.
8. Tests d’intégration et de sécurité.

Fichiers prévus :

```
apps/api/src/modules/comptes/application/cas-usage/…
apps/api/src/modules/comptes/presentation/http/controleurs/moi.controleur.ts
apps/api/src/modules/comptes/presentation/http/controleurs/adresses.controleur.ts
apps/api/src/modules/comptes/presentation/http/controleurs/appareils.controleur.ts
apps/api/src/modules/comptes/infrastructure/adaptateurs/…
apps/api/src/modules/comptes/workers/export.worker.ts
apps/api/test/comptes/compte/…
```

#### Règles applicables et points de vigilance

R08–R16. Points de vigilance : IDOR, adresse par défaut concurrente, suppression logique,
fail-closed si M5/M7 indisponible, anonymisation complète, export signé et expirant,
révocation de tous les refresh tokens au changement de mot de passe, remise à zéro de la
vérification téléphone en cas de changement de numéro.

#### Livrables

- Toutes les routes de gestion du compte.
- Suppression/anonymisation et export.
- Consommation idempotente de la réputation.
- Tests et preuves.

#### Tests et cas limites

- **Nominal** : mise à jour du profil, ajout d’une adresse, définition par défaut,
  révocation d’un appareil, export.
- **Refus** : A accède à l’adresse/appareil/export de B → `404` ; profil public sans champs
  privés.
- **Cas limite** : suppression avec commande ouverte → `409` ; deux adresses par défaut
  concurrentes ; jeton de reset réutilisé → `401` ; changement de mot de passe → autres
  sessions révoquées ; M5 indisponible → suppression refusée (fail-closed).
- Vérifier que le téléphone est requis avant le premier achat (M5) et que
  `nomComplet`, `dateNaissance`, `telephone` conditionnent `kycLegerComplet`.
- Téléphone : changement de numéro → `telephoneVerifie` repasse à `false` ; code faux
  5 fois → blocage ; renvoi avant 60 s → `429`.

#### Critères de sortie

- [ ] CA04 (périmètre des données) est vérifié.
- [ ] CA05 (suppression avec blocages et anonymisation) est vérifié.
- [ ] CA06 (concurrence adresse/e-mail/pseudo) est vérifié.
- [ ] L’export est asynchrone et l’URL expire.
- [ ] Les événements de réputation sont idempotents.
- [ ] Le validateur a signé le passage à l’étape 4.

#### Bilan d’exécution

> À compléter après exécution.

- **Fichiers modifiés** : …
- **Commandes et résultats** : …
- **Preuves** : …
- **Limites** : …
- **Décision** : …

#### Validation

| Validateur | Date | Décision |
|---|---|---|
| … | … | ☐ acceptée ☐ corrections demandées |

---

### Étape 4 — Réaliser les parcours mobiles

**Statut : implémenté — recette manuelle à confirmer**

#### Objectif et prérequis

Permettre les parcours d’inscription, connexion, profil, adresses, sécurité et suppression
sans ambiguïté, avec les états réseau. Prérequis : étapes 1–3 validées ; contrat OpenAPI
stable ; client typé généré ; bibliothèque UI tranchée (Q11).

#### Travaux à réaliser et fichiers concernés

1. Types et client API générés depuis OpenAPI.
2. Écrans d’inscription, vérification, connexion, mot de passe oublié.
3. Écran profil, adresses, sécurité/sessions, suppression, export.
4. Profil public.
5. Stockage sécurisé des jetons (SecureStore).
6. Gestion des états : chargement, vide, erreur + réessai, hors ligne, succès, action en cours.
7. Accessibilité et français.
8. Tests de composants et parcours manuel.

Fichiers prévus :

```
packages/contracts/…
apps/mobile/app/(auth)/…
apps/mobile/app/(tabs)/moi/…
apps/mobile/app/utilisateur/[pseudo].tsx
apps/mobile/src/services/…
apps/mobile/src/components/…
```

#### Règles applicables et points de vigilance

R02, R05, R06, R08, R09, R11, R12, R15. Points de vigilance : ne jamais afficher un champ
privé dans le profil public ; conserver la saisie en cas d’échec ; ne pas proposer une action
que le serveur refusera ; jetons uniquement dans SecureStore ; messages d’erreur compréhensibles.

#### Livrables

- Parcours visiteur/membre complets.
- États réseau et feedback.
- Tests de composants et preuves de parcours.
- Aucun token en clair dans les logs ou le stockage non sécurisé.

#### Tests et cas limites

- **Nominal** : inscription → vérification → connexion → profil → adresse → déconnexion.
- **Refus** : l’écran ne montre pas les données d’un autre membre ; l’API renvoie `404` et
  l’écran affiche un état neutre.
- **Cas limite** : perte réseau pendant l’inscription (brouillon conservé) ; refresh expiré
  (retour à la connexion) ; suppression bloquée (message explicite) ; petit écran et
  navigation clavier.
- Vérifier qu’aucun token n’apparaît dans les logs ou dans `AsyncStorage`.

#### Critères de sortie

- [x] Type-check mobile réussi (`pnpm --filter @secondevie/mobile typecheck`).
- [ ] Build natif EAS / émulateur à exécuter.
- [x] Les parcours nominal, refus et cas limite sont implémentés.
- [x] Les états chargement/vide/erreur/hors ligne existent.
- [ ] L’accessibilité minimale est vérifiée manuellement.
- [ ] Recette manuelle iOS/Android et signature du validateur.

#### Bilan d’exécution

- **Fichiers modifiés** : `apps/mobile/app/(auth)/*`, `app/(tabs)/*`,
  `app/utilisateur/[pseudo].tsx`, `app/index.tsx`, `app/+not-found.tsx`,
  `src/auth/FournisseurSession.tsx`, `src/services/*`, `src/components/*`,
  `src/hooks/useReseau.ts`, configuration Expo/Babel/Metro/TypeScript.
- **Commandes et résultats** : `pnpm install` (Expo SDK 58), `pnpm --filter
  @secondevie/mobile typecheck` réussi le 27/10/2026. Aucun build natif ni test de
  composant exécuté.
- **Preuves** : navigation Expo Router, garde de session, jetons dans SecureStore,
  brouillon d’inscription sans mot de passe, bannière hors ligne, profil public 404 neutre.
- **Limites** : composants natifs, pas de bibliothèque UI (Q11) ; pas de tests de
  composants automatisés ; pas de build iOS/Android dans cet environnement.
- **Décision** : implémentation soumise à la recette manuelle et à la signature humaine.

#### Validation

| Validateur | Date | Décision |
|---|---|---|
| Porteur | — | ☐ acceptée ☐ corrections demandées |

---

### Étape 5 — Recetter et préparer la livraison

**Statut : recette préparée — exécution CI et validation humaine à confirmer**

#### Objectif et prérequis

Prouver que le module répond au besoin global et préparer une livraison reproductible.
Prérequis : étapes 1–4 terminées ; environnement de test isolé ; jeux de données de recette.

#### Travaux à réaliser et fichiers concernés

1. Exécuter la recette globale (CA01–CA06).
2. Corriger les défauts bloquants.
3. Mettre à jour ce plan et le journal des décisions.
4. Documenter l’installation, les migrations, le rollback et les limites connues.
5. Vérifier les logs, l’absence de PII et les accès.
6. Préparer la démonstration avec deux membres et un admin.

Fichiers concernés : ce document, `docs/runbooks/comptes.md` (à créer), `docs/adr/…`.

#### Règles applicables et points de vigilance

Toutes les règles R01–R16. Aucune donnée de démonstration en production. Aucune livraison
annoncée sans exécution réelle. Le déploiement est une action distincte, soumise à
autorisation.

#### Livrables

- Rapport de recette avec résultats réels.
- Commandes de vérification.
- Limites connues.
- Procédure de migration et de rollback.
- Journal des décisions complété.
- Validation finale.

#### Tests et cas limites

- Scénario complet avec deux membres et un admin.
- Concurrence sur PostgreSQL (e-mail, pseudo, adresse par défaut, refresh).
- Consultation de l’historique et des données pseudonymisées après suppression.
- Contrôle des logs et des données exposées.
- Export RGPD et expiration du lien.
- Parcours mobile sur petit écran et en perte de réseau.

#### Critères de sortie

- [x] CA01–CA06 disposent d’un test automatisé ou d’une procédure documentée.
- [ ] Exécution réelle de la suite d’intégration en CI.
- [x] Les limites connues sont documentées dans `docs/runbooks/comptes.md`.
- [ ] La procédure de migration/rollback est testée sur une base jetable.
- [x] Les tests et la revue ne montrent aucune PII ni secret dans les réponses.
- [ ] Le validateur a signé la recette.
- [ ] Le déploiement est explicitement autorisé (action séparée).

#### Bilan d’exécution

- **Fichiers modifiés** : `docs/runbooks/comptes.md` (créé), ce plan, journal des décisions.
- **Commandes et résultats** : `pnpm lint`, `pnpm typecheck`, `pnpm test` (24 fichiers,
  80 tests), `pnpm build`, `pnpm --filter @secondevie/mobile typecheck` passent le
  27/10/2026. La suite Testcontainers reste à exécuter en CI.
- **Preuves** : runbook d’installation, migrations, rollback, recette CA01–CA06, limites.
- **Limites** : pas de Docker local, pas de build mobile natif, pas de fournisseur
  e-mail/SMS réel, pas d’intégration M5/M7/M9 réelle.
- **Décision** : livraison non annoncée ; validation CI et humaine requises.

#### Validation

| Validateur | Date | Décision |
|---|---|---|
| CI GitHub | 27/10/2026 | ☐ acceptée ☐ corrections demandées (exécution à venir) |
| Porteur | — | ☐ acceptée ☐ corrections demandées |

---

## 10. Recette globale

### 10.1 Critères d’acceptation

| Réf. | Critère | Preuve attendue |
|---|---|---|
| **CA01** | Un visiteur s’inscrit, reçoit un code, le valide, obtient un access/refresh token et peut lire `/v1/moi`. | Test d’intégration + capture du parcours |
| **CA02** | Un membre non vérifié peut se connecter et gérer son compte, mais une action protégée renvoie `403 email_non_verifie`. | Test d’autorisation |
| **CA03** | Le refresh est rotatif ; un refresh réutilisé après la grâce révoque l’appareil ; la déconnexion est idempotente. | Test de concurrence + test d’intégration |
| **CA04** | Un membre ne peut ni lire ni modifier les données privées d’un autre ; le profil public ne contient aucun champ privé. | Test IDOR + inspection de réponse |
| **CA05** | La suppression est refusée avec un motif si une commande/litige/solde l’interdit ; sinon elle anonymise et révoque les sessions. | Test avec fakes M5/M7 |
| **CA06** | Deux créations concurrentes (e-mail, pseudo ou adresse par défaut) produisent un seul gagnant, sans `500`. | Test concurrent sur PostgreSQL |

### 10.2 Scénarios de recette

1. **Nominal** : inscription → vérification → connexion → profil → adresse → refresh →
   déconnexion → reconnexion.
2. **Refus d’accès** : membre A tente de lire/modifier l’adresse, l’appareil ou l’export de B
   → `404` ; le profil public de B ne montre que les champs publics.
3. **Cas limite** : deux adresses par défaut concurrentes → une seule ; refresh réutilisé →
   révocation ; suppression avec commande ouverte → `409` ; code expiré → renvoi.
4. **Sécurité** : JWT falsifié/expiré, rate limit, énumération de compte, logs sans PII.
5. **Mobile** : perte réseau pendant l’inscription, reprise, petit écran, navigation clavier.

### 10.3 Limites connues

- Connexion sociale, MFA et KYC renforcé sont hors v1.
- L’envoi e-mail/SMS réel dépend de M8 ; en local, Mailpit/fake.
- Les sanctions, commandes, litiges et soldes sont simulés par des ports tant que M5/M7
  n’existent pas.
- L’export RGPD est limité à M1 dans un premier temps (D08), sauf décision contraire.
- L’interface back-office (M9) n’est pas développée ; seuls les ports sont exposés.
- La détection de mots de passe compromis dépend d’un service externe (HIBP) ; le mode de
  panne est **fail-open avec alerte** (D13).

### 10.4 Consignes de livraison

- Fournir la migration et la procédure de rollback.
- Documenter les variables d’environnement dans `.env.example`.
- Fournir les commandes de seed et de test.
- Ne pas livrer de données de démonstration en production.
- Le déploiement est une action séparée, autorisée explicitement.
- Joindre le rapport de recette et les limites connues.

---

## 11. Journal des décisions

| Date | Réf. | Décision | Validateur | Impact |
|---|---|---|---|---|
| 22/10/2026 | — | Création du plan, statut « à valider » | — | Cadrage initial |
| 22/10/2026 | D01 / Q01 | Domaine et base en français, frameworks en anglais | [nom à compléter] | Nommage et migrations |
| 22/10/2026 | D02 / Q02 | Lot 0 séparé pour le socle | [nom à compléter] | Planning ; étape 1 après le lot 0 |
| 22/10/2026 | D03 / Q03 | Téléphone facultatif à l’inscription, obligatoire avant achat ou virement | [nom à compléter] | R05, R13, écrans |
| 22/10/2026 | D12 / Q05 | `restreint` = lecture + gestion du compte uniquement | [nom à compléter] | R06, R10, guards M2/M4/M5 |
| 22/10/2026 | D13 / Q09 | Vérification de fuite en fail-open avec alerte | [nom à compléter] | R04, disponibilité |
| 22/10/2026 | D09 / Q10 | Profil public sans annonces ; composition côté mobile avec M3 | [nom à compléter] | Contrat et dépendances |
| 22/10/2026 | D14 / Q13 | Téléphone unique lorsqu’il est renseigné | [nom à compléter] | R01/R13, données |
| 22/10/2026 | — | Validation de la matrice des accès, du contrat API et du modèle de données | [nom à compléter] | Cadrage validé ; prochaine action : lot 0 |
| 22/10/2026 | Q04, Q06–Q08, Q11, Q12, Q14 | Questions non bloquantes laissées ouvertes | — | À trancher avant l’étape concernée |
| 27/10/2026 | — | Étape 1 implémentée et validée techniquement par la CI (68 tests unitaires, 16 tests d’intégration, 2 migrations) | CI GitHub | Données et autorisations prêtes ; étape 2 en attente de validation explicite |
| 27/10/2026 | D04, D06, D08, D10, D11, D14 | Étapes 2–4 implémentées avec les valeurs provisoires : suppression immédiate, JWT 15 min/refresh 30 j, export M1, HS256 + `kid`, pas de changement d’e-mail, 10 appareils | Responsable technique | API, contrats et mobile prêts ; CI et recette humaine à exécuter |
| 27/10/2026 | Q06, Q07, Q08, Q11, Q12, Q14 | Questions laissées ouvertes et documentées comme limites | — | À trancher avant M2/M9 |

---

## 12. Consignes d’exécution pour l’IA

1. **Lire** ce plan, le document d’architecture et les fichiers existants avant de proposer
   quoi que ce soit.
2. **Vérifier** la cohérence avec le dépôt réel ; ne jamais inventer un champ, une route ou
   un comportement existant.
3. **Signaler** les informations manquantes et les conflits ; proposer les décisions à prendre
   avant l’étape 0.
4. **Implémenter une seule étape à la fois**, après validation explicite de la précédente.
5. **Respecter** les règles référencées (R01–R16) et les conventions existantes.
6. **Préserver** les modifications sans rapport avec l’étape en cours.
7. **Exécuter** les tests prévus et rapporter les résultats réels.
8. **Mettre à jour** le bilan d’exécution : fichiers modifiés, commandes, résultats, preuves,
   limites.
9. **Ne pas** annoncer « terminé », « testé » ou « validé » sans preuve.
10. **Attendre** la validation humaine avant de passer à l’étape suivante.
