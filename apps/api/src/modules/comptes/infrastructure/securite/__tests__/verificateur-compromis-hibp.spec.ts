import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotDePasse } from '../../../domain/value-objects/mot-de-passe';
import { VerificateurCompromisHibp } from '../verificateur-compromis-hibp';

const motDePasse = MotDePasse.creer('correct horse battery staple');
const sha1 = createHash('sha1').update(motDePasse.reveler()).digest('hex').toUpperCase();
const prefixe = sha1.slice(0, 5);
const suffixe = sha1.slice(5);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('VerificateurCompromisHibp', () => {
  it('détecte un mot de passe compromis sans envoyer le hash complet', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `${suffixe}:42\nAUTREHASH:1\n`,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(new VerificateurCompromisHibp().estCompromis(motDePasse)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.pwnedpasswords.com/range/${prefixe}`,
      expect.objectContaining({ headers: expect.objectContaining({ 'Add-Padding': 'true' }) }),
    );
  });

  it('ne signale pas un mot de passe absent de la réponse', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'AUTREHASH:1\n',
      }),
    );

    await expect(new VerificateurCompromisHibp().estCompromis(motDePasse)).resolves.toBe(false);
  });

  it('est fail-open si HIBP est indisponible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('réseau indisponible')));

    await expect(new VerificateurCompromisHibp().estCompromis(motDePasse)).resolves.toBe(false);
  });

  it('est fail-open si HIBP renvoie une erreur HTTP', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => '',
      }),
    );

    await expect(new VerificateurCompromisHibp().estCompromis(motDePasse)).resolves.toBe(false);
  });
});
