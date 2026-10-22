import { describe, expect, it } from 'vitest';
import { PolitiqueVerification } from '../politique-verification';

describe('PolitiqueVerification', () => {
  const politique = new PolitiqueVerification();
  const maintenant = new Date('2026-10-22T12:00:00.000Z');

  it('considère un code expiré à partir de expireLe', () => {
    expect(
      politique.estExpire(
        { expireLe: new Date('2026-10-22T11:59:59.000Z'), tentatives: 0 },
        maintenant,
      ),
    ).toBe(true);
    expect(
      politique.estExpire(
        { expireLe: new Date('2026-10-22T12:00:01.000Z'), tentatives: 0 },
        maintenant,
      ),
    ).toBe(false);
  });

  it('bloque après 5 tentatives', () => {
    expect(politique.peutTenter({ expireLe: maintenant, tentatives: 4 })).toBe(true);
    expect(politique.peutTenter({ expireLe: maintenant, tentatives: 5 })).toBe(false);
  });

  it('impose 60 secondes entre deux renvois et 5 renvois par jour', () => {
    expect(politique.peutRenvoyer(new Date('2026-10-22T11:59:30.000Z'), 0, maintenant)).toBe(false);
    expect(politique.peutRenvoyer(new Date('2026-10-22T11:59:00.000Z'), 0, maintenant)).toBe(true);
    expect(politique.peutRenvoyer(new Date('2026-10-22T10:00:00.000Z'), 5, maintenant)).toBe(false);
    expect(politique.peutRenvoyer(null, 0, maintenant)).toBe(true);
  });

  it('calcule une expiration à 15 minutes', () => {
    expect(politique.expirationDepuis(maintenant).toISOString()).toBe('2026-10-22T12:15:00.000Z');
  });
});
