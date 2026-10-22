import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Le lot 0 ne crée aucune donnée métier. Les seeds M1 seront ajoutés à l'étape 1.
  console.log('Lot 0 : aucune donnée métier à insérer.');
}

main()
  .catch((error: unknown) => {
    console.error('Échec du seed :', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
