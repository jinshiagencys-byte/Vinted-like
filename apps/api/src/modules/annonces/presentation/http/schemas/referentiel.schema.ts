import { z } from 'zod';

export const rechercherMarquesSchema = z
  .object({
    q: z.string().trim().max(80).default(''),
  })
  .strict();

export const listerTaillesSchema = z
  .object({
    categorieId: z.string().uuid(),
  })
  .strict();
