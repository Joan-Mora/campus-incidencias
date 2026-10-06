import { existsSync, mkdirSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import Fastify, { LogController } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { env, REPO_ROOT } from './common/env';
import { errorHandler } from './common/errors';
import { bus } from './common/events';
import { prisma } from './common/prisma';
import { MAX_UPLOAD_BYTES } from './modules/media/media.service';
import { identityRoutes } from './modules/identity/identity.routes';
import { locationsRoutes } from './modules/locations/locations.routes';
import { incidentsRoutes, mediaRoutes } from './modules/incidents/incidents.routes';
import { workflowRoutes } from './modules/workflow/workflow.routes';
import { similarityRoutes } from './modules/similarity/similarity.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { realtimeRoutes } from './modules/realtime/realtime.routes';
import { connectedCount, registerRealtimeListeners } from './modules/realtime/realtime.service';
import { registerPriorityListeners } from './modules/prioritization/prioritization.service';
import { registerSimilarityListeners } from './modules/similarity/similarity.service';
import { registerWorkflowListeners } from './modules/workflow/workflow.service';
import { startSlaJob } from './modules/sla/sla.job';

const LAN_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
const WEB_DIST = resolve(REPO_ROOT, 'apps/web/dist');

/** IPv4 de la red local, para que el modo proyector muestre un QR que el celular pueda abrir. */
function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => item!.address);
}

async function buildServer() {
  const app = Fastify({
    trustProxy: true,
    bodyLimit: 64 * 1024,
    logger: env.isProduction
      ? { level: 'info', redact: ['req.headers.authorization'] }
      : { level: 'info', redact: ['req.headers.authorization'], transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname,reqId,req,res,responseTime' } } },
    logController: new LogController({ disableRequestLogging: !env.isProduction }),
  });
  bus.setLogger(app.log);

  await app.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:', 'blob:', 'data:'],
        workerSrc: ["'self'", 'blob:'],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  });

  await app.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || env.corsOrigins.includes(origin) || (!env.isProduction && LAN_ORIGIN.test(origin))) {
        callback(null, true);
        return;
      }
      callback(new Error('Origen no permitido'), false);
    },
  });

  await app.register(rateLimit, { global: true, max: 600, timeWindow: '1 minute' });
  await app.register(jwt, { secret: env.JWT_SECRET });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 4 } });
  await app.register(websocket, { options: { maxPayload: 4096 } });

  if (env.STORAGE_DRIVER === 'local') {
    mkdirSync(env.uploadDir, { recursive: true });
    await app.register(fastifyStatic, { root: env.uploadDir, prefix: '/uploads/', decorateReply: false, maxAge: '7d' });
  }

  app.setErrorHandler(errorHandler);

  registerPriorityListeners();
  registerSimilarityListeners();
  registerWorkflowListeners();
  registerRealtimeListeners();

  app.get('/api/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', realtimeClients: connectedCount(), slaTimeScale: env.SLA_TIME_SCALE, lanAddresses: env.isProduction ? [] : lanAddresses() };
  });

  await app.register(identityRoutes, { prefix: '/api/auth' });
  await app.register(locationsRoutes, { prefix: '/api/locations' });
  await app.register(incidentsRoutes, { prefix: '/api/incidents' });
  await app.register(mediaRoutes, { prefix: '/api/media' });
  await app.register(workflowRoutes, { prefix: '/api' });
  await app.register(similarityRoutes, { prefix: '/api/similarity' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await app.register(realtimeRoutes);

  const serveWeb = existsSync(resolve(WEB_DIST, 'index.html'));
  if (serveWeb) {
    await app.register(fastifyStatic, { root: WEB_DIST, prefix: '/', wildcard: false });
  }

  app.setNotFoundHandler((request, reply) => {
    const isApi = request.url.startsWith('/api') || request.url.startsWith('/ws') || request.url.startsWith('/uploads');
    if (serveWeb && !isApi && request.method === 'GET') return reply.sendFile('index.html');
    return reply.status(404).send({ error: 'Recurso no encontrado' });
  });

  return app;
}

const app = await buildServer();
const slaTask = startSlaJob(app.log);

const shutdown = async (signal: string) => {
  app.log.info(`${signal} recibido, cerrando...`);
  slaTask.stop();
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ host: '0.0.0.0', port: env.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
