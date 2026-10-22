import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../../common/errors/domain-error';
import { JetonRefresh } from '../jeton-refresh';

const poivre = 'poivre-de-test-suffisamment-long';

describe('JetonRefresh', () => {
  it('génère un jeton opaque et vérifie son hash', () => {
    const jeton = JetonRefresh.generer();
    const hash = jeton.hacher(poivre);

    expect(jeton.reveler()).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(JetonRefresh.verifier(jeton.reveler(), hash, poivre)).toBe(true);
    expect(JetonRefresh.verifier(JetonRefresh.generer().reveler(), hash, poivre)).toBe(false);
  });

  it('refuse un jeton trop court ou invalide', () => {
    expect(() => JetonRefresh.depuis('court')).toThrow(DomainError);
    expect(() => JetonRefresh.depuis('a'.repeat(32) + '!')).toThrow(DomainError);
  });

  it('masque le jeton dans les représentations', () => {
    const jeton = JetonRefresh.generer();

    expect(jeton.toString()).toBe('[REDACTED]');
    expect(JSON.stringify({ jeton })).toBe('{"jeton":"[REDACTED]"}');
  });
});
