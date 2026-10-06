export const ROLES = ['STUDENT', 'TECHNICIAN', 'SUPERVISOR'] as const;
export type Role = (typeof ROLES)[number];

export const SPACE_TYPES = ['CLASSROOM', 'LAB', 'BATHROOM', 'COMMON', 'OFFICE'] as const;
export type SpaceType = (typeof SPACE_TYPES)[number];

export const CATEGORIES = [
  'ELECTRICAL',
  'LIGHTING',
  'WATER_LEAK',
  'STRUCTURAL',
  'SANITARY',
  'FURNITURE',
  'COSMETIC',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const RISK_LEVELS = ['NONE', 'LOW', 'MEDIUM', 'HIGH'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const STATUSES = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED'] as const;
export type IncidentStatus = (typeof STATUSES)[number];

export const PRIORITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export const HISTORY_REASONS = ['MANUAL', 'AUTO_ESCALATION', 'CLUSTER_PROPAGATION'] as const;
export type HistoryReason = (typeof HISTORY_REASONS)[number];

export const EVENT_TYPES = [
  'CREATED',
  'PRIORITY_CHANGED',
  'GROUPED',
  'UNGROUPED',
  'ASSIGNED',
  'SLA_WARNING',
  'SLA_BREACHED',
  'COMMENT',
  'RISK_CORRECTED',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const OPEN_STATUSES: IncidentStatus[] = ['PENDING', 'IN_PROGRESS'];

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: 'Estudiante',
  TECHNICIAN: 'Técnico',
  SUPERVISOR: 'Supervisor',
};

export const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  CLASSROOM: 'Aula',
  LAB: 'Laboratorio',
  BATHROOM: 'Baño',
  COMMON: 'Zona común',
  OFFICE: 'Oficina',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  ELECTRICAL: 'Eléctrico',
  LIGHTING: 'Iluminación',
  WATER_LEAK: 'Fuga de agua',
  STRUCTURAL: 'Estructural',
  SANITARY: 'Sanitario',
  FURNITURE: 'Mobiliario',
  COSMETIC: 'Estético',
};

export const CATEGORY_HINTS: Record<Category, string> = {
  ELECTRICAL: 'Tomas, cables, tableros',
  LIGHTING: 'Luminarias y bombillos',
  WATER_LEAK: 'Goteras, tuberías, filtraciones',
  STRUCTURAL: 'Muros, techos, pisos, puertas',
  SANITARY: 'Inodoros, lavamanos, desagües',
  FURNITURE: 'Sillas, mesas, tableros',
  COSMETIC: 'Pintura, rayones, manchas',
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  NONE: 'Ninguno',
  LOW: 'Bajo',
  MEDIUM: 'Medio',
  HIGH: 'Alto',
};

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En proceso',
  RESOLVED: 'Resuelto',
  VERIFIED: 'Verificado',
};

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const HISTORY_REASON_LABELS: Record<HistoryReason, string> = {
  MANUAL: 'Cambio manual',
  AUTO_ESCALATION: 'Escalamiento automático',
  CLUSTER_PROPAGATION: 'Propagado desde el grupo',
};

export function formatIncidentCode(number: number): string {
  return `INC-${String(number).padStart(5, '0')}`;
}
