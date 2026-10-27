/**
 * Contrats partagés entre l'API, le mobile et le back-office.
 *
 * Le client typé est adossé au contrat OpenAPI `docs/openapi/m1-comptes.yaml`.
 * Toute évolution de route ou de charge utile doit être répercutée ici.
 */
export const API_PREFIX = '/v1' as const;

export * from './api';
