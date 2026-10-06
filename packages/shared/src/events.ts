import type { IncidentStatus, PriorityLevel } from './enums';

/** Contratos del bus de eventos interno del monolito. */
export interface DomainEvents {
  IncidentCreated: { incidentId: string; joinIncidentId?: string | null };
  IncidentGrouped: { incidentId: string; clusterId: string; score: number | null };
  IncidentUngrouped: { incidentId: string; clusterId: string; previousPrimaryId: string };
  StatusChanged: {
    incidentId: string;
    from: IncidentStatus;
    to: IncidentStatus;
    actorId: string | null;
  };
  SlaWarning: { incidentId: string; kind: 'response' | 'resolution' };
  SlaBreached: { incidentId: string; kind: 'response' | 'resolution'; newLevel: PriorityLevel };
  PriorityChanged: { incidentId: string; from: PriorityLevel; to: PriorityLevel; score: number };
  RiskCorrected: { incidentId: string };
  SuggestionCreated: { suggestionId: string; incidentId: string };
  /** Cambio menor (evidencia, comentario) que solo requiere refrescar vistas. */
  IncidentTouched: { incidentId: string };
  /** La pasada de SLA cambió puntajes, avisos o niveles. */
  SlaPassCompleted: { breaches: number; warned: number; recomputed: number };
}

export type DomainEventName = keyof DomainEvents;

/** Mensajes que el servidor envía por WebSocket. */
export type RealtimeMessage =
  | { type: 'hello'; payload: { userId: string } }
  | { type: 'incident.created'; payload: { incidentId: string; code: string; level: PriorityLevel } }
  | { type: 'incident.updated'; payload: { incidentId: string } }
  | { type: 'incident.escalated'; payload: { incidentId: string; code: string; level: PriorityLevel } }
  | { type: 'incident.warning'; payload: { incidentId: string; code: string } }
  | { type: 'suggestion.created'; payload: { suggestionId: string } }
  | { type: 'dashboard.changed'; payload: Record<string, never> }
  | { type: 'pong'; payload: Record<string, never> };

export type RealtimeMessageType = RealtimeMessage['type'];
