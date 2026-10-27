import { z } from 'zod';

const appareil = z.object({
  deviceId: z.string().trim().min(3).max(128),
  plateforme: z.enum(['ios', 'android', 'web']),
  pushToken: z.string().trim().max(512).optional().nullable(),
});

export const inscriptionSchema = z.object({
  email: z.string().trim().min(3).max(254),
  telephone: z.string().trim().min(6).max(20).nullable().optional(),
  pseudo: z.string().trim().min(3).max(30),
  motDePasse: z.string().min(10).max(128),
  dateNaissance: z.string().trim().min(10),
  pays: z.string().trim().length(2).optional(),
});

export const verifierEmailSchema = z.object({
  email: z.string().trim().min(3).max(254),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Le code doit contenir 6 chiffres.'),
  appareil,
});

export const renvoyerEmailSchema = z.object({
  email: z.string().trim().min(3).max(254),
});

export const connexionSchema = z.object({
  email: z.string().trim().min(3).max(254),
  motDePasse: z.string().min(1).max(128),
  appareil,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(16).max(512),
});

export const verifierTelephoneSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Le code doit contenir 6 chiffres.'),
});

export const demanderReinitialisationSchema = z.object({
  email: z.string().trim().min(3).max(254),
});

export const confirmerReinitialisationSchema = z.object({
  jeton: z.string().min(16).max(256),
  nouveauMotDePasse: z.string().min(10).max(128),
});
