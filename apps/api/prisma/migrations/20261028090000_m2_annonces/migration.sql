-- M2 : annonces, photos, favoris et référentiels.
-- Les FK internes à M2 sont explicites ; favoris.utilisateur_id reste sans FK
-- vers M1 (intégrité applicative via ComptesQueryPort), conformément à M2-Q12.

CREATE TYPE "StatutAnnonce" AS ENUM (
  'brouillon', 'en_revue', 'publiee', 'reservee', 'vendue', 'archivee', 'refusee'
);
CREATE TYPE "EtatArticle" AS ENUM (
  'neuf_avec_etiquette', 'neuf_sans_etiquette', 'tres_bon', 'bon', 'satisfaisant'
);
CREATE TYPE "StatutTraitementPhoto" AS ENUM ('en_attente', 'televersee', 'traitee', 'rejetee');
CREATE TYPE "StatutModerationPhoto" AS ENUM ('ok', 'a_verifier', 'refusee');
CREATE TYPE "SystemeTaille" AS ENUM ('EU', 'UK', 'US', 'FR', 'universel');

CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "nom" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "niveau" INTEGER NOT NULL,
    "taille_obligatoire" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "categories_niveau_check" CHECK ("niveau" BETWEEN 0 AND 2),
    CONSTRAINT "categories_parent_id_fkey"
        FOREIGN KEY ("parent_id") REFERENCES "categories"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "categories_slug_key" ON "categories" ("slug");
CREATE INDEX "categories_parent_id_ordre_idx" ON "categories" ("parent_id", "ordre");
CREATE UNIQUE INDEX "categories_nom_racine_unique"
    ON "categories" ("nom") WHERE "parent_id" IS NULL;
CREATE UNIQUE INDEX "categories_nom_parent_unique"
    ON "categories" ("parent_id", "nom") WHERE "parent_id" IS NOT NULL;

CREATE TABLE "marques" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(80) NOT NULL,
    "nom_normalise" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "logo_url" TEXT,
    "verifiee" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "marques_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marques_nom_normalise_key" ON "marques" ("nom_normalise");
CREATE UNIQUE INDEX "marques_slug_key" ON "marques" ("slug");
CREATE INDEX "marques_actif_nom_normalise_idx" ON "marques" ("actif", "nom_normalise");

CREATE TABLE "annonces" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(12) NOT NULL,
    "vendeur_id" UUID NOT NULL,
    "titre" VARCHAR(80),
    "description" VARCHAR(2000),
    "categorie_id" UUID,
    "marque_id" UUID,
    "taille" VARCHAR(12),
    "etat" "EtatArticle",
    "couleur" VARCHAR(30),
    "matiere" VARCHAR(60),
    "prix_cents" INTEGER,
    "prix_origine_cents" INTEGER,
    "devise" CHAR(3) NOT NULL DEFAULT 'EUR',
    "poids_g" INTEGER,
    "statut" "StatutAnnonce" NOT NULL DEFAULT 'brouillon',
    "motif_refus" VARCHAR(300),
    "nb_vues" INTEGER NOT NULL DEFAULT 0,
    "nb_favoris" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "publiee_le" TIMESTAMPTZ(3),
    "archivee_le" TIMESTAMPTZ(3),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maj_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "annonces_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "annonce_prix_bornes"
        CHECK ("prix_cents" IS NULL OR "prix_cents" BETWEEN 100 AND 500000),
    CONSTRAINT "annonce_prix_origine"
        CHECK (
            "prix_origine_cents" IS NULL
            OR "prix_cents" IS NULL
            OR "prix_origine_cents" >= "prix_cents"
        ),
    CONSTRAINT "annonce_poids_bornes"
        CHECK ("poids_g" IS NULL OR "poids_g" BETWEEN 50 AND 30000),
    CONSTRAINT "annonce_refus_motif"
        CHECK ("statut" <> 'refusee' OR "motif_refus" IS NOT NULL),
    CONSTRAINT "annonce_publiee_date"
        CHECK ("statut" NOT IN ('publiee', 'reservee', 'vendue') OR "publiee_le" IS NOT NULL),
    CONSTRAINT "annonce_complete_si_soumise"
        CHECK (
            "statut" IN ('brouillon', 'archivee')
            OR (
                "titre" IS NOT NULL
                AND "description" IS NOT NULL
                AND "categorie_id" IS NOT NULL
                AND "etat" IS NOT NULL
                AND "couleur" IS NOT NULL
                AND "prix_cents" IS NOT NULL
                AND "poids_g" IS NOT NULL
            )
        ),
    CONSTRAINT "annonce_compteurs_positifs"
        CHECK ("nb_vues" >= 0 AND "nb_favoris" >= 0),
    CONSTRAINT "annonces_categorie_id_fkey"
        FOREIGN KEY ("categorie_id") REFERENCES "categories"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "annonces_marque_id_fkey"
        FOREIGN KEY ("marque_id") REFERENCES "marques"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "annonces_reference_key" ON "annonces" ("reference");
