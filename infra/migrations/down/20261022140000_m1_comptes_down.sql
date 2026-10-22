-- Rollback manuel de la migration M1 comptes.
-- Prisma ne génère pas de down automatique ; ce fichier est utilisé par les
-- tests d'intégration et doit rester l'exact inverse de la migration up.

DROP TABLE IF EXISTS "reinitialisations_mot_de_passe" CASCADE;
DROP TABLE IF EXISTS "verifications" CASCADE;
DROP TABLE IF EXISTS "appareils" CASCADE;
DROP TABLE IF EXISTS "adresses" CASCADE;
DROP TABLE IF EXISTS "profils" CASCADE;
DROP TABLE IF EXISTS "utilisateurs" CASCADE;

DROP TYPE IF EXISTS "VisibiliteProfil";
DROP TYPE IF EXISTS "Plateforme";
DROP TYPE IF EXISTS "StatutVerification";
DROP TYPE IF EXISTS "TypeVerification";
DROP TYPE IF EXISTS "RoleCompte";
DROP TYPE IF EXISTS "StatutCompte";
