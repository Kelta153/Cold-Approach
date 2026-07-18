import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';
import { getAuth, getNodeIntegration } from './modules/auth/auth.config';

async function bootstrap() {
  // BetterAuth's Node handler needs the raw, unparsed request body/stream for `/api/auth/*` —
  // Nest's default global body parser would consume it first and break auth. So: disable Nest's
  // default body parser, mount BetterAuth's handler directly on the underlying Express instance
  // first, then apply `express.json()` ourselves for every other route. This is BetterAuth's
  // documented Nest.js integration pattern.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  const [auth, { toNodeHandler }] = await Promise.all([getAuth(), getNodeIntegration()]);

  // CORS must be registered before the auth handler: Express runs middleware/routes in
  // registration order, and `toNodeHandler` is a terminal handler that never calls `next()` —
  // if CORS were added afterward (as it originally was here), every /api/auth/* request would
  // complete and return before the CORS middleware ever ran, so the browser would block it.
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.all('/api/auth/*', toNodeHandler(auth));
  app.use(express.json());

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  console.log(`apps/api listening on http://localhost:${port}`);
}

bootstrap();
