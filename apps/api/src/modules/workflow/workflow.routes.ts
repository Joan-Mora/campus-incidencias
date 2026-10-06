import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TRANSITION_RULES, transitionSchema } from '@campus/shared';
import { parse } from '../../common/errors';
import { actorOf, requireAuth } from '../../common/middleware/auth';
import * as workflow from './workflow.service';

export async function workflowRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/workflow/rules', async () => TRANSITION_RULES);

  app.post('/incidents/:id/transition', async (request) => {
    const { id } = parse(z.object({ id: z.string().uuid() }), request.params);
    return workflow.transition(id, actorOf(request), parse(transitionSchema, request.body));
  });
}
