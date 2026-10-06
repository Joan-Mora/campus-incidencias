import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  AUTO_GROUP_THRESHOLD,
  SIMILARITY_WEIGHTS,
  SUGGEST_THRESHOLD,
  mergeSchema,
  suggestionDecisionSchema,
} from '@campus/shared';
import { parse } from '../../common/errors';
import { requireAuth, requireRole } from '../../common/middleware/auth';
import { embeddingsActive } from './embeddings';
import * as similarity from './similarity.service';

const idParams = z.object({ id: z.string().uuid() });

export async function similarityRoutes(app: FastifyInstance) {
  app.get('/config', { preHandler: requireAuth }, async () => ({
    weights: SIMILARITY_WEIGHTS,
    autoGroupThreshold: AUTO_GROUP_THRESHOLD,
    suggestThreshold: SUGGEST_THRESHOLD,
    embeddings: embeddingsActive(),
  }));

  app.get('/suggestions', { preHandler: requireRole('SUPERVISOR', 'TECHNICIAN') }, async () => similarity.listSuggestions());

  app.post('/suggestions/:id', { preHandler: requireRole('SUPERVISOR') }, async (request) => {
    const { id } = parse(idParams, request.params);
    const { decision } = parse(suggestionDecisionSchema, request.body);
    return similarity.decideSuggestion(id, decision, request.user.sub);
  });

  app.post('/incidents/:id/merge', { preHandler: requireRole('SUPERVISOR') }, async (request) => {
    const { id } = parse(idParams, request.params);
    const { targetIncidentId } = parse(mergeSchema, request.body);
    return similarity.groupInto(id, targetIncidentId, { actorId: request.user.sub, mode: 'manual' });
  });

  app.post('/incidents/:id/ungroup', { preHandler: requireRole('SUPERVISOR') }, async (request, reply) => {
    const { id } = parse(idParams, request.params);
    await similarity.ungroup(id, request.user.sub);
    return reply.status(204).send();
  });
}
