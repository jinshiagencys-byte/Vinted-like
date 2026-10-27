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
  // Stockage objet des photos (M2). Les valeurs par défaut correspondent au
  // MinIO de `infra/docker/docker-compose.yml` ; la production les remplace.
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('eu-west-1'),
  S3_ACCESS_KEY_ID: z.string().default('secondevie'),
  S3_SECRET_ACCESS_KEY: z.string().default('secondevie-secret'),
  S3_BUCKET: z.string().default('secondevie'),
  S3_PUBLIC_BASE_URL: z.string().default('http://localhost:9000/secondevie'),
  S3_FORCE_PATH_STYLE: z.string().default('true'),
  S3_PRESIGN_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
});

export type Env = z.infer<typeof envSchema>;

const MARQUEURS_DEVELOPPEMENT: ReadonlyArray<readonly [keyof Env, readonly string[]]> = [
  ['JWT_SECRET', ['change-me']],
  ['AUTH_CODE_PEPPER', ['change-me']],
  ['AUTH_REFRESH_PEPPER', ['change-me']],
  ['AUTH_RESET_PEPPER', ['change-me']],
  ['EXPORT_SIGNING_SECRET', ['change-me']],
  ['S3_ACCESS_KEY_ID', ['secondevie']],
  ['S3_SECRET_ACCESS_KEY', ['secondevie-secret']],
];

function verifierConfigurationProduction(env: Env): void {
  if (env.NODE_ENV !== 'production') return;

  for (const [cle, marqueurs] of MARQUEURS_DEVELOPPEMENT) {
    const valeur = String(env[cle]);

    if (marqueurs.some((marqueur) => valeur === marqueur || valeur.startsWith(`${marqueur}-`))) {
      // Le nom du champ suffit : ne jamais recopier la valeur dans le message.
      throw new Error(`Configuration invalide : ${cle} doit être remplacé en production`);
    }
  }
}

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

  verifierConfigurationProduction(parsed.data);

  return parsed.data;
}
