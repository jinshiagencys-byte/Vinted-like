import { z } from 'zod';

export const profilSchema = z.object({
  avatarUrl: z.string().trim().max(2048).nullable().optional(),
  bio: z.string().max(300).nullable().optional(),
  tailleCm: z.number().int().min(120).max(230).nullable().optional(),
  pointure: z.number().int().min(15).max(50).nullable().optional(),
  stylesPreferes: z.array(z.string().trim().min(1).max(40)).max(5).optional(),
  visibilite: z.enum(['public', 'membres']).optional(),
  langue: z
    .string()
    .regex(/^[a-z]{2}$/)
    .optional(),
});

export const miseAJourProfilSchema = z.object({
  version: z.number().int().min(0),
  pseudo: z.string().trim().min(3).max(30).optional(),
  nomComplet: z.string().trim().max(120).nullable().optional(),
  telephone: z.string().trim().max(20).nullable().optional(),
  dateNaissance: z.string().trim().min(10).optional(),
  profil: profilSchema.optional(),
});

export const changerMotDePasseSchema = z.object({
  motDePasseActuel: z.string().min(1).max(128),
  nouveauMotDePasse: z.string().min(10).max(128),
});

export const supprimerCompteSchema = z.object({
  motDePasse: z.string().min(1).max(128),
});

export const pushTokenSchema = z.object({
  deviceId: z.string().trim().min(3).max(128),
  pushToken: z.string().trim().min(1).max(512),
});
