import type { IncidentStatus, PriorityLevel } from '../enums';

export const HOUR_MS = 3_600_000;

export const SLA_HOURS: Record<PriorityLevel, { response: number; resolution: number }> = {
  CRITICAL: { response: 1, resolution: 4 },
  HIGH: { response: 4, resolution: 24 },
  MEDIUM: { response: 12, resolution: 72 },
  LOW: { response: 48, resolution: 168 },
};

export const SLA_WARNING_FRACTION = 0.8;

export type SlaState = 'ok' | 'warning' | 'breach' | 'done';

/** `timeScale` acelera el reloj: con 60, una hora de SLA dura un minuto real. */
export function slaDurationMs(level: PriorityLevel, kind: 'response' | 'resolution', timeScale = 1): number {
  return (SLA_HOURS[level][kind] * HOUR_MS) / Math.max(1, timeScale);
}

export function computeDueDates(start: Date, level: PriorityLevel, timeScale = 1) {
  return {
    responseDueAt: new Date(start.getTime() + slaDurationMs(level, 'response', timeScale)),
    resolutionDueAt: new Date(start.getTime() + slaDurationMs(level, 'resolution', timeScale)),
  };
}

export function slaConsumed(now: Date, start: Date, due: Date): number {
  const total = due.getTime() - start.getTime();
  if (total <= 0) return 1;
  return Math.max(0, (now.getTime() - start.getTime()) / total);
}

export function slaState(now: Date, start: Date, due: Date, status: IncidentStatus): SlaState {
  if (status === 'RESOLVED' || status === 'VERIFIED') return 'done';
  const consumed = slaConsumed(now, start, due);
  if (consumed >= 1) return 'breach';
  if (consumed >= SLA_WARNING_FRACTION) return 'warning';
  return 'ok';
}

/** El SLA que corre depende de la etapa: respuesta mientras está Pendiente, resolución después. */
export function activeSlaKind(status: IncidentStatus): 'response' | 'resolution' | null {
  if (status === 'PENDING') return 'response';
  if (status === 'IN_PROGRESS') return 'resolution';
  return null;
}

export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const minutes = Math.floor(abs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} d ${hours % 24} h`;
  if (hours > 0) return `${hours} h ${minutes % 60} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${Math.floor(abs / 1000)} s`;
}
