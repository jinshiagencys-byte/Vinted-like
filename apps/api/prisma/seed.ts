import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const prisma = new PrismaClient();

interface CategorieSeed {
  slug: string;
  nom: string;
  parent: string | null;
  tailleObligatoire: boolean;
  ordre: number;
}

interface MarqueSeed {
  nom: string;
  slug: string;
  verifiee: boolean;
}

interface TailleSeed {
  categorie: string;
  systeme: 'EU' | 'UK' | 'US' | 'FR' | 'universel';
  libelle: string;
  equivalentCm: number | null;
  ordre: number;
}

interface ReferentielsSeed {
  version: number;
  categories: CategorieSeed[];
  marques: MarqueSeed[];
  tailles: TailleSeed[];
}

function normaliser(valeur: string): string {
  return valeur
    .trim()
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function main(): Promise<void> {
  const fichier = resolve(__dirname, '../../../infra/scripts/seed/referentiels.v1.json');
  const seed = JSON.parse(await readFile(fichier, 'utf8')) as ReferentielsSeed;

  const idsParSlug = new Map<string, string>();

  // Les catégories sont triées par niveau implicite : on résout les parents
  // déjà créés, puis on recommence jusqu'à stabilisation.
  const restantes = [...seed.categories];

  while (restantes.length > 0) {
    const avant = restantes.length;

    for (const categorie of [...restantes]) {
      if (categorie.parent && !idsParSlug.has(categorie.parent)) continue;

      const parentId = categorie.parent ? (idsParSlug.get(categorie.parent) ?? null) : null;
      const niveau = parentId
        ? ((
            await prisma.categorie.findUnique({ where: { id: parentId }, select: { niveau: true } })
          )?.niveau ?? 0)
        : -1;

      const enregistree = await prisma.categorie.upsert({
        where: { slug: categorie.slug },
        create: {
          slug: categorie.slug,
          nom: categorie.nom,
          parentId,
          niveau: niveau + 1,
          tailleObligatoire: categorie.tailleObligatoire,
          ordre: categorie.ordre,
          actif: true,
        },
        update: {
          nom: categorie.nom,
          parentId,
          niveau: niveau + 1,
          tailleObligatoire: categorie.tailleObligatoire,
          ordre: categorie.ordre,
        },
      });

      idsParSlug.set(categorie.slug, enregistree.id);
      restantes.splice(restantes.indexOf(categorie), 1);
    }

    if (restantes.length === avant) {
      throw new Error(
        `Catégories avec parent inconnu : ${restantes.map((c) => c.slug).join(', ')}`,
      );
    }
  }

  for (const marque of seed.marques) {
    await prisma.marque.upsert({
      where: { slug: marque.slug },
      create: {
        nom: marque.nom,
        nomNormalise: normaliser(marque.nom),
        slug: marque.slug,
        verifiee: marque.verifiee,
        actif: true,
      },
      update: {
        nom: marque.nom,
        nomNormalise: normaliser(marque.nom),
        verifiee: marque.verifiee,
      },
    });
  }

  for (const taille of seed.tailles) {
    const categorieId = idsParSlug.get(taille.categorie);

    if (!categorieId) {
      throw new Error(`Catégorie inconnue pour la taille : ${taille.categorie}`);
    }

    await prisma.referentielTaille.upsert({
      where: {
        categorieId_systeme_libelle: {
          categorieId,
          systeme: taille.systeme,
          libelle: taille.libelle,
        },
      },
      create: {
        categorieId,
        systeme: taille.systeme,
        libelle: taille.libelle,
        equivalentCm: taille.equivalentCm,
        ordre: taille.ordre,
      },
      update: { equivalentCm: taille.equivalentCm, ordre: taille.ordre },
    });
  }

  console.log(
    `Référentiels v${seed.version} : ${seed.categories.length} catégories, ` +
      `${seed.marques.length} marques, ${seed.tailles.length} tailles.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Échec du seed :', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
