import { describe, expect, it, vi } from 'vitest';
import { LimiteDebitException } from '../../../../../common/errors/limite-debit.exception';
import { LimiteurDebitService } from '../limiteur-debit.service';

function client(resultats: Array<[number, number]>) {
  let index = 0;

  return {
    eval: vi.fn(async () => resultats[Math.min(index++, resultats.length - 1)]),
    get: vi.fn(async () => null),
    del: vi.fn(async () => 1),
    set: vi.fn(async () => 'OK'),
    ttl: vi.fn(async () => 42),
  };
}

describe('LimiteurDebitService', () => {
  it('hache l’identifiant pour ne jamais stocker une IP ou un e-mail en clair', () => {
    const empreinte = LimiteurDebitService.empreinte('alice@example.com');

    expect(empreinte).toMatch(/^[a-f0-9]{32}$/);
    expect(empreinte).not.toContain('alice');
    expect(LimiteurDebitService.empreinte('alice@example.com')).toBe(empreinte);
  });

  it('accepte tant que la limite n’est pas dépassée', async () => {
    const redis = client([
      [1, 60_000],
      [5, 30_000],
    ]);
    const limiteur = new LimiteurDebitService(redis as never);

    await expect(limiteur.consommer('cle', 5, 60)).resolves.toBeUndefined();
    await expect(limiteur.consommer('cle', 5, 60)).resolves.toBeUndefined();
    expect(redis.eval).toHaveBeenCalledTimes(2);
  });

  it('refuse au-delà de la limite avec un Retry-After arrondi', async () => {
    const limiteur = new LimiteurDebitService(client([[6, 31_000]]) as never);

    await expect(limiteur.consommer('cle', 5, 60)).rejects.toMatchObject({
      retryAfterSecondes: 31,
    });
    await expect(limiteur.consommer('cle', 5, 60)).rejects.toBeInstanceOf(LimiteDebitException);
  });

  it('pose et lit un blocage temporaire', async () => {
    const redis = client([[1, 1_000]]);
    const limiteur = new LimiteurDebitService(redis as never);

    await limiteur.bloquer('compte', 900);
    await expect(limiteur.dureeBlocage('compte')).resolves.toBe(42);
    expect(redis.set).toHaveBeenCalledWith('blocage:compte', '1', 'EX', 900);
    expect(redis.ttl).toHaveBeenCalledWith('blocage:compte');
  });
});
