-- Rollback manuel de M2. Doit rester l'exact inverse de la migration up.

DROP TABLE IF EXISTS "referentiels_tailles" CASCADE;
DROP TABLE IF EXISTS "favoris" CASCADE;
DROP TABLE IF EXISTS "photos" CASCADE;
DROP TABLE IF EXISTS "annonces" CASCADE;
DROP TABLE IF EXISTS "marques" CASCADE;
DROP TABLE IF EXISTS "categories" CASCADE;

DROP TYPE IF EXISTS "SystemeTaille";
DROP TYPE IF EXISTS "StatutModerationPhoto";
DROP TYPE IF EXISTS "StatutTraitementPhoto";
DROP TYPE IF EXISTS "EtatArticle";
DROP TYPE IF EXISTS "StatutAnnonce";
