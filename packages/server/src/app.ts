import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { Config } from './config.js';
import { widgetRoutes } from './routes/widget.js';
import { analyticsRoutes } from './routes/analytics.js';
import { exportRoutes } from './routes/export.js';
import { authRoutes } from './routes/auth.js';
import { settingsRoutes } from './routes/settings.js';

export async function buildApp(config: Config): Promise<FastifyInstance> {
  const app = Fastify({ logger: true, trustProxy: true });

  await app.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-NPS-Write-Key', 'Authorization'],
  });

  // Protect the public write path from abuse. Keyed by IP + write key.
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    keyGenerator: (req: FastifyRequest) =>
      `${req.ip}:${(req.headers['x-nps-write-key'] as string) ?? 'anon'}`,
  });

  app.get('/health', async () => ({ ok: true }));

  await app.register(async (instance) => authRoutes(instance, config));
  await app.register(async (instance) => settingsRoutes(instance, config));
  await app.register(async (instance) => widgetRoutes(instance, config));
  await app.register(async (instance) => analyticsRoutes(instance, config));
  await app.register(async (instance) => exportRoutes(instance, config));

  return app;
}
