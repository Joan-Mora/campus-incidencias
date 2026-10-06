import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import { PRIORITY_LABELS, STATUS_LABELS, type IncidentStatus, type PriorityLevel, type Role } from '@campus/shared';
import { haptic } from '../core/device/viewMode';
import { useRealtimeListener } from '../core/realtime/realtime';
import { useIncidents } from '../features/incidents/api';

export type AlertKind = 'status' | 'created' | 'escalated' | 'warning';

export interface MobileAlert {
  id: string;
  kind: AlertKind;
  incidentId: string;
  title: string;
  body: string;
  level?: PriorityLevel;
  status?: IncidentStatus;
  at: number;
  read: boolean;
}

interface AlertsState {
  items: MobileAlert[];
  push: (alert: Omit<MobileAlert, 'id' | 'at' | 'read'>) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useAlerts = create<AlertsState>()(
  persist(
    (set) => ({
      items: [],
      push: (alert) => set((state) => ({ items: [{ ...alert, id: crypto.randomUUID(), at: Date.now(), read: false }, ...state.items].slice(0, 60) })),
      markAllRead: () => set((state) => ({ items: state.items.map((item) => ({ ...item, read: true })) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'campus-alerts' },
  ),
);

export const useUnreadAlerts = () => useAlerts((state) => state.items.filter((item) => !item.read).length);

const STATUS_COPY: Partial<Record<IncidentStatus, string>> = {
  IN_PROGRESS: 'Un técnico ya lo está atendiendo.',
  RESOLVED: 'El técnico lo marcó como resuelto. Confirma si quedó bien.',
  VERIFIED: 'Quedó verificado. Gracias por reportar.',
};

/**
 * Genera avisos: cambios de estado en mis reportes (comparando con el último valor visto)
 * y, para personal, casos nuevos, escalados y por vencer que llegan por WebSocket.
 */
export function useAlertWatcher(role: Role) {
  const push = useAlerts((state) => state.push);
  const mine = useIncidents({ mine: true, limit: 100 });
  const seen = useRef<Map<string, IncidentStatus> | null>(null);

  useEffect(() => {
    if (!mine.data) return;
    if (!seen.current) {
      seen.current = new Map(mine.data.map((incident) => [incident.id, incident.status]));
      return;
    }
    for (const incident of mine.data) {
      const before = seen.current.get(incident.id);
      if (before && before !== incident.status) {
        const body = STATUS_COPY[incident.status] ?? `Ahora está en ${STATUS_LABELS[incident.status]}.`;
        push({ kind: 'status', incidentId: incident.id, title: `${incident.code}: ${STATUS_LABELS[incident.status]}`, body, status: incident.status });
        toast(`${incident.code}: ${STATUS_LABELS[incident.status]}`, { description: body });
        haptic([10, 50, 10]);
      }
      seen.current.set(incident.id, incident.status);
    }
  }, [mine.data, push]);

  useRealtimeListener(
    (message) => {
      if (role === 'STUDENT') return;
      if (message.type === 'incident.created') {
        push({ kind: 'created', incidentId: message.payload.incidentId, title: `Nuevo caso ${message.payload.code}`, body: `Prioridad ${PRIORITY_LABELS[message.payload.level].toLowerCase()}`, level: message.payload.level });
      } else if (message.type === 'incident.escalated') {
        push({ kind: 'escalated', incidentId: message.payload.incidentId, title: `${message.payload.code} venció su SLA`, body: `Escaló a prioridad ${PRIORITY_LABELS[message.payload.level].toLowerCase()}`, level: message.payload.level });
        haptic([20, 60, 20, 60, 20]);
      } else if (message.type === 'incident.warning') {
        push({ kind: 'warning', incidentId: message.payload.incidentId, title: `${message.payload.code} está por vencer`, body: 'Ya consumió el 80 % de su plazo', level: 'HIGH' });
      }
    },
    [role, push],
  );
}
