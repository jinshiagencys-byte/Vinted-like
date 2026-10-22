import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { OutboxPublisher } from './outbox.publisher';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const limite = Number(process.env.OUTBOX_LIMITE ?? 50);
    const publies = await app
      .get(OutboxPublisher)
      .publierEnAttente(Number.isFinite(limite) && limite > 0 ? limite : 50);
    console.log(`${publies} événement(s) outbox publié(s).`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Échec de la publication outbox :', error);
  process.exitCode = 1;
});
