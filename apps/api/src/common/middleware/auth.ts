import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@campus/shared';
import { forbidden, unauthorized } from '../errors';

export interface AuthUser {
  sub: string;
  role: Role;
  name: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    throw unauthorized('Tu sesión expiró, vuelve a iniciar sesión');
  }
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);
    if (!roles.includes(request.user.role)) throw forbidden();
  };
}

export function actorOf(request: FastifyRequest) {
  return { id: request.user.sub, role: request.user.role, name: request.user.name };
}
