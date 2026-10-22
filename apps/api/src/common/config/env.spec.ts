import { describe, expect, it } from 'vitest';
import { validateEnv } from './env';

const base = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'secret-de-test-32-caracteres-minimum',
  JWT_ISSUER: 'secondevie',
  JWT_AUDIENCE: 'secondevie-api',
  JWT_KID: 'test-1',
  CORS_ORIGINS: 'http://localhost:8081',
  LOG_LEVEL: 'silent',
};

describe('validateEnv', () => {
  it('accepte une configuration complète', () => {
    const env = validateEnv(base);

    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('test');
  });

  it('refuse un secret JWT trop court sans afficher sa valeur', () => {
    let message = '';

    try {
      validateEnv({ ...base, JWT_SECRET: 'court' });
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).toContain('JWT_SECRET');
    expect(message).not.toContain('court');
  });
});
