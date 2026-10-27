import { describe, expect, it } from 'vitest';
import { ServiceSignatureExport } from '../service-signature-export';

function service(secret = 'export-secret-de-test-32-caracteres-minimum'): ServiceSignatureExport {
  return new ServiceSignatureExport({
    getOrThrow: (cle: string) => {
      if (cle === 'EXPORT_SIGNING_SECRET') return secret;
      throw new Error(`Clé inconnue : ${cle}`);
    },
  } as never);
}

describe('ServiceSignatureExport', () => {
  it('signe une URL de téléchargement valable 15 minutes', () => {
    const { url, expireLe } = service().signer('11111111-1111-4111-8111-111111111111', 'user-1');

    expect(url).toMatch(
      /^\/v1\/moi\/export\/11111111-1111-4111-8111-111111111111\/telecharger\?exp=\d+&signature=[A-Za-z0-9_-]+$/,
    );
    expect(expireLe.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    expect(expireLe.getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000 + 1_000);
  });

  it('accepte une signature exacte et refuse une altération', () => {
    const signature = service();
    const { url } = signature.signer('export-1', 'user-1');
    const parametres = new URLSearchParams(url.split('?')[1]);
    const expiration = Number(parametres.get('exp'));
    const valeur = parametres.get('signature') ?? '';

    expect(signature.verifier('export-1', 'user-1', expiration, valeur)).toBe(true);
    expect(signature.verifier('export-2', 'user-1', expiration, valeur)).toBe(false);
    expect(signature.verifier('export-1', 'user-2', expiration, valeur)).toBe(false);
    expect(signature.verifier('export-1', 'user-1', expiration + 1, valeur)).toBe(false);
    expect(signature.verifier('export-1', 'user-1', expiration, `${valeur}x`)).toBe(false);
  });

  it('refuse un lien expiré', () => {
    const signature = service();
    const { url } = signature.signer('export-1', 'user-1');
    const parametres = new URLSearchParams(url.split('?')[1]);
    const expiration = Number(parametres.get('exp'));
    const valeur = parametres.get('signature') ?? '';

    expect(
      signature.verifier('export-1', 'user-1', Math.floor(Date.now() / 1_000) - 1, valeur),
    ).toBe(false);
    expect(signature.verifier('export-1', 'user-1', expiration, valeur)).toBe(true);
  });

  it('refuse une signature produite avec un autre secret', () => {
    const autre = service('un-autre-secret-de-test-32-caracteres!!');
    const { url } = autre.signer('export-1', 'user-1');
    const parametres = new URLSearchParams(url.split('?')[1]);

    expect(
      service().verifier(
        'export-1',
        'user-1',
        Number(parametres.get('exp')),
        parametres.get('signature') ?? '',
      ),
    ).toBe(false);
  });
});
