import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import { Public } from '../auth/public.decorator';
import { REDIS_CLIENT } from '../redis/redis.module';

@Controller('sante')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  async verifier(): Promise<{
    statut: 'ok';
    baseDeDonnees: 'ok';
    redis: 'ok';
    horodatage: string;
  }> {
    const [base, cache] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.ping(),
    ]);

    if (base.status === 'rejected' || cache.status === 'rejected') {
      throw new ServiceUnavailableException({
        code: 'fournisseur_indisponible',
        message: 'Une dépendance technique est indisponible.',
        details: {
          baseDeDonnees: base.status === 'fulfilled' ? 'ok' : 'indisponible',
          redis: cache.status === 'fulfilled' ? 'ok' : 'indisponible',
        },
      });
    }

    return {
      statut: 'ok',
      baseDeDonnees: 'ok',
      redis: 'ok',
      horodatage: new Date().toISOString(),
    };
  }
}