CREATE INDEX "annonces_vendeur_id_statut_maj_le_idx"
    ON "annonces" ("vendeur_id", "statut", "maj_le");
CREATE INDEX "annonces_statut_publiee_le_idx" ON "annonces" ("statut", "publiee_le");
CREATE INDEX "annonces_categorie_id_statut_idx" ON "annonces" ("categorie_id", "statut");
CREATE INDEX "annonces_marque_id_idx" ON "annonces" ("marque_id");
-- Un vendeur ne peut avoir qu'une annonce par référence (déjà globalement unique),
-- et le quota est contrôlé par verrou consultatif applicatif.

CREATE TABLE "photos" (
    "id" UUID NOT NULL,
    "annonce_id" UUID NOT NULL,
    "url_originale" TEXT,
    "url_variantes" JSONB,
    "ordre" INTEGER NOT NULL,
    "largeur" INTEGER,
    "hauteur" INTEGER,
    "percept_hash" VARCHAR(16),
    "statut_traitement" "StatutTraitementPhoto" NOT NULL DEFAULT 'en_attente',
    "statut_moderation" "StatutModerationPhoto" NOT NULL DEFAULT 'ok',
    "taille_octets" INTEGER,
    "mime_type" VARCHAR(40),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "photos_ordre_positif" CHECK ("ordre" >= 0),
    CONSTRAINT "photos_annonce_id_fkey"
        FOREIGN KEY ("annonce_id") REFERENCES "annonces"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "photos_ordre_unique" UNIQUE ("annonce_id", "ordre")
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX "photos_annonce_id_ordre_idx" ON "photos" ("annonce_id", "ordre");
CREATE INDEX "photos_percept_hash_idx" ON "photos" ("percept_hash");

CREATE TABLE "favoris" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "annonce_id" UUID NOT NULL,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favoris_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "favoris_annonce_id_fkey"
        FOREIGN KEY ("annonce_id") REFERENCES "annonces"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "favoris_utilisateur_id_annonce_id_key"
    ON "favoris" ("utilisateur_id", "annonce_id");
CREATE INDEX "favoris_annonce_id_idx" ON "favoris" ("annonce_id");
CREATE INDEX "favoris_utilisateur_id_cree_le_idx" ON "favoris" ("utilisateur_id", "cree_le");

CREATE TABLE "referentiels_tailles" (
    "id" UUID NOT NULL,
    "categorie_id" UUID NOT NULL,
    "systeme" "SystemeTaille" NOT NULL,
    "libelle" VARCHAR(12) NOT NULL,
    "equivalent_cm" INTEGER,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referentiels_tailles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "referentiels_tailles_categorie_id_fkey"
        FOREIGN KEY ("categorie_id") REFERENCES "categories"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "referentiels_tailles_categorie_id_systeme_libelle_key"
    ON "referentiels_tailles" ("categorie_id", "systeme", "libelle");
CREATE INDEX "referentiels_tailles_categorie_id_ordre_idx"
    ON "referentiels_tailles" ("categorie_id", "ordre");
