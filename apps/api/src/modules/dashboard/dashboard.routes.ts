import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../../common/errors';
import { requireAuth } from '../../common/middleware/auth';
import * as dashboard from './dashboard.service';

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/summary', async () => dashboard.summary());
  app.get('/overdue', async () => dashboard.overdue());
  app.get('/resolution-time', async () => dashboard.resolutionTime());
  app.get('/top-spaces', async () => dashboard.topSpaces());
  app.get('/sla-compliance', async () => dashboard.slaCompliance());
  app.get('/heatmap', async () => dashboard.heatmap());
  app.get('/timeline', async (request) => {
    const { days } = parse(z.object({ days: z.coerce.number().int().min(1).max(60).default(14) }), request.query);
    return dashboard.timeline(days);
  });
  app.get('/snapshot', async (request) => {
    const { at } = parse(z.object({ at: z.coerce.date().default(() => new Date()) }), request.query);
    return dashboard.snapshot(at);
  });
}
