import { describe, expect, it } from 'vitest';
import { CodeVerification } from '../code-verification';

const poivre = 'poivre-de-test-suffisamment-long';

describe('CodeVerification', () => {
  it('génère toujours 6 chiffres', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(CodeVerification.generer().reveler()).toMatch(/^\d{6}$/);
    }
  });

  it('vérifie le bon code et rejette un autre code', () => {
    const code = CodeVerification.depuis('123456');
    const hash = code.hacher(poivre, 'utilisateur:email');

    expect(CodeVerification.verifier('123456', hash, poivre, 'utilisateur:email')).toBe(true);
    expect(CodeVerification.verifier('654321', hash, poivre, 'utilisateur:email')).toBe(false);
    expect(CodeVerification.verifier('123456', hash, poivre, 'autre:email')).toBe(false);
  });

  it('rejette un hash altéré sans lever d’exception', () => {
    expect(CodeVerification.verifier('123456', 'pas-un-hash', poivre, 'ctx')).toBe(false);
  });

  it('masque le code dans les représentations', () => {
    const code = CodeVerification.depuis('123456');

    expect(code.toString()).toBe('[REDACTED]');
    expect(JSON.stringify({ code })).toBe('{"code":"[REDACTED]"}');
  });
});
