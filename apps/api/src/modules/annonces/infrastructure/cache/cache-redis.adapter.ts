import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../../common/redis/redis.module';
import type { CachePort } from '../../domain/ports';

@Injectable()
export class CacheRedisAdapter implements CachePort {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async lire<T>(cle: string): Promise<T | null> {
    const valeur = await this.redis.get(cle);
    if (valeur === null) return null;

    try {
      return JSON.parse(valeur) as T;
    } catch {
      await this.redis.del(cle);
      return null;
    }
  }

  async ecrire<T>(cle: string, valeur: T, dureeSecondes: number): Promise<void> {
    await this.redis.set(cle, JSON.stringify(valeur), 'EX', dureeSecondes);
  }

  async supprimer(cle: string): Promise<void> {
    await this.redis.del(cle);
  }

  async supprimerParPrefixe(prefixe: string): Promise<void> {
    let curseur = '0';

    do {
      const [suivant, cles] = await this.redis.scan(curseur, 'MATCH', `${prefixe}*`, 'COUNT', 100);
      curseur = suivant;

      if (cles.length > 0) {
        await this.redis.del(...cles);
      }
    } while (curseur !== '0');
  }
}
