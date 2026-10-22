import { describe, expect, it } from 'vitest';
import { MotDePasse } from '../../../domain/value-objects/mot-de-passe';
import { HacheurMotDePasseArgon2 } from '../hacheur-mot-de-passe-argon2';

describe('HacheurMotDePasseArgon2', () => {
  const hacheur = new HacheurMotDePasseArgon2();
  const motDePasse = MotDePasse.creer('un-mot-de-passe-solide');

  it('produit un hash Argon2id non réversible et le vérifie', async () => {
    const hash = await hacheur.hacher(motDePasse);

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain(motDePasse.reveler());
    await expect(hacheur.verifier(hash, motDePasse)).resolves.toBe(true);
  });

  it('refuse un mauvais mot de passe ou un hash invalide', async () => {
    const hash = await hacheur.hacher(motDePasse);

    await expect(hacheur.verifier(hash, MotDePasse.creer('un-autre-mot-de-passe'))).resolves.toBe(
      false,
    );
    await expect(hacheur.verifier('pas-un-hash', motDePasse)).resolves.toBe(false);
  });
});
