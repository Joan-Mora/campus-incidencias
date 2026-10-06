import { z } from 'zod';
import { CATEGORIES, RISK_LEVELS, ROLES, STATUSES } from './enums';

export const point3Schema = z.object({
  x: z.number().finite().min(-50).max(50),
  y: z.number().finite().min(-10).max(20),
  z: z.number().finite().min(-50).max(50),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo no válido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

export const devLoginSchema = z.object({ role: z.enum(ROLES) });

export const incidentDraftSchema = z.object({
  spaceId: z.string().uuid('Elige un espacio'),
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Elige una categoría' }) }),
  riskLevel: z.enum(RISK_LEVELS),
  description: z.string().trim().min(8, 'Describe el daño con al menos 8 caracteres').max(1000),
  hotspot: point3Schema.nullish(),
});

export const createIncidentSchema = incidentDraftSchema.extend({
  /** El estudiante decidió sumarse a un reporte existente en lugar de crear uno aislado. */
  joinIncidentId: z.string().uuid().nullish(),
});

export const previewIncidentSchema = incidentDraftSchema.partial({ description: true }).extend({
  description: z.string().max(1000).default(''),
});

export const transitionSchema = z.object({
  to: z.enum(STATUSES),
  note: z.string().trim().max(1000).nullish(),
  assigneeId: z.string().uuid().nullish(),
});

export const correctRiskSchema = z.object({
  riskLevel: z.enum(RISK_LEVELS),
  note: z.string().trim().max(500).nullish(),
});

export const suggestionDecisionSchema = z.object({ decision: z.enum(['accept', 'reject']) });

export const mergeSchema = z.object({ targetIncidentId: z.string().uuid() });

export const commentSchema = z.object({ text: z.string().trim().min(1).max(1000) });

export const incidentListQuerySchema = z.object({
  status: z.string().optional(),
  level: z.string().optional(),
  campusId: z.string().uuid().optional(),
  blockId: z.string().uuid().optional(),
  spaceId: z.string().uuid().optional(),
  mine: z.coerce.boolean().optional(),
  assignedToMe: z.coerce.boolean().optional(),
  overdue: z.coerce.boolean().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type IncidentDraft = z.infer<typeof incidentDraftSchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type PreviewIncidentInput = z.infer<typeof previewIncidentSchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;
export type IncidentListQuery = z.infer<typeof incidentListQuerySchema>;
