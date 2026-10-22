import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient, Utilisateur } from '@prisma/client';

function suffixe(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

export function donneesUtilisateur(
  overrides: Partial<Prisma.UtilisateurUncheckedCreateInput> = {},
): Prisma.UtilisateurUncheckedCreateInput {
  const id = suffixe();
  const pseudo = `user_${id}`;
  const fusion: Prisma.UtilisateurUncheckedCreateInput = {
    email: `user-${id}@example.com`,
    motDePasseHash: `$argon2id$v=19$m=19456,t=2,p=1$hash-${id}`,
    pseudo,
    pseudoNormalise: pseudo.toLowerCase(),
    dateNaissance: new Date('2000-01-01T00:00:00.000Z'),
    ...overrides,
  };

  if (overrides.pseudo && !overrides.pseudoNormalise) {
    fusion.pseudoNormalise = overrides.pseudo.toLowerCase();
  }

  return fusion;
}

export async function creerUtilisateur(
  prisma: PrismaClient,
  overrides: Partial<Prisma.UtilisateurUncheckedCreateInput> = {},
): Promise<Utilisateur> {
  const donnees = donneesUtilisateur(overrides);
  const utilisateur = await prisma.utilisateur.create({ data: donnees });

  await prisma.profil.create({ data: { utilisateurId: utilisateur.id } });

  return utilisateur;
}

export function donneesAdresse(
  utilisateurId: string,
  overrides: Partial<Prisma.AdresseUncheckedCreateInput> = {},
): Prisma.AdresseUncheckedCreateInput {
  return {
    utilisateurId,
    libelle: 'Maison',
    destinataire: 'Alice Martin',
    ligne1: '1 rue de la Paix',
    codePostal: '75002',
    ville: 'Paris',
    pays: 'FR',
    telephone: '+33612345678',
    estDefaut: false,
    ...overrides,
  };
}

export function donneesAppareil(
  utilisateurId: string,
  overrides: Partial<Prisma.AppareilUncheckedCreateInput> = {},
): Prisma.AppareilUncheckedCreateInput {
  return {
    utilisateurId,
    plateforme: 'web',
    deviceId: `device-${suffixe()}`,
    refreshTokenHash: null,
    ...overrides,
  };
}

export function donneesVerification(
  utilisateurId: string,
  overrides: Partial<Prisma.VerificationUncheckedCreateInput> = {},
): Prisma.VerificationUncheckedCreateInput {
  return {
    utilisateurId,
    type: 'email',
    codeHash: createHash('sha256').update(randomUUID()).digest('hex'),
    expireLe: new Date(Date.now() + 15 * 60 * 1000),
    ...overrides,
  };
}
