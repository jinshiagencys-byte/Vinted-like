import { z } from 'zod';

const adresseChamps = {
  libelle: z.string().trim().min(1).max(40),
  destinataire: z.string().trim().min(1).max(120),
  ligne1: z.string().trim().min(1).max(120),
  ligne2: z.string().trim().max(120).nullable().optional(),
  codePostal: z.string().trim().min(1).max(10),
  ville: z.string().trim().min(1).max(120),
  pays: z.string().trim().length(2).optional(),
  telephone: z.string().trim().min(1).max(20),
  estDefaut: z.boolean().optional(),
};

export const creerAdresseSchema = z.object(adresseChamps);

export const modifierAdresseSchema = z.object({
  libelle: adresseChamps.libelle.optional(),
  destinataire: adresseChamps.destinataire.optional(),
  ligne1: adresseChamps.ligne1.optional(),
  ligne2: adresseChamps.ligne2,
  codePostal: adresseChamps.codePostal.optional(),
  ville: adresseChamps.ville.optional(),
  pays: adresseChamps.pays,
  telephone: adresseChamps.telephone.optional(),
});
