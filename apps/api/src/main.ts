import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import pinoHttp from 'pino-http';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { TraceIdMiddleware } from './common/http/trace-id.middleware';
import { logger } from './common/observability/logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const traceIdMiddleware = new TraceIdMiddleware();

  app.setGlobalPrefix('v1');
  app.use(traceIdMiddleware.use.bind(traceIdMiddleware));
  app.use(pinoHttp({ logger }));
  app.useGlobalFilters(new AllExceptionsFilter());

  const origines = config
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origine) => origine.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origines.length > 0 ? origines : false,
    credentials: true,
  });

  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
  logger.info({ port }, 'API SecondeVie démarrée');
}

bootstrap().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Échec du démarrage de l’API');
  process.exitCode = 1;
});
