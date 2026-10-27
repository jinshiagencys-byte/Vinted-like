import { describe, expect, it } from 'vitest';
import { STATUTS_ANNONCE, transitionAutorisee } from '../enums';

const ATTENDUES = new Set([
  'brouillon>en_revue',
  'brouillon>publiee',
  'brouillon>refusee',
  'brouillon>archivee',
  'en_revue>publiee',
  'en_revue>refusee',
  'en_revue>archivee',
  'publiee>reservee',
  'publiee>archivee',
  'publiee>en_revue',
  'reservee>publiee',
  'reservee>vendue',
  'archivee>en_revue',
  'archivee>publiee',
  'refusee>brouillon',
  'refusee>archivee',
]);

describe('machine à états des annonces', () => {
  it('autorise exactement les transitions documentées sur les 7 × 7 couples', () => {
    const autorisees: string[] = [];

    for (const de of STATUTS_ANNONCE) {
      for (const vers of STATUTS_ANNONCE) {
        if (transitionAutorisee(de, vers)) autorisees.push(`${de}>${vers}`);
      }
    }

    expect(new Set(autorisees)).toEqual(ATTENDUES);
  });

  it('ne permet jamais de sortir de vendue', () => {
    expect(STATUTS_ANNONCE.filter((statut) => transitionAutorisee('vendue', statut))).toEqual([]);
  });
});
