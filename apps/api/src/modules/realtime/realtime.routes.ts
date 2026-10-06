import type { FastifyInstance } from 'fastify';
import type { AuthUser } from '../../common/middleware/auth';
import { addClient } from './realtime.service';

/** El navegador no puede mandar cabeceras en un WebSocket, así que el JWT viaja en la query. */
export async function realtimeRoutes(app: FastifyInstance) {
  app.get('/ws', { websocket: true }, (socket, request) => {
    const token = (request.query as { token?: string }).token;
    let user: AuthUser;
    try {
      user = app.jwt.verify<AuthUser>(token ?? '');
    } catch {
      socket.close(4401, 'No autorizado');
      return;
    }
    addClient({ socket, userId: user.sub, role: user.role });
  });
}
