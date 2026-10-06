import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError, type ZodTypeAny, type z } from 'zod';

/** Error de dominio con el contrato `{ error, field? }` que ve el usuario. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly field?: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, field?: string) => new AppError(400, message, field);
export const unauthorized = (message = 'Inicia sesión para continuar') => new AppError(401, message);
export const forbidden = (message = 'No tienes permiso para esta acción') => new AppError(403, message);
export const notFound = (message = 'No encontrado') => new AppError(404, message);
export const conflict = (message: string) => new AppError(409, message);

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw fromZod(result.error);
  return result.data;
}

function fromZod(error: ZodError): AppError {
  const issue = error.issues[0];
  const field = issue?.path.join('.') || undefined;
  return new AppError(400, issue?.message ?? 'Datos inválidos', field);
}

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ error: error.message, field: error.field });
  }
  if (error instanceof ZodError) {
    const appError = fromZod(error);
    return reply.status(400).send({ error: appError.message, field: appError.field });
  }
  const fastifyError = error as FastifyError;
  if (fastifyError.code === 'FST_REQ_FILE_TOO_LARGE') {
    return reply.status(413).send({ error: 'La imagen supera el tamaño máximo de 5 MB', field: 'file' });
  }
  if (fastifyError.statusCode === 429) {
    return reply.status(429).send({ error: 'Demasiadas solicitudes, intenta en un momento' });
  }
  if (fastifyError.validation || fastifyError.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE' || fastifyError.statusCode === 400) {
    return reply.status(400).send({ error: 'Solicitud inválida' });
  }
  request.log.error({ err: error }, 'Error no controlado');
  return reply.status(500).send({ error: 'Ocurrió un error inesperado' });
}
