import { useEffect, useState } from 'react';
import { activeSlaKind, slaConsumed, slaState, type IncidentDTO, type SlaState } from '@campus/shared';

/** Reloj compartido que avanza cada `intervalMs` para anillos y cuentas regresivas. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export interface SlaSnapshot {
  kind: 'response' | 'resolution' | null;
  state: SlaState;
  consumed: number;
  remainingMs: number;
  dueAt: Date | null;
}

export function slaSnapshot(incident: Pick<IncidentDTO, 'status' | 'createdAt' | 'responseDueAt' | 'resolutionDueAt'>, now: Date): SlaSnapshot {
  const kind = activeSlaKind(incident.status);
  if (!kind) return { kind, state: 'done', consumed: 0, remainingMs: 0, dueAt: null };
  const start = new Date(incident.createdAt);
  const due = new Date(kind === 'response' ? incident.responseDueAt : incident.resolutionDueAt);
  return {
    kind,
    state: slaState(now, start, due, incident.status),
    consumed: slaConsumed(now, start, due),
    remainingMs: due.getTime() - now.getTime(),
    dueAt: due,
  };
}

export const SLA_STATE_COLOR: Record<SlaState, string> = {
  ok: 'var(--level-low)',
  warning: 'var(--level-high)',
  breach: 'var(--level-critical)',
  done: 'var(--text-faint)',
};

export const SLA_KIND_LABEL = { response: 'Respuesta', resolution: 'Resolución' } as const;
