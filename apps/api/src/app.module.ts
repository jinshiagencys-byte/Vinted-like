import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './common/auth/auth.module';
import { validateEnv } from './common/config/env';
import { DatabaseModule } from './common/database/database.module';
import { HealthController } from './common/http/health.controller';
import { OutboxModule } from './common/outbox/outbox.module';
import { RedisModule } from './common/redis/redis.module';

function parseRedisUrl(url: string): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db: number;
} {
  const parsed = new URL(url);
  const db = parsed.pathname.replace('/', '');

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    ...(parsed.username ? { username: parsed.username } : {}),
    ...(parsed.password ? { password: parsed.password } : {}),
    db: db ? Number(db) : 0,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: parseRedisUrl(config.getOrThrow<string>('REDIS_URL')),
      }),
    }),
    DatabaseModule,
    RedisModule,
    OutboxModule,
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
