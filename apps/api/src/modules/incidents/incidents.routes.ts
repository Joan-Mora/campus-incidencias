import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  commentSchema,
  correctRiskSchema,
  createIncidentSchema,
  incidentListQuerySchema,
  previewIncidentSchema,
} from '@campus/shared';
import { badRequest, parse } from '../../common/errors';
import { actorOf, requireAuth, requireRole } from '../../common/middleware/auth';
import * as incidents from './incidents.service';

const idParams = z.object({ id: z.string().uuid('Identificador no válido') });

export async function incidentsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request) => incidents.list(parse(incidentListQuerySchema, request.query), actorOf(request)));

  app.post('/preview', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (request) =>
    incidents.preview(parse(previewIncidentSchema, request.body)),
  );

  app.post('/', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const created = await incidents.create(parse(createIncidentSchema, request.body), actorOf(request));
    return reply.status(201).send(created);
  });

  app.get('/:id', async (request) => incidents.getDetail(parse(idParams, request.params).id, actorOf(request)));

  app.post('/:id/evidence', async (request, reply) => {
    const { id } = parse(idParams, request.params);
    const { stage } = parse(z.object({ stage: z.enum(['REPORT', 'FIX']).default('REPORT') }), request.query);
    const file = await request.file();
    if (!file) throw badRequest('Adjunta una imagen', 'file');
    const buffer = await file.toBuffer();
    const evidence = await incidents.addPhoto(id, actorOf(request), { buffer, mime: file.mimetype }, stage);
    return reply.status(201).send(evidence);
  });

  app.post('/:id/comments', async (request, reply) => {
    const { id } = parse(idParams, request.params);
    const { text } = parse(commentSchema, request.body);
    await incidents.comment(id, actorOf(request), text);
    return reply.status(204).send();
  });

  app.patch('/:id/risk', { preHandler: requireRole('SUPERVISOR') }, async (request, reply) => {
    const { id } = parse(idParams, request.params);
    const { riskLevel, note } = parse(correctRiskSchema, request.body);
    await incidents.correctRisk(id, actorOf(request), riskLevel, note);
    return reply.status(204).send();
  });
}

export async function mediaRoutes(app: FastifyInstance) {
  app.get('/evidence/:id', async (request, reply) => {
    const { id } = parse(idParams, request.params);
    const file = await incidents.getEvidenceFile(id);
    return reply.header('Cache-Control', 'private, max-age=86400').type(file.mime).send(file.data);
  });
}
