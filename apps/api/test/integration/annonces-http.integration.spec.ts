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
  utilisateur: { id: string; email: string; pseudo: string; emailVerifie: boolean };
}

const MOT_DE_PASSE = 'MotDePasseSolide!42';

function emailUnique(): string {
  return `annonce-${randomUUID()}@example.com`;
}

function pseudoUnique(): string {
  return `annonce_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function ipUnique(): string {
  return `10.40.50.${Math.floor(Math.random() * 200) + 1}`;
}

async function codeEmail(prisma: PrismaClient, email: string): Promise<string> {
  const evenement = await prisma.outboxEvenement.findFirst({
    where: { type: 'notification.envoyer' },
    orderBy: { creeLe: 'desc' },
  });
  const payload = evenement?.payload as
    { destinataire?: string; variables?: { code?: string } } | undefined;

  if (!payload || payload.destinataire !== email || !payload.variables?.code) {
    throw new Error('Code de vérification introuvable.');
  }

  return payload.variables.code;
}

describe.skipIf(!dockerDisponible())('Annonces M2 — parcours HTTP', () => {
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let prisma: PrismaClient;
  let app: INestApplication;
  let session: SessionHttp;
  let autreSession: SessionHttp;
  let categorieId: string;

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
    app = moduleRef.createNestApplication();
    const traceId = new TraceIdMiddleware();

    app.setGlobalPrefix('v1');
    app.use(traceId.use.bind(traceId));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    await app.init();

    const categorie = await prisma.categorie.create({
      data: {
        nom: 'Pantalons de test',
        slug: `pantalons-${randomUUID()}`,
        niveau: 1,
        tailleObligatoire: true,
        ordre: 1,
      },
    });
    categorieId = categorie.id;
    await prisma.referentielTaille.create({
      data: { categorieId, systeme: 'FR', libelle: '38', ordre: 0 },
    });

    session = await creerMembreVerifie();
    autreSession = await creerMembreVerifie();
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await postgres?.stop();
    await redis?.stop();
  });

  async function creerMembreVerifie(): Promise<SessionHttp> {
    const email = emailUnique();
    const inscription = await request(app.getHttpServer())
      .post('/v1/auth/inscription')
      .set('X-Forwarded-For', ipUnique())
      .send({
        email,
        pseudo: pseudoUnique(),
        motDePasse: MOT_DE_PASSE,
        dateNaissance: '1995-04-12',
      });

    expect(inscription.status).toBe(201);

    const code = await codeEmail(prisma, email);
    const verification = await request(app.getHttpServer())
      .post('/v1/auth/email/verifier')
      .set('X-Forwarded-For', ipUnique())
      .send({
        email,
        code,
        appareil: { deviceId: `device-${randomUUID()}`, plateforme: 'ios' },
      });

    expect(verification.status).toBe(200);
    return verification.body as SessionHttp;
  }

  async function creerAnnonceComplete(token: string): Promise<{ id: string; version: number }> {
    const creation = await request(app.getHttpServer())
      .post('/v1/annonces')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(creation.status).toBe(201);
    expect(creation.body.reference).toMatch(/^SV-[0-9A-HJKMNP-TV-Z]{6}$/);

    const modification = await request(app.getHttpServer())
      .patch(`/v1/annonces/${creation.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        version: creation.body.version,
        titre: 'Jean Levi’s 501 W30',
        description: 'Jean porté quelques fois, très bon état, aucune tache visible.',
        categorieId,
        taille: '38',
        etat: 'tres_bon',
        couleur: 'bleu',
        matiere: 'coton',
        prixCents: 2_800,
        prixOrigineCents: 9_900,
        poidsG: 450,
      });

    expect(modification.status).toBe(200);
    return { id: modification.body.id as string, version: modification.body.version as number };
  }

  async function ajouterPhotoTraitee(annonceId: string): Promise<void> {
    await prisma.photo.create({
      data: {
        annonceId,
        ordre: 0,
        mimeType: 'image/webp',
        tailleOctets: 1_000,
        largeur: 800,
        hauteur: 800,
        perceptHash: randomUUID().replace(/-/g, '').slice(0, 16),
        statutTraitement: 'traitee',
        statutModeration: 'ok',
        urlVariantes: { m: 'https://cdn.example.test/photo-m.webp' },
      },
    });
  }

  it('crée un brouillon, le modifie et détecte un conflit de version', async () => {
    const creation = await request(app.getHttpServer())
      .post('/v1/annonces')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ titre: 'Sac en cuir' });

    expect(creation.status).toBe(201);
    expect(creation.body.statut).toBe('brouillon');

    const premiere = await request(app.getHttpServer())
      .patch(`/v1/annonces/${creation.body.id}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ version: 0, titre: 'Sac en cuir noir' });
    expect(premiere.status).toBe(200);

    const conflit = await request(app.getHttpServer())
      .patch(`/v1/annonces/${creation.body.id}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ version: 0, titre: 'Sac en cuir marron' });
    expect(conflit.status).toBe(409);
    expect(conflit.body.details.versionActuelle).toBe(1);
  });

  it('refuse l’édition d’une annonce d’autrui avec un 404', async () => {
    const annonce = await creerAnnonceComplete(session.accessToken);
    const reponse = await request(app.getHttpServer())
      .patch(`/v1/annonces/${annonce.id}`)
      .set('Authorization', `Bearer ${autreSession.accessToken}`)
      .send({ version: annonce.version, titre: 'Tentative de détournement' });

    expect(reponse.status).toBe(404);
  });

  it('publie une annonce complète et la rend publique, puis l’archive', async () => {
    const annonce = await creerAnnonceComplete(session.accessToken);
    await ajouterPhotoTraitee(annonce.id);

    const publication = await request(app.getHttpServer())
      .post(`/v1/annonces/${annonce.id}/publier`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ version: annonce.version });

    expect(publication.status).toBe(200);
    expect(publication.body.statut).toBe('publiee');
    expect(publication.body.publieeLe).toBeTruthy();

    const publique = await request(app.getHttpServer()).get(`/v1/annonces/${annonce.id}`);
    expect(publique.status).toBe(200);
    expect(publique.body.roleActeur).toBe('public');
    expect(publique.body.motifRefus).toBeNull();
    expect(publique.body.photos[0]).not.toHaveProperty('urlOriginale');
    expect(publique.body.photos[0]).not.toHaveProperty('perceptHash');

    const editionIncomplete = await request(app.getHttpServer())
      .patch(`/v1/annonces/${annonce.id}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ version: publication.body.version, couleur: null });
    expect(editionIncomplete.status).toBe(422);
    expect(editionIncomplete.body.code).toBe('annonce_incomplete');

    const archivee = await request(app.getHttpServer())
      .post(`/v1/annonces/${annonce.id}/archiver`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({});
    expect(archivee.status).toBe(200);
    expect(archivee.body.statut).toBe('archivee');

    const cachee = await request(app.getHttpServer()).get(`/v1/annonces/${annonce.id}`);
    expect(cachee.status).toBe(404);
    expect(cachee.body.code).toBe('annonce_introuvable');

    const evenements = await prisma.outboxEvenement.findMany({
      where: { agregatId: annonce.id },
      select: { type: true },
    });
    expect(evenements.map((item) => item.type)).toEqual(
      expect.arrayContaining(['annonce.publiee', 'annonce.archivee']),
    );
  });

  it('refuse la publication sans photo avec un 422', async () => {
    const annonce = await creerAnnonceComplete(session.accessToken);
    const publication = await request(app.getHttpServer())
      .post(`/v1/annonces/${annonce.id}/publier`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ version: annonce.version });

    expect(publication.status).toBe(422);
    expect(publication.body.code).toBe('photos_requises');
  });

  it('gère les favoris de façon idempotente et exacte', async () => {
    const annonce = await creerAnnonceComplete(session.accessToken);
    await ajouterPhotoTraitee(annonce.id);

    const publication = await request(app.getHttpServer())
      .post(`/v1/annonces/${annonce.id}/publier`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ version: annonce.version });
    expect(publication.status).toBe(200);

    for (let index = 0; index < 2; index += 1) {
      const ajout = await request(app.getHttpServer())
        .post(`/v1/annonces/${annonce.id}/favori`)
        .set('Authorization', `Bearer ${autreSession.accessToken}`);
      expect(ajout.status).toBe(200);
    }

    let detail = await prisma.annonce.findUniqueOrThrow({ where: { id: annonce.id } });
    expect(detail.nbFavoris).toBe(1);

    for (let index = 0; index < 2; index += 1) {
      const retrait = await request(app.getHttpServer())
        .delete(`/v1/annonces/${annonce.id}/favori`)
        .set('Authorization', `Bearer ${autreSession.accessToken}`);
      expect(retrait.status).toBe(200);
    }

    detail = await prisma.annonce.findUniqueOrThrow({ where: { id: annonce.id } });
    expect(detail.nbFavoris).toBe(0);
  });

  it('sert les catégories avec ETag et 304', async () => {
    const premiere = await request(app.getHttpServer()).get('/v1/referentiels/categories');
    expect(premiere.status).toBe(200);
    expect(Array.isArray(premiere.body)).toBe(true);
    expect(premiere.headers.etag).toBeTruthy();

    const seconde = await request(app.getHttpServer())
      .get('/v1/referentiels/categories')
      .set('If-None-Match', premiere.headers.etag as string);
    expect(seconde.status).toBe(304);
  });

  it('liste mes annonces avec un curseur stable', async () => {
    const liste = await request(app.getHttpServer())
      .get('/v1/moi/annonces?limite=1')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(liste.status).toBe(200);
    expect(liste.body.items).toHaveLength(1);
    expect(liste.body.curseurSuivant).toEqual(expect.any(String));

    const suite = await request(app.getHttpServer())
      .get(`/v1/moi/annonces?limite=1&curseur=${encodeURIComponent(liste.body.curseurSuivant)}`)
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(suite.status).toBe(200);
    expect(suite.body.items[0].id).not.toBe(liste.body.items[0].id);
  });
});
