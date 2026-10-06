import type { IncidentStatus, Role } from '../enums';

export type TransitionRequirement = 'note' | 'fixEvidence';

export interface TransitionRule {
  from: IncidentStatus;
  to: IncidentStatus;
  roles: Role[];
  /** Restricción sobre la relación del actor con la incidencia. */
  condition?: 'isAssigneeNotReporter' | 'reporterIfStudent';
  requires?: TransitionRequirement[];
  label: string;
  description: string;
}

export const TRANSITION_RULES: TransitionRule[] = [
  {
    from: 'PENDING',
    to: 'IN_PROGRESS',
    roles: ['TECHNICIAN', 'SUPERVISOR'],
    label: 'Tomar caso',
    description: 'El técnico toma el caso o el supervisor lo asigna',
  },
  {
    from: 'IN_PROGRESS',
    to: 'RESOLVED',
    roles: ['TECHNICIAN'],
    condition: 'isAssigneeNotReporter',
    requires: ['fixEvidence'],
    label: 'Marcar resuelto',
    description: 'Solo el técnico asignado, con evidencia del arreglo',
  },
  {
    from: 'RESOLVED',
    to: 'VERIFIED',
    roles: ['SUPERVISOR', 'STUDENT'],
    condition: 'reporterIfStudent',
    label: 'Verificar',
    description: 'El supervisor o el estudiante que reportó confirman el arreglo',
  },
  {
    from: 'RESOLVED',
    to: 'IN_PROGRESS',
    roles: ['SUPERVISOR', 'STUDENT'],
    condition: 'reporterIfStudent',
    requires: ['note'],
    label: 'Reabrir',
    description: 'El arreglo no funcionó; se reabre con una nota',
  },
];

export interface TransitionActor {
  id: string;
  role: Role;
}

export interface TransitionSubject {
  status: IncidentStatus;
  reporterId: string;
  assigneeId: string | null;
}

export interface TransitionPayload {
  note?: string | null;
  hasFixEvidence?: boolean;
}

export type TransitionCheck = { ok: true; rule: TransitionRule } | { ok: false; reason: string };

export function findRule(from: IncidentStatus, to: IncidentStatus): TransitionRule | undefined {
  return TRANSITION_RULES.find((rule) => rule.from === from && rule.to === to);
}

function conditionHolds(rule: TransitionRule, actor: TransitionActor, subject: TransitionSubject): string | null {
  if (rule.condition === 'isAssigneeNotReporter') {
    if (actor.id === subject.reporterId) return 'Nadie puede resolver un reporte propio';
    if (subject.assigneeId !== actor.id) return 'Solo el técnico asignado puede resolverlo';
  }
  if (rule.condition === 'reporterIfStudent' && actor.role === 'STUDENT' && actor.id !== subject.reporterId) {
    return 'Un estudiante solo puede actuar sobre sus propios reportes';
  }
  return null;
}

/** Verifica rol y relación con la incidencia, sin mirar los datos adjuntos. */
export function canActorTransition(
  actor: TransitionActor,
  subject: TransitionSubject,
  to: IncidentStatus,
): TransitionCheck {
  const rule = findRule(subject.status, to);
  if (!rule) return { ok: false, reason: 'Esa transición no existe en el flujo' };
  if (!rule.roles.includes(actor.role)) return { ok: false, reason: 'Tu rol no puede ejecutar esta transición' };
  const conditionError = conditionHolds(rule, actor, subject);
  if (conditionError) return { ok: false, reason: conditionError };
  return { ok: true, rule };
}

export function checkTransition(
  actor: TransitionActor,
  subject: TransitionSubject,
  to: IncidentStatus,
  payload: TransitionPayload = {},
): TransitionCheck {
  const check = canActorTransition(actor, subject, to);
  if (!check.ok) return check;
  const requires = check.rule.requires ?? [];
  if (requires.includes('note') && !payload.note?.trim()) {
    return { ok: false, reason: 'Esta transición necesita una nota' };
  }
  if (requires.includes('fixEvidence') && !payload.hasFixEvidence && !payload.note?.trim()) {
    return { ok: false, reason: 'Adjunta una foto o una nota del arreglo' };
  }
  return check;
}

export function availableTransitions(actor: TransitionActor, subject: TransitionSubject): TransitionRule[] {
  return TRANSITION_RULES.filter(
    (rule) => rule.from === subject.status && canActorTransition(actor, subject, rule.to).ok,
  );
}

export const STATUS_FLOW: IncidentStatus[] = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED'];
