/**
 * Contrats partagés entre l'API, le mobile et le back-office.
 *
 * Le client typé sera généré depuis OpenAPI à l'étape 2 de M1. Pour le lot 0,
 * seules les constantes réellement partagées sont exposées.
 */
export const API_PREFIX = '/v1' as const;

export type Role = 'membre' | 'moderateur' | 'admin' | 'systeme';
