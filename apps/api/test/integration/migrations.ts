import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';

const MIGRATIONS_DIR = join(process.cwd(), 'prisma/migrations');

export function fichiersDeMigration(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entree) => entree.isDirectory() && /^\d{14}_/.test(entree.name))
    .map((entree) => join(MIGRATIONS_DIR, entree.name, 'migration.sql'))
    .sort();
}

export function lireMigration(chemin: string): string {
  return readFileSync(chemin, 'utf8');
}

export function lireDownMigration(nom: string): string {
  return readFileSync(join(process.cwd(), '../../infra/migrations/down', nom), 'utf8');
}

export async function executerSql(prisma: PrismaClient, sql: string): Promise<void> {
  const sansCommentaires = sql.replace(/^\s*--.*$/gm, '');

  for (const instruction of sansCommentaires.split(';')) {
    const requete = instruction.trim();
    if (requete.length > 0) {
      await prisma.$executeRawUnsafe(requete);
    }
  }
}

export async function appliquerToutesLesMigrations(prisma: PrismaClient): Promise<void> {
  for (const fichier of fichiersDeMigration()) {
    await executerSql(prisma, lireMigration(fichier));
  }
}
