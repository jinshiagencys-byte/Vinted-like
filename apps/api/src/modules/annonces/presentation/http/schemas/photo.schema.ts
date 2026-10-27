import { z } from 'zod';

export const MIME_TYPES_PHOTO = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const TAILLE_MAX_PHOTO_OCTETS = 8 * 1024 * 1024;

export const preparerPhotoSchema = z
  .object({
    nomFichier: z.string().trim().min(1).max(255),
    mimeType: z.enum(MIME_TYPES_PHOTO),
    tailleOctets: z.number().int().min(1).max(TAILLE_MAX_PHOTO_OCTETS),
    largeur: z.number().int().min(400),
    hauteur: z.number().int().min(400),
  })
  .strict();

export const reordonnerPhotosSchema = z
  .object({
    photoIds: z.array(z.string().uuid()).min(1).max(12),
  })
  .strict();
