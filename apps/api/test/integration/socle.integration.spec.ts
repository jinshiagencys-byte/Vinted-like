import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';
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

describe.skipIf(!dockerDisponible())('Socle lot 0 (PostgreSQL + Redis)', () => {
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let prisma: PrismaClient;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16-alpine').start();
    redis = await new RedisContainer('redis:7-alpine').start();

    process.env.DATABASE_URL = postgres.getConnectionUri();
    prisma = new PrismaClient();

    await appliquerToutesLesMigrations(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await postgres?.stop();
    await redis?.stop();
  });

  it('applique la migration et écrit un événement outbox', async () => {
    await prisma.outboxEvenement.create({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        type: 'compte.cree',
        agregatType: 'utilisateur',
        agregatId: '11111111-1111-4111-8111-111111111111',
        payload: { utilisateurId: '11111111-1111-4111-8111-111111111111' },
        traceId: 'trace-test-1234',
      },
    });

    expect(await prisma.outboxEvenement.count()).toBe(1);
  });

  it('répond à un PING Redis', async () => {
    const client = new Redis({
      host: redis.getHost(),
      port: redis.getMappedPort(6379),
    });

    await expect(client.ping()).resolves.toBe('PONG');
    await client.quit();
  });
});
