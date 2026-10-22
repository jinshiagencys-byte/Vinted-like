-- M1 étape 1 : données de compte et autorisations.
-- Les FK internes sont en RESTRICT : la suppression d'un compte est logique
-- (anonymisation), jamais une suppression physique en cascade.

CREATE TYPE "StatutCompte" AS ENUM ('actif', 'restreint', 'suspendu', 'supprime');
CREATE TYPE "RoleCompte" AS ENUM ('membre', 'moderateur', 'admin');
CREATE TYPE "TypeVerification" AS ENUM ('email', 'telephone', 'identite');
CREATE TYPE "StatutVerification" AS ENUM ('en_attente', 'valide', 'refuse', 'expire');
CREATE TYPE "Plateforme" AS ENUM ('ios', 'android', 'web');
CREATE TYPE "VisibiliteProfil" AS ENUM ('public', 'membres');

CREATE TABLE "utilisateurs" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "telephone" VARCHAR(20),
    "mot_de_passe_hash" TEXT,
    "pseudo" VARCHAR(30) NOT NULL,
    "pseudo_normalise" VARCHAR(30) NOT NULL,
    "nom_complet" VARCHAR(120),
    "date_naissance" DATE,
    "pays" CHAR(2) NOT NULL DEFAULT 'FR',
    "statut" "StatutCompte" NOT NULL DEFAULT 'actif',
    "role" "RoleCompte" NOT NULL DEFAULT 'membre',
    "email_verifie_le" TIMESTAMPTZ(3),
    "telephone_verifie_le" TIMESTAMPTZ(3),
    "note_moyenne" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "nb_ventes" INTEGER NOT NULL DEFAULT 0,
    "nb_achats" INTEGER NOT NULL DEFAULT 0,
    "reputation_version" INTEGER NOT NULL DEFAULT 0,
    "version_securite" INTEGER NOT NULL DEFAULT 0,
    "derniere_connexion_le" TIMESTAMPTZ(3),
    "supprime_le" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "utilisateurs_email_normalise_check" CHECK ("email" = lower(btrim("email"))),
    CONSTRAINT "utilisateurs_pseudo_normalise_check" CHECK ("pseudo_normalise" = lower("pseudo")),
    CONSTRAINT "utilisateurs_telephone_e164_check"
        CHECK ("telephone" IS NULL OR "telephone" ~ '^\+[1-9][0-9]{7,14}$'),
    CONSTRAINT "utilisateurs_note_moyenne_check"
        CHECK ("note_moyenne" >= 0 AND "note_moyenne" <= 5),
    CONSTRAINT "utilisateurs_supprime_coherent"
        CHECK ("statut" <> 'supprime' OR "supprime_le" IS NOT NULL)
);

CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs" ("email");
CREATE UNIQUE INDEX "utilisateurs_pseudo_normalise_key" ON "utilisateurs" ("pseudo_normalise");
CREATE UNIQUE INDEX "utilisateurs_telephone_key" ON "utilisateurs" ("telephone");
CREATE INDEX "utilisateurs_statut_idx" ON "utilisateurs" ("statut");
CREATE INDEX "utilisateurs_cree_le_idx" ON "utilisateurs" ("cree_le");

