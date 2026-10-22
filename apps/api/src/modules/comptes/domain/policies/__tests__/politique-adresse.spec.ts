import { describe, expect, it } from 'vitest';
import { PolitiqueAdresse } from '../politique-adresse';

describe('PolitiqueAdresse', () => {
  const politique = new PolitiqueAdresse();
  const ancienne = {
    id: 'ancienne',
    estDefaut: false,
    supprimeeLe: null,
    creeLe: new Date('2026-01-01'),
  };
  const recente = {
    id: 'recente',
    estDefaut: false,
    supprimeeLe: null,
    creeLe: new Date('2026-05-01'),
  };
  const supprimee = {
    id: 'supprimee',
    estDefaut: false,
    supprimeeLe: new Date('2026-06-01'),
    creeLe: new Date('2026-06-01'),
  };

  it('vérifie l’unicité du défaut actif', () => {
    expect(
      politique.estDefautUnique([
        { ...ancienne, estDefaut: true },
        { ...recente, estDefaut: false },
      ]),
    ).toBe(true);
    expect(
      politique.estDefautUnique([
        { ...ancienne, estDefaut: true },
        { ...recente, estDefaut: true },
      ]),
    ).toBe(false);
  });

  it('choisit l’adresse active la plus récente hors exclusion', () => {
    expect(politique.choisirNouveauDefaut([ancienne, recente, supprimee], 'recente')).toBe(
      'ancienne',
    );
    expect(politique.choisirNouveauDefaut([ancienne, recente], 'recente')).toBe('ancienne');
  });

  it('impose une suppression logique et jamais physique', () => {
    expect(politique.doitSupprimerLogiquement(true)).toBe(true);
    expect(politique.doitSupprimerLogiquement(false)).toBe(false);
    expect(politique.peutSupprimerPhysiquement()).toBe(false);
  });
});
