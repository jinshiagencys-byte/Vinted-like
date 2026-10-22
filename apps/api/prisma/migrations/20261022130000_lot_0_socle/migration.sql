-- Lot 0 : socle outbox/inbox.
-- Migration volontairement limitée aux tables transverses ; les tables M1 arrivent à l'étape 1.

CREATE TABLE "outbox_evenements" (
    "id" UUID NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "agregat_type" VARCHAR(40) NOT NULL,
    "agregat_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "trace_id" VARCHAR(32),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publie_le" TIMESTAMPTZ(3),
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "derniere_erreur" TEXT,

    CONSTRAINT "outbox_evenements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outbox_evenements_publie_le_cree_le_idx"
    ON "outbox_evenements" ("publie_le", "cree_le");

CREATE TABLE "inbox_evenements" (
    "evenement_id" UUID NOT NULL,
    "consommateur" VARCHAR(80) NOT NULL,
    "traite_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inbox_evenements_pkey" PRIMARY KEY ("evenement_id", "consommateur")
);
