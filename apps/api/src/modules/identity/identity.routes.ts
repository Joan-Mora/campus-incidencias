import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { devLoginSchema, loginSchema, type UserDTO } from '@campus/shared';
import { parse } from '../../common/errors';
import { requireAuth, requireRole } from '../../common/middleware/auth';
import { env } from '../../common/env';
import * as identity from './identity.service';

export async function identityRoutes(app: FastifyInstance) {
  const sign = (user: UserDTO) => app.jwt.sign({ sub: user.id, role: user.role, name: user.name }, { expiresIn: '8h' });

  app.post('/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request) => {
    const { email, password } = parse(loginSchema, request.body);
    const user = await identity.login(email, password);
    return { token: sign(user), user };
  });

  app.post('/dev-login', async (request) => {
    const { role } = parse(devLoginSchema, request.body);
    const { userId } = parse(z.object({ userId: z.string().uuid().optional() }), request.body);
    const user = await identity.devLogin(role, userId);
    return { token: sign(user), user };
  });

  app.get('/dev-users', async () => ({ enabled: env.ALLOW_DEV_LOGIN, users: await identity.listDemoUsers() }));

  app.get('/me', { preHandler: requireAuth }, async (request) => ({ user: await identity.getUser(request.user.sub) }));

  app.get('/technicians', { preHandler: requireRole('SUPERVISOR', 'TECHNICIAN') }, async () => identity.listTechnicians());
}
