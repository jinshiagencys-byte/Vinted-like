import { z } from 'zod';

const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit contenir au moins 32 caractères'),
  JWT_ISSUER: z.string().min(1).default('secondevie'),
  JWT_AUDIENCE: z.string().min(1).default('secondevie-api'),
  JWT_KID: z.string().min(1).default('dev-1'),
  AUTH_CODE_PEPPER: z.string().min(32, 'AUTH_CODE_PEPPER doit contenir au moins 32 caractères'),
  AUTH_REFRESH_PEPPER: z
    .string()
    .min(32, 'AUTH_REFRESH_PEPPER doit contenir au moins 32 caractères'),
  AUTH_RESET_PEPPER: z.string().min(32, 'AUTH_RESET_PEPPER doit contenir au moins 32 caractères'),
  EXPORT_SIGNING_SECRET: z
    .string()
    .min(32, 'EXPORT_SIGNING_SECRET doit contenir au moins 32 caractères'),
  EXPORT_DIR: z.string().default('.exports'),
  CORS_ORIGINS: z.string().default('http://localhost:8081'),
  LOG_LEVEL: z.enum(logLevels).default('info'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validation au démarrage : aucune variable requise ne doit être absente.
 * Le message ne contient jamais les valeurs, seulement les noms de champs.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuration invalide : ${details}`);
  }

  return parsed.data;
}
