import { describe, expect, it } from 'vitest';
import { PolitiqueSession } from '../politique-session';

function appareil(id: string, jours: number): { id: string; creeLe: Date } {
  return {
    id,
    creeLe: new Date(Date.UTC(2026, 9, 22 - jours)),
  };
}

describe('PolitiqueSession', () => {
  const politique = new PolitiqueSession();
  const maintenant = new Date('2026-10-22T12:00:00.000Z');

  it('révoque les appareils au-delà de 10, du plus ancien au plus récent', () => {
    const appareils = Array.from({ length: 12 }, (_, index) =>
      appareil(`appareil-${index}`, index),
    );

    expect(new Set(politique.appareilsARevoquer(appareils))).toEqual(
      new Set(['appareil-11', 'appareil-10']),
    );
  });

  it('ne révoque rien à 10 appareils', () => {
    const appareils = Array.from({ length: 10 }, (_, index) =>
      appareil(`appareil-${index}`, index),
    );

    expect(politique.appareilsARevoquer(appareils)).toEqual([]);
  });

  it('accorde 60 secondes de grâce pour l’ancien refresh', () => {
    expect(politique.estDansGrace(new Date('2026-10-22T11:59:30.000Z'), maintenant)).toBe(true);
    expect(politique.estDansGrace(new Date('2026-10-22T11:58:59.000Z'), maintenant)).toBe(false);
  });

  it('détecte 90 jours d’inactivité', () => {
    expect(
      politique.estInactif(
        { id: 'a', creeLe: new Date('2026-01-01T00:00:00.000Z'), derniereActiviteLe: null },
        maintenant,
      ),
    ).toBe(true);
    expect(
      politique.estInactif(
        {
          id: 'b',
          creeLe: new Date('2026-01-01T00:00:00.000Z'),
          derniereActiviteLe: new Date('2026-10-01T00:00:00.000Z'),
        },
        maintenant,
      ),
    ).toBe(false);
  });
});
