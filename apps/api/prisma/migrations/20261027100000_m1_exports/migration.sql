-- M1 étape 3 : suivi des exports RGPD asynchrones.
CREATE TYPE "StatutExport" AS ENUM ('en_attente', 'pret', 'echoue', 'expire');

CREATE TABLE "exports_rgpd" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "statut" "StatutExport" NOT NULL DEFAULT 'en_attente',
    "url_signee" TEXT,
    "expire_le" TIMESTAMPTZ(3),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termine_le" TIMESTAMPTZ(3),

    CONSTRAINT "exports_rgpd_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "exports_rgpd_utilisateur_id_fkey"
        FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "exports_rgpd_utilisateur_id_cree_le_idx"
    ON "exports_rgpd" ("utilisateur_id", "cree_le");
