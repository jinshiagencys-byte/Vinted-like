import { z } from 'zod';
import { ETATS_ARTICLE, STATUTS_ANNONCE } from '../../../domain/enums';

const champsAnnonce = {
  titre: z.string().trim().min(5).max(80).optional(),
  description: z.string().trim().min(20).max(2_000).optional(),
  categorieId: z.string().uuid().nullable().optional(),
  marqueId: z.string().uuid().nullable().optional(),
  taille: z.string().trim().min(1).max(12).nullable().optional(),
  etat: z.enum(ETATS_ARTICLE).nullable().optional(),
  couleur: z.string().trim().min(1).max(30).nullable().optional(),
  matiere: z.string().trim().min(1).max(60).nullable().optional(),
  prixCents: z.number().int().min(100).max(500_000).nullable().optional(),
  prixOrigineCents: z.number().int().min(100).max(500_000).nullable().optional(),
  poidsG: z.number().int().min(50).max(30_000).nullable().optional(),
};

export const creerAnnonceSchema = z.object(champsAnnonce).strict();

export const modifierAnnonceSchema = z
  .object({
    version: z.number().int().min(0),
    ...champsAnnonce,
  })
  .strict();

export const listerMesAnnoncesSchema = z
  .object({
    statut: z.enum(STATUTS_ANNONCE).optional(),
    curseur: z.string().max(500).optional(),
    limite: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const publierAnnonceSchema = z.object({ version: z.number().int().min(0) }).strict();