CREATE TABLE "profils" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "avatar_url" TEXT,
    "bio" VARCHAR(300),
    "taille_cm" INTEGER,
    "pointure" INTEGER,
    "styles_preferes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "visibilite" "VisibiliteProfil" NOT NULL DEFAULT 'public',
    "langue" CHAR(2) NOT NULL DEFAULT 'fr',
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "profils_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "profils_utilisateur_id_key" UNIQUE ("utilisateur_id"),
    CONSTRAINT "profils_taille_cm_check"
        CHECK ("taille_cm" IS NULL OR ("taille_cm" >= 120 AND "taille_cm" <= 230)),
    CONSTRAINT "profils_pointure_check"
        CHECK ("pointure" IS NULL OR ("pointure" >= 15 AND "pointure" <= 50)),
    CONSTRAINT "profils_styles_preferes_max_check"
        CHECK (cardinality("styles_preferes") <= 5),
    CONSTRAINT "profils_utilisateur_id_fkey"
        FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "adresses" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "libelle" VARCHAR(40) NOT NULL,
    "destinataire" VARCHAR(120) NOT NULL,
    "ligne1" VARCHAR(120) NOT NULL,
    "ligne2" VARCHAR(120),
    "code_postal" VARCHAR(10) NOT NULL,
    "ville" VARCHAR(120) NOT NULL,
    "pays" CHAR(2) NOT NULL DEFAULT 'FR',
    "telephone" VARCHAR(20) NOT NULL,
    "est_defaut" BOOLEAN NOT NULL DEFAULT false,
    "supprimee_le" TIMESTAMPTZ(3),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "adresses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "adresses_defaut_supprimee_check"
        CHECK (NOT ("est_defaut" AND "supprimee_le" IS NOT NULL)),
    CONSTRAINT "adresses_utilisateur_id_fkey"
        FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "adresses_utilisateur_id_idx" ON "adresses" ("utilisateur_id");

-- Une seule adresse par défaut active par utilisateur.
CREATE UNIQUE INDEX "adresses_defaut_unique"
    ON "adresses" ("utilisateur_id")
    WHERE "est_defaut" = true AND "supprimee_le" IS NULL;

CREATE TABLE "appareils" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "plateforme" "Plateforme" NOT NULL,
    "device_id" VARCHAR(128) NOT NULL,
    "refresh_token_hash" VARCHAR(128),
    "refresh_token_precedent_hash" VARCHAR(128),
    "refresh_token_rotated_le" TIMESTAMPTZ(3),
    "refresh_token_expire_le" TIMESTAMPTZ(3),
    "push_token" VARCHAR(512),
    "derniere_activite_le" TIMESTAMPTZ(3),
    "revoque_le" TIMESTAMPTZ(3),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appareils_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "appareils_utilisateur_id_device_id_key" UNIQUE ("utilisateur_id", "device_id"),
    CONSTRAINT "appareils_utilisateur_id_fkey"
        FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "appareils_refresh_token_hash_key"
    ON "appareils" ("refresh_token_hash");
CREATE INDEX "appareils_utilisateur_id_revoque_le_idx"
    ON "appareils" ("utilisateur_id", "revoque_le");

CREATE TABLE "verifications" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "type" "TypeVerification" NOT NULL,
    "statut" "StatutVerification" NOT NULL DEFAULT 'en_attente',
    "fournisseur_ref" VARCHAR(120),
    "code_hash" VARCHAR(128),
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "expire_le" TIMESTAMPTZ(3) NOT NULL,
    "valide_le" TIMESTAMPTZ(3),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "verifications_tentatives_check"
        CHECK ("tentatives" >= 0 AND "tentatives" <= 5),
    CONSTRAINT "verifications_utilisateur_id_fkey"
        FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "verifications_utilisateur_id_type_statut_idx"
    ON "verifications" ("utilisateur_id", "type", "statut");
CREATE INDEX "verifications_expire_le_idx" ON "verifications" ("expire_le");

-- Un seul code actif par (utilisateur, type).
CREATE UNIQUE INDEX "verifications_actives_unique"
    ON "verifications" ("utilisateur_id", "type")
    WHERE "statut" = 'en_attente';

CREATE TABLE "reinitialisations_mot_de_passe" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "jeton_hash" VARCHAR(128) NOT NULL,
    "expire_le" TIMESTAMPTZ(3) NOT NULL,
    "utilise_le" TIMESTAMPTZ(3),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reinitialisations_mot_de_passe_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reinitialisations_mot_de_passe_utilisateur_id_fkey"
        FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "reinitialisations_mot_de_passe_jeton_hash_key"
    ON "reinitialisations_mot_de_passe" ("jeton_hash");
CREATE INDEX "reinitialisations_mot_de_passe_utilisateur_id_idx"
    ON "reinitialisations_mot_de_passe" ("utilisateur_id");
