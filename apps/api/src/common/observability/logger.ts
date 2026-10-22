import pino from 'pino';

/**
 * Logger structuré commun. Les chemins de rédaction couvrent les en-têtes
 * HTTP et les noms de champs sensibles utilisés par M1.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'secondevie-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.email',
      'req.body.telephone',
      'req.body.motDePasse',
      'req.body.password',
      'req.body.code',
      'res.headers["set-cookie"]',
      'email',
      'telephone',
      'motDePasse',
      'motDePasseHash',
      'password',
      'refreshToken',
      'code',
      'authorization',
    ],
    censor: '[REDACTED]',
  },
});
