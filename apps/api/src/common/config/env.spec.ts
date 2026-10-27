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
  AUTH_CODE_PEPPER: 'code-pepper-de-test-32-caracteres-minimum',
  AUTH_REFRESH_PEPPER: 'refresh-pepper-de-test-32-caracteres-minimum',
  AUTH_RESET_PEPPER: 'reset-pepper-de-test-32-caracteres-minimum',
  EXPORT_SIGNING_SECRET: 'export-secret-de-test-32-caracteres-minimum',
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

  it('refuse les marqueurs de développement en production sans les afficher', () => {
    let message = '';

    try {
      validateEnv({ ...base, NODE_ENV: 'production' });
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).toContain('S3_ACCESS_KEY_ID');
    expect(message).not.toContain('secondevie-secret');
  });

  it('accepte une configuration de production complète', () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: 'production',
      S3_ACCESS_KEY_ID: 'cle-production',
      S3_SECRET_ACCESS_KEY: 'secret-production-suffisamment-long',
    });

    expect(env.NODE_ENV).toBe('production');
  });
});
