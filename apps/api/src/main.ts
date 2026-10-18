/* API entry point: boots the NestJS application with the /api prefix, CORS for the web client and shutdown hooks. */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const DEFAULT_PORT = 3000;

const app = await NestFactory.create(AppModule);
app.setGlobalPrefix('api');
app.enableCors();
app.enableShutdownHooks();
const port = Number(process.env.API_PORT ?? DEFAULT_PORT);
await app.listen(port);
console.log(`API listening on http://localhost:${String(port)}/api`);
