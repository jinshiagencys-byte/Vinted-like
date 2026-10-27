export const STATUTS_ANNONCE = [
  'brouillon',
  'en_revue',
  'publiee',
  'reservee',
  'vendue',
  'archivee',
  'refusee',
] as const;

export type StatutAnnonce = (typeof STATUTS_ANNONCE)[number];

export const STATUTS_ACTIFS: readonly StatutAnnonce[] = ['en_revue', 'publiee', 'reservee'];

export const ETATS_ARTICLE = [
  'neuf_avec_etiquette',
  'neuf_sans_etiquette',
  'tres_bon',
  'bon',
  'satisfaisant',
] as const;

export type EtatArticle = (typeof ETATS_ARTICLE)[number];

export const STATUTS_TRAITEMENT_PHOTO = ['en_attente', 'televersee', 'traitee', 'rejetee'] as const;

export type StatutTraitementPhoto = (typeof STATUTS_TRAITEMENT_PHOTO)[number];

export type StatutModerationPhoto = 'ok' | 'a_verifier' | 'refusee';

export const SYSTEMES_TAILLE = ['EU', 'UK', 'US', 'FR', 'universel'] as const;

export type SystemeTaille = (typeof SYSTEMES_TAILLE)[number];

export const TRANSITIONS: Readonly<Record<StatutAnnonce, readonly StatutAnnonce[]>> = {
  brouillon: ['en_revue', 'publiee', 'refusee', 'archivee'],
  en_revue: ['publiee', 'refusee', 'archivee'],
  publiee: ['reservee', 'archivee', 'en_revue'],
  reservee: ['publiee', 'vendue'],
  vendue: [],
  archivee: ['en_revue', 'publiee'],
  refusee: ['brouillon', 'archivee'],
};

export function transitionAutorisee(de: StatutAnnonce, vers: StatutAnnonce): boolean {
  return TRANSITIONS[de].includes(vers);
}
