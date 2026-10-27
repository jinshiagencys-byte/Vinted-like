import 'reflect-metadata';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appliquerToutesLesMigrations } from './migrations';

function dockerDisponible(): boolean {
  if (process.env.RUN_INTEGRATION_TESTS !== 'true') return false;

  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

interface SessionHttp {
  accessToken: string;
  refreshToken: string;
  expireDans: number;
  utilisateur: {
    id: string;
    email: string;
    pseudo: string;
    emailVerifie: boolean;
  };
}

interface ContexteHttp {
  app: INestApplication;
  prisma: PrismaClient;
}

const MOT_DE_PASSE = 'MotDePasseSolide!42';

function emailUnique(prefixe = 'membre'): string {
  return `${prefixe}-${randomUUID()}@example.com`;
}

function pseudoUnique(prefixe = 'membre'): string {
  return `${prefixe}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function ipUnique(): string {
  const octets = [10, 20, 30, Math.floor(Math.random() * 200) + 1];
  return octets.join('.');
}

async function codeEmail(prisma: PrismaClient, email: string): Promise<string> {
  const evenement = await prisma.outboxEvenement.findFirst({
    where: { type: 'notification.envoyer' },
    orderBy: { creeLe: 'desc' },
  });

  const payload = evenement?.payload as
    { destinataire?: string; variables?: { code?: string } } | undefined;

  if (!payload || payload.destinataire !== email || !payload.variables?.code) {
    throw new Error(`Code de vérification introuvable pour ${email}`);
  }

  return payload.variables.code;
}

async function inscrire(
  contexte: ContexteHttp,
  surcharges: { email?: string; pseudo?: string; telephone?: string | null } = {},
): Promise<{ email: string; pseudo: string; utilisateurId: string }> {
  const email = surcharges.email ?? emailUnique();
  const pseudo = surcharges.pseudo ?? pseudoUnique();

  const reponse = await request(contexte.app.getHttpServer())
    .post('/v1/auth/inscription')
    .set('X-Forwarded-For', ipUnique())
    .send({
      email,
      pseudo,
      motDePasse: MOT_DE_PASSE,
      dateNaissance: '1995-04-12',
      ...(surcharges.telephone !== undefined ? { telephone: surcharges.telephone } : {}),
    });

  expect(reponse.status).toBe(201);
  expect(JSON.stringify(reponse.body)).not.toContain(MOT_DE_PASSE);

  return { email, pseudo, utilisateurId: reponse.body.utilisateurId as string };
}

async function verifierEmail(
  contexte: ContexteHttp,
  email: string,
  deviceId = `device-${randomUUID()}`,
): Promise<SessionHttp> {
  const code = await codeEmail(contexte.prisma, email);
  const reponse = await request(contexte.app.getHttpServer())
    .post('/v1/auth/email/verifier')
    .set('X-Forwarded-For', ipUnique())
    .send({ email, code, appareil: { deviceId, plateforme: 'ios' } });

  expect(reponse.status).toBe(200);
  return reponse.body as SessionHttp;
}

async function creerMembreVerifie(
  contexte: ContexteHttp,
  options: { telephone?: string | null; pseudo?: string } = {},
): Promise<{
  email: string;
  pseudo: string;
  session: SessionHttp;
  motDePasse: string;
}> {
  const inscription = await inscrire(contexte, {
    ...(options.pseudo ? { pseudo: options.pseudo } : {}),
    ...(options.telephone !== undefined ? { telephone: options.telephone } : {}),
  });
  const session = await verifierEmail(contexte, inscription.email);

  return {
    email: inscription.email,
    pseudo: inscription.pseudo,
    session,
    motDePasse: MOT_DE_PASSE,
  };
}

describe.skipIf(!dockerDisponible())('Comptes M1 — parcours HTTP', () => {
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let prisma: PrismaClient;
  let contexte: ContexteHttp;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16-alpine').start();
    redis = await new RedisContainer('redis:7-alpine').start();

    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
    process.env.DATABASE_URL = postgres.getConnectionUri();
    process.env.REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;
    process.env.JWT_SECRET = 'secret-de-test-32-caracteres-minimum';
    process.env.JWT_ISSUER = 'secondevie';
    process.env.JWT_AUDIENCE = 'secondevie-api';
    process.env.JWT_KID = 'test-1';
    process.env.AUTH_CODE_PEPPER = 'code-pepper-de-test-32-caracteres-minimum';
    process.env.AUTH_REFRESH_PEPPER = 'refresh-pepper-de-test-32-caracteres-minimum';
    process.env.AUTH_RESET_PEPPER = 'reset-pepper-de-test-32-caracteres-minimum';
    process.env.EXPORT_SIGNING_SECRET = 'export-secret-de-test-32-caracteres-minimum';
    process.env.EXPORT_DIR = `.exports-test-${randomUUID()}`;

    prisma = new PrismaClient();
    await appliquerToutesLesMigrations(prisma);

    const { Test } = await import('@nestjs/testing');
    const { AppModule } = await import('../../src/app.module');
    const { AllExceptionsFilter } = await import('../../src/common/errors/all-exceptions.filter');
    const { TraceIdMiddleware } = await import('../../src/common/http/trace-id.middleware');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    const traceId = new TraceIdMiddleware();

    app.setGlobalPrefix('v1');
    app.use(traceId.use.bind(traceId));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    await app.init();

    contexte = { app, prisma };
  }, 240_000);

  afterAll(async () => {
    await contexte?.app.close();
    await prisma?.$disconnect();
    await postgres?.stop();
    await redis?.stop();
  });

  it('inscrit, vérifie l’e-mail et renvoie le profil privé sans secret', async () => {
    const email = emailUnique('alice');
    const inscription = await inscrire(contexte, {
      email,
      telephone: '06 12 34 56 78',
    });

    const session = await verifierEmail(contexte, email);

    expect(session.accessToken.split('.')).toHaveLength(3);
    expect(session.refreshToken).toMatch(/^v1\.[0-9a-f-]{36}\./);
    expect(session.utilisateur.email).toBe(email);
    expect(session.utilisateur.emailVerifie).toBe(true);

    const moi = await request(contexte.app.getHttpServer())
      .get('/v1/moi')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(moi.status).toBe(200);
    expect(moi.body.utilisateur).toMatchObject({
      id: inscription.utilisateurId,
      email,
      telephone: '+33612345678',
      emailVerifie: true,
      telephoneVerifie: false,
    });
    expect(moi.body.profil).toBeTruthy();
    expect(moi.body).not.toHaveProperty('motDePasseHash');
    expect(JSON.stringify(moi.body)).not.toContain('argon2');
  });

  it('refuse un code faux puis accepte un code valide à usage unique', async () => {
    const email = emailUnique('code');
    await inscrire(contexte, { email });
    const code = await codeEmail(contexte.prisma, email);
    const faux = code === '000000' ? '111111' : '000000';

    const refuse = await request(contexte.app.getHttpServer())
      .post('/v1/auth/email/verifier')
      .set('X-Forwarded-For', ipUnique())
      .send({
        email,
        code: faux,
        appareil: { deviceId: `device-${randomUUID()}`, plateforme: 'android' },
      });

    expect(refuse.status).toBe(422);
    expect(refuse.body.code).toBe('code_invalide');

    const accepte = await request(contexte.app.getHttpServer())
      .post('/v1/auth/email/verifier')
      .set('X-Forwarded-For', ipUnique())
      .send({
        email,
        code,
        appareil: { deviceId: `device-${randomUUID()}`, plateforme: 'android' },
      });
    expect(accepte.status).toBe(200);

    const rejoue = await request(contexte.app.getHttpServer())
      .post('/v1/auth/email/verifier')
      .set('X-Forwarded-For', ipUnique())
      .send({
        email,
        code,
        appareil: { deviceId: `device-${randomUUID()}`, plateforme: 'android' },
      });
    expect(rejoue.status).toBe(422);
  });

  it('connecte avec un message générique et applique la rotation du refresh', async () => {
    const membre = await creerMembreVerifie(contexte);

    const mauvais = await request(contexte.app.getHttpServer())
      .post('/v1/auth/connexion')
      .set('X-Forwarded-For', ipUnique())
      .send({
        email: membre.email,
        motDePasse: 'MauvaisMotDePasse!42',
        appareil: { deviceId: `device-${randomUUID()}`, plateforme: 'web' },
      });

    expect(mauvais.status).toBe(401);
    expect(mauvais.body.message).toBe('E-mail ou mot de passe incorrect.');

    const connexion = await request(contexte.app.getHttpServer())
      .post('/v1/auth/connexion')
      .set('X-Forwarded-For', ipUnique())
      .send({
        email: membre.email,
        motDePasse: membre.motDePasse,
        appareil: { deviceId: `device-${randomUUID()}`, plateforme: 'web' },
      });

    expect(connexion.status).toBe(200);
    const refreshInitial = connexion.body.refreshToken as string;

    const premier = await request(contexte.app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('X-Forwarded-For', ipUnique())
      .send({ refreshToken: refreshInitial });

    expect(premier.status).toBe(200);
    expect(premier.body.refreshToken).not.toBe(refreshInitial);

    const rejoueDansLaGrace = await request(contexte.app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('X-Forwarded-For', ipUnique())
      .send({ refreshToken: refreshInitial });

    expect(rejoueDansLaGrace.status).toBe(200);

    const troisiemeUsage = await request(contexte.app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('X-Forwarded-For', ipUnique())
      .send({ refreshToken: refreshInitial });

    expect(troisiemeUsage.status).toBe(401);
  });

  it('isole les adresses entre membres et protège les identifiants', async () => {
    const alice = await creerMembreVerifie(contexte);
    const bob = await creerMembreVerifie(contexte);

    const creation = await request(contexte.app.getHttpServer())
      .post('/v1/moi/adresses')
      .set('Authorization', `Bearer ${alice.session.accessToken}`)
      .send({
        libelle: 'Maison',
        destinataire: 'Alice Martin',
        ligne1: '1 rue de la Paix',
        codePostal: '75002',
        ville: 'Paris',
        pays: 'FR',
        telephone: '+33612345678',
        estDefaut: true,
      });

    expect(creation.status).toBe(201);
    const adresseId = creation.body.id as string;

    const modification = await request(contexte.app.getHttpServer())
      .patch(`/v1/moi/adresses/${adresseId}`)
      .set('Authorization', `Bearer ${bob.session.accessToken}`)
      .send({ ville: 'Lyon' });

    expect(modification.status).toBe(404);

    const suppression = await request(contexte.app.getHttpServer())
      .delete(`/v1/moi/adresses/${adresseId}`)
      .set('Authorization', `Bearer ${bob.session.accessToken}`);
    expect(suppression.status).toBe(404);

    const defaut = await request(contexte.app.getHttpServer())
      .post(`/v1/moi/adresses/${adresseId}/defaut`)
      .set('Authorization', `Bearer ${bob.session.accessToken}`);
    expect(defaut.status).toBe(404);

    const listeBob = await request(contexte.app.getHttpServer())
      .get('/v1/moi/adresses')
      .set('Authorization', `Bearer ${bob.session.accessToken}`);
    expect(listeBob.status).toBe(200);
    expect(listeBob.body).toEqual([]);

    const listeAlice = await request(contexte.app.getHttpServer())
      .get('/v1/moi/adresses')
      .set('Authorization', `Bearer ${alice.session.accessToken}`);
    expect(listeAlice.status).toBe(200);
    expect(listeAlice.body).toHaveLength(1);
    expect(listeAlice.body[0].id).toBe(adresseId);
  });

  it('révoque les sessions au changement de mot de passe', async () => {
    const membre = await creerMembreVerifie(contexte);

    const changement = await request(contexte.app.getHttpServer())
      .patch('/v1/moi/mot-de-passe')
      .set('Authorization', `Bearer ${membre.session.accessToken}`)
      .send({
        motDePasseActuel: membre.motDePasse,
        nouveauMotDePasse: 'NouveauMotDePasse!84',
      });

    expect(changement.status).toBe(204);

    const ancienAcces = await request(contexte.app.getHttpServer())
      .get('/v1/moi')
      .set('Authorization', `Bearer ${membre.session.accessToken}`);
    expect(ancienAcces.status).toBe(401);
    expect(ancienAcces.body.code).toBe('session_invalide');

    const ancienRefresh = await request(contexte.app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('X-Forwarded-For', ipUnique())
      .send({ refreshToken: membre.session.refreshToken });
    expect(ancienRefresh.status).toBe(401);

    const connexion = await request(contexte.app.getHttpServer())
      .post('/v1/auth/connexion')
      .set('X-Forwarded-For', ipUnique())
      .send({
        email: membre.email,
        motDePasse: 'NouveauMotDePasse!84',
        appareil: { deviceId: `device-${randomUUID()}`, plateforme: 'web' },
      });
    expect(connexion.status).toBe(200);
  });

  it('supprime le compte après vérification du mot de passe et anonymise les données', async () => {
    const membre = await creerMembreVerifie(contexte);

    const refuse = await request(contexte.app.getHttpServer())
      .delete('/v1/moi')
      .set('Authorization', `Bearer ${membre.session.accessToken}`)
      .send({ motDePasse: 'MauvaisMotDePasse!42' });
    expect(refuse.status).toBe(401);

    const supprime = await request(contexte.app.getHttpServer())
      .delete('/v1/moi')
      .set('Authorization', `Bearer ${membre.session.accessToken}`)
      .send({ motDePasse: membre.motDePasse });
    expect(supprime.status).toBe(204);

    const apres = await request(contexte.app.getHttpServer())
      .get('/v1/moi')
      .set('Authorization', `Bearer ${membre.session.accessToken}`);
    expect(apres.status).toBe(401);

    const connexion = await request(contexte.app.getHttpServer())
      .post('/v1/auth/connexion')
      .set('X-Forwarded-For', ipUnique())
      .send({
        email: membre.email,
        motDePasse: membre.motDePasse,
        appareil: { deviceId: `device-${randomUUID()}`, plateforme: 'web' },
      });
    expect(connexion.status).toBe(401);

    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: membre.session.utilisateur.id },
    });
    expect(utilisateur?.statut).toBe('supprime');
    expect(utilisateur?.email).not.toBe(membre.email);
    expect(utilisateur?.motDePasseHash).toBeNull();
    expect(utilisateur?.telephone).toBeNull();
    expect(utilisateur?.versionSecurite).toBe(1);
  });

  it('publie uniquement un profil public et renvoie 404 pour un profil privé', async () => {
    const alice = await creerMembreVerifie(contexte);

    const avant = await request(contexte.app.getHttpServer()).get(
      `/v1/utilisateurs/${alice.pseudo}`,
    );
    expect(avant.status).toBe(200);
    expect(avant.body).toMatchObject({ pseudo: alice.pseudo });
    expect(avant.body).not.toHaveProperty('email');
    expect(avant.body).not.toHaveProperty('telephone');
    expect(avant.body).not.toHaveProperty('dateNaissance');
    expect(avant.body).not.toHaveProperty('adresses');

    const profil = await request(contexte.app.getHttpServer())
      .get('/v1/moi')
      .set('Authorization', `Bearer ${alice.session.accessToken}`);

    const prive = await request(contexte.app.getHttpServer())
      .patch('/v1/moi')
      .set('Authorization', `Bearer ${alice.session.accessToken}`)
      .send({ version: profil.body.utilisateur.version, profil: { visibilite: 'membres' } });
    expect(prive.status).toBe(200);

    const apres = await request(contexte.app.getHttpServer()).get(
      `/v1/utilisateurs/${alice.pseudo}`,
    );
    expect(apres.status).toBe(404);
    expect(apres.body.code).toBe('ressource_introuvable');
  });

  it('génère un export signé, le protège par signature et refuse un lien expiré', async () => {
    const membre = await creerMembreVerifie(contexte);

    const demande = await request(contexte.app.getHttpServer())
      .post('/v1/moi/export')
      .set('Authorization', `Bearer ${membre.session.accessToken}`);
    expect(demande.status).toBe(202);
    const exportId = demande.body.exportId as string;

    const { GererExports } =
      await import('../../src/modules/comptes/application/services/gerer-exports');
    await contexte.app.get<InstanceType<typeof GererExports>>(GererExports).executer(exportId);

    const statut = await request(contexte.app.getHttpServer())
      .get(`/v1/moi/export/${exportId}`)
      .set('Authorization', `Bearer ${membre.session.accessToken}`);

    expect(statut.status).toBe(200);
    expect(statut.body.statut).toBe('pret');
    expect(statut.body.urlSignee).toMatch(/^\/v1\/moi\/export\//);

    const telechargement = await request(contexte.app.getHttpServer()).get(
      statut.body.urlSignee as string,
    );
    expect(telechargement.status).toBe(200);
    expect(telechargement.headers['cache-control']).toBe('no-store');
    expect(telechargement.text).toContain(membre.email);
    expect(telechargement.text).not.toContain('motDePasseHash');
    expect(telechargement.text).not.toContain('refreshTokenHash');
    expect(telechargement.text).not.toContain('codeHash');

    const expire = await request(contexte.app.getHttpServer()).get(
      `/v1/moi/export/${exportId}/telecharger?exp=1&signature=invalide`,
    );
    expect(expire.status).toBe(401);

    const sansSignature = await request(contexte.app.getHttpServer()).get(
      `/v1/moi/export/${exportId}/telecharger`,
    );
    expect(sansSignature.status).toBe(401);
  });

  it('refuse l’export tant que l’e-mail n’est pas vérifié', async () => {
    const email = emailUnique('non-verifie');
    await inscrire(contexte, { email });

    const connexion = await request(contexte.app.getHttpServer())
      .post('/v1/auth/connexion')
      .set('X-Forwarded-For', ipUnique())
      .send({
        email,
        motDePasse: MOT_DE_PASSE,
        appareil: { deviceId: `device-${randomUUID()}`, plateforme: 'web' },
      });

    expect(connexion.status).toBe(200);

    const exportRefuse = await request(contexte.app.getHttpServer())
      .post('/v1/moi/export')
      .set('Authorization', `Bearer ${connexion.body.accessToken}`);

    expect(exportRefuse.status).toBe(403);
    expect(exportRefuse.body.code).toBe('email_non_verifie');
  });
});
