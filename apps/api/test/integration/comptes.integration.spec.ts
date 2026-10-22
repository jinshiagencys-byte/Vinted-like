import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/common/database/prisma.service';
import { AdressePrismaRepository } from '../../src/modules/comptes/infrastructure/persistance/prisma/adresse.prisma.repository';
import { VerificationPrismaRepository } from '../../src/modules/comptes/infrastructure/persistance/prisma/verification.prisma.repository';
import {
  creerUtilisateur,
  donneesAdresse,
  donneesUtilisateur,
  donneesVerification,
} from '../factories/comptes';
import { appliquerToutesLesMigrations, executerSql, lireDownMigration } from './migrations';

function dockerDisponible(): boolean {
  if (process.env.RUN_INTEGRATION_TESTS !== 'true') return false;

  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!dockerDisponible())('Comptes M1 (PostgreSQL)', () => {
  let postgres: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let adresses: AdressePrismaRepository;
  let verifications: VerificationPrismaRepository;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16-alpine').start();
    process.env.DATABASE_URL = postgres.getConnectionUri();
    prisma = new PrismaService();
    adresses = new AdressePrismaRepository(prisma);
    verifications = new VerificationPrismaRepository(prisma);

    await appliquerToutesLesMigrations(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await postgres?.stop();
  });

  it('crée un utilisateur et son profil', async () => {
    const utilisateur = await creerUtilisateur(prisma);

    expect(utilisateur.email).toMatch(/@example\.com$/);
    expect(utilisateur.statut).toBe('actif');
    expect(utilisateur.role).toBe('membre');
    expect(await prisma.profil.count({ where: { utilisateurId: utilisateur.id } })).toBe(1);
  });

  it('impose l’unicité de l’e-mail normalisé', async () => {
    const email = `alice-${randomUUID()}@example.com`;
    await creerUtilisateur(prisma, { email });

    await expect(
      prisma.utilisateur.create({ data: donneesUtilisateur({ email }) }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('impose l’unicité du pseudo normalisé, insensible à la casse', async () => {
    const pseudo = `Alice_${randomUUID().slice(0, 8)}`;
    await creerUtilisateur(prisma, { pseudo });

    await expect(
      prisma.utilisateur.create({
        data: donneesUtilisateur({
          pseudo: pseudo.toUpperCase(),
          pseudoNormalise: pseudo.toLowerCase(),
        }),
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('impose l’unicité du téléphone seulement lorsqu’il est présent', async () => {
    const telephone = '+33600000001';
    await creerUtilisateur(prisma, { telephone });
    await creerUtilisateur(prisma, { telephone: null });
    await creerUtilisateur(prisma, { telephone: null });

    await expect(
      prisma.utilisateur.create({ data: donneesUtilisateur({ telephone }) }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('maintient au plus une adresse par défaut active et promeut un remplacement', async () => {
    const utilisateur = await creerUtilisateur(prisma);

    const premiere = await adresses.creer(
      donneesAdresse(utilisateur.id, { libelle: 'Première', estDefaut: true }),
    );
    const seconde = await adresses.creer(
      donneesAdresse(utilisateur.id, { libelle: 'Seconde', estDefaut: true }),
    );

    const actives = await adresses.listerActives(utilisateur.id);
    expect(actives.filter((adresse) => adresse.estDefaut)).toHaveLength(1);
    expect(actives.find((adresse) => adresse.id === premiere.id)?.estDefaut).toBe(false);
    expect(actives.find((adresse) => adresse.id === seconde.id)?.estDefaut).toBe(true);

    await adresses.marquerSupprimee(utilisateur.id, seconde.id, new Date());
    const apresSuppression = await adresses.listerActives(utilisateur.id);
    expect(apresSuppression.find((adresse) => adresse.id === premiere.id)?.estDefaut).toBe(true);

    const troisieme = await adresses.creer(
      donneesAdresse(utilisateur.id, { libelle: 'Troisième' }),
    );
    await adresses.definirDefaut(utilisateur.id, troisieme.id);
    const apresDefaut = await adresses.listerActives(utilisateur.id);
    expect(apresDefaut.filter((adresse) => adresse.estDefaut)).toHaveLength(1);
    expect(apresDefaut.find((adresse) => adresse.id === troisieme.id)?.estDefaut).toBe(true);
  });

  it('refuse un second défaut actif au niveau SQL', async () => {
    const utilisateur = await creerUtilisateur(prisma);
    await prisma.adresse.create({
      data: donneesAdresse(utilisateur.id, { estDefaut: true }),
    });

    await expect(
      prisma.adresse.create({
        data: donneesAdresse(utilisateur.id, { estDefaut: true }),
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('impose la cohérence du statut supprimé', async () => {
    const utilisateur = await creerUtilisateur(prisma);

    await expect(
      prisma.utilisateur.update({
        where: { id: utilisateur.id },
        data: { statut: 'supprime' },
      }),
    ).rejects.toThrow();

    const supprime = await prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: { statut: 'supprime', supprimeLe: new Date() },
    });
    expect(supprime.supprimeLe).not.toBeNull();
  });

  it('protège les données par des FK RESTRICT', async () => {
    const utilisateur = await creerUtilisateur(prisma);

    await expect(
      prisma.utilisateur.delete({ where: { id: utilisateur.id } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('impose un seul code de vérification en attente par type', async () => {
    const utilisateur = await creerUtilisateur(prisma);

    const donnees = donneesVerification(utilisateur.id, { type: 'email' });
    const premier = await verifications.creer({
      utilisateurId: utilisateur.id,
      type: donnees.type,
      codeHash: donnees.codeHash as string,
      expireLe: donnees.expireLe as Date,
    });

    await expect(
      verifications.creer({
        utilisateurId: utilisateur.id,
        type: 'email',
        codeHash: donnees.codeHash as string,
        expireLe: donnees.expireLe as Date,
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await verifications.marquerStatut(premier.id, 'expire');
    await expect(
      verifications.creer({
        utilisateurId: utilisateur.id,
        type: 'email',
        codeHash: donnees.codeHash as string,
        expireLe: donnees.expireLe as Date,
      }),
    ).resolves.toMatchObject({ statut: 'en_attente' });
  });

  it('peut rejouer la migration down dans une transaction sans perdre les tables', async () => {
    const down = lireDownMigration('20261022140000_m1_comptes_down.sql');

    await expect(
      prisma.$transaction(async (tx) => {
        await executerSql(tx as unknown as PrismaService, down);
        const tables = await tx.$queryRaw<
          { tablename: string }[]
        >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'utilisateurs'`;
        expect(tables).toHaveLength(0);
        throw new Error('rollback-test');
      }),
    ).rejects.toThrow('rollback-test');

    const tables = await prisma.$queryRaw<
      { tablename: string }[]
    >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'utilisateurs'`;
    expect(tables).toHaveLength(1);
  });
});
