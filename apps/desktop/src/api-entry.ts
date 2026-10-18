/* Desktop API entry: boots the same NestJS application as apps/api/src/main.ts on 127.0.0.1 at API_PORT, without top-level await so it bundles to CommonJS. */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../api/src/app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(Number(process.env.API_PORT), '127.0.0.1');
}

bootstrap().catch((failure: unknown) => {
  console.error(failure);
  process.exit(1);
});
