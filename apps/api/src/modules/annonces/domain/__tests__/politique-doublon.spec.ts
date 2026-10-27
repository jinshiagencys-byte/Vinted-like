import { describe, expect, it } from 'vitest';
import { distanceHamming, estDoublonExact, estQuasiDoublon } from '../politiques/politique-doublon';

describe('PolitiqueDoublon', () => {
  it('calcule la distance de Hamming', () => {
    expect(distanceHamming('0000000000000000', '0000000000000000')).toBe(0);
    expect(distanceHamming('0000000000000000', '000000000000000f')).toBe(4);
    expect(distanceHamming('00', '000')).toBe(Number.POSITIVE_INFINITY);
  });

  it('reconnaît un doublon exact sans tenir compte de la casse', () => {
    expect(estDoublonExact('AABBCCDDEEFF0011', 'aabbccddeeff0011')).toBe(true);
    expect(estDoublonExact('AABBCCDDEEFF0011', 'aabbccddeeff0012')).toBe(false);
  });

  it('signale un quasi-doublon à 6 bits et ignore 7 bits', () => {
    expect(estQuasiDoublon('0000000000000000', ['000000000000003f'], 6)).toBe(true);
    expect(estQuasiDoublon('0000000000000000', ['000000000000007f'], 6)).toBe(false);
  });

  it('ignore la photo comparée à elle-même', () => {
    expect(estQuasiDoublon('0000000000000000', ['0000000000000000'], 6)).toBe(false);
  });
});
