import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type Redis from 'ioredis';
import { LimiteDebitException } from '../../../../common/errors/limite-debit.exception';
import { REDIS_CLIENT } from '../../../../common/redis/redis.module';

interface ResultatCompteur {
  valeur: number;
  ttlMs: number;
}

/**
 * Compteur atomique Redis à fenêtre fixe. Les clés ne contiennent jamais
 * d'e-mail, de téléphone ou d'IP en clair : l'identifiant est haché.
 */
@Injectable()
export class LimiteurDebitService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  static empreinte(valeur: string): string {
    return createHash('sha256').update(valeur).digest('hex').slice(0, 32);
  }

  async consommer(
    cle: string,
    limite: number,
    fenetreSecondes: number,
    code = 'trop_de_requetes',
    message = 'Trop de requêtes. Réessayez plus tard.',
  ): Promise<void> {
    const resultat = await this.incrementer(cle, fenetreSecondes, 1);

    if (resultat.valeur > limite) {
      throw new LimiteDebitException(Math.max(1, Math.ceil(resultat.ttlMs / 1_000)), code, message);
    }
  }

  async compter(cle: string): Promise<number> {
    const valeur = await this.redis.get(cle);
    return valeur ? Number(valeur) : 0;
  }

  async incrementer(cle: string, fenetreSecondes: number, cout = 1): Promise<ResultatCompteur> {
    const script = `
      local courant = redis.call('INCRBY', KEYS[1], ARGV[1])
      if courant == tonumber(ARGV[1]) then
        redis.call('PEXPIRE', KEYS[1], ARGV[2])
      end
      local ttl = redis.call('PTTL', KEYS[1])
      if ttl < 0 then
        redis.call('PEXPIRE', KEYS[1], ARGV[2])
        ttl = tonumber(ARGV[2])
      end
      return {courant, ttl}
    `;
    const resultat = (await this.redis.eval(
      script,
      1,
      `debit:${cle}`,
      cout,
      Math.max(1_000, fenetreSecondes * 1_000),
    )) as [number, number];

    return { valeur: Number(resultat[0]), ttlMs: Number(resultat[1]) };
  }

  async reinitialiser(cle: string): Promise<void> {
    await this.redis.del(`debit:${cle}`);
  }

  async bloquer(cle: string, dureeSecondes: number): Promise<void> {
    await this.redis.set(`blocage:${cle}`, '1', 'EX', Math.max(1, dureeSecondes));
  }

  async debloquer(cle: string): Promise<void> {
    await this.redis.del(`blocage:${cle}`);
  }

  async dureeBlocage(cle: string): Promise<number> {
    const ttl = await this.redis.ttl(`blocage:${cle}`);
    return ttl > 0 ? ttl : 0;
  }
}
