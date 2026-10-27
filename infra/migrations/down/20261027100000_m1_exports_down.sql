-- Rollback manuel de la migration des exports RGPD.
DROP TABLE IF EXISTS "exports_rgpd" CASCADE;
DROP TYPE IF EXISTS "StatutExport";
