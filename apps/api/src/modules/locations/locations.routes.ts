import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../common/middleware/auth';
import * as locations from './locations.service';

export async function locationsRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async () => locations.getCampusTree());

  app.get<{ Params: { token: string } }>('/qr/:token', { preHandler: requireAuth }, async (request) =>
    locations.findSpaceByQr(request.params.token),
  );
}
