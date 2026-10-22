import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../../common/errors/domain-error';
import { PolitiqueMotDePasse } from '../politique-mot-de-passe';
import { MotDePasse } from '../../value-objects/mot-de-passe';

describe('PolitiqueMotDePasse', () => {
  it('refuse un mot de passe compromis', async () => {
    const politique = new PolitiqueMotDePasse({
      estCompromis: async () => true,
    });

    await expect(politique.valider(MotDePasse.creer('un-mot-de-passe-solide'))).rejects.toThrow(
      DomainError,
    );
  });

  it('accepte un mot de passe non compromis', async () => {
    const politique = new PolitiqueMotDePasse({
      estCompromis: async () => false,
    });

    await expect(
      politique.valider(MotDePasse.creer('un-mot-de-passe-solide')),
    ).resolves.toBeUndefined();
  });
});
