import type { Annonce, Categorie, Photo } from '../entities';

export function uneAnnonce(partiel: Partial<Annonce> = {}): Annonce {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    reference: 'SV-ABC123',
    vendeurId: '22222222-2222-4222-8222-222222222222',
    titre: 'Jean Levi’s 501',
    description: 'Jean porté quelques fois, très bon état, aucune tache visible.',
    categorieId: '33333333-3333-4333-8333-333333333333',
    marqueId: null,
    taille: 'W30',
    etat: 'tres_bon',
    couleur: 'bleu',
    matiere: 'coton',
    prixCents: 2_800,
    prixOrigineCents: 9_900,
    devise: 'EUR',
    poidsG: 450,
    statut: 'brouillon',
    motifRefus: null,
    nbVues: 0,
    nbFavoris: 0,
    version: 0,
    publieeLe: null,
    archiveeLe: null,
    creeLe: new Date('2026-10-28T09:00:00Z'),
    majLe: new Date('2026-10-28T09:00:00Z'),
    ...partiel,
  };
}

export function unePhoto(partiel: Partial<Photo> = {}): Photo {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    annonceId: '11111111-1111-4111-8111-111111111111',
    urlOriginale: 'originaux/annonce/photo.webp',
    urlVariantes: { s: 'https://cdn/s.webp', m: 'https://cdn/m.webp' },
    ordre: 0,
    largeur: 800,
    hauteur: 800,
    perceptHash: '00000000000000ff',
    statutTraitement: 'traitee',
    statutModeration: 'ok',
    tailleOctets: 120_000,
    mimeType: 'image/webp',
    creeLe: new Date('2026-10-28T09:00:00Z'),
    ...partiel,
  };
}

export function uneCategorie(partiel: Partial<Categorie> = {}): Categorie {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    parentId: null,
    nom: 'Pantalons et jeans',
    slug: 'femme-pantalons',
    niveau: 1,
    tailleObligatoire: true,
    actif: true,
    ordre: 1,
    creeLe: new Date('2026-10-28T09:00:00Z'),
    majLe: new Date('2026-10-28T09:00:00Z'),
    ...partiel,
  };
}
