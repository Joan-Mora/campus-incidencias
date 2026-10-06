import type { WebSocket } from 'ws';
import { formatIncidentCode, type RealtimeMessage, type Role } from '@campus/shared';
import { bus } from '../../common/events';
import { prisma } from '../../common/prisma';

interface Client {
  socket: WebSocket;
  userId: string;
  role: Role;
}

const clients = new Set<Client>();

export function addClient(client: Client) {
  clients.add(client);
  client.socket.on('close', () => clients.delete(client));
  client.socket.on('error', () => clients.delete(client));
  client.socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as { type?: string };
      if (message.type === 'ping') send(client, { type: 'pong', payload: {} });
    } catch {
      // Mensajes que no son JSON se ignoran.
    }
  });
  send(client, { type: 'hello', payload: { userId: client.userId } });
}

function send(client: Client, message: RealtimeMessage) {
  if (client.socket.readyState === client.socket.OPEN) client.socket.send(JSON.stringify(message));
}

export function broadcast(message: RealtimeMessage, filter?: (client: Client) => boolean) {
  for (const client of clients) if (!filter || filter(client)) send(client, message);
}

export function connectedCount() {
  return clients.size;
}

let dashboardTimer: NodeJS.Timeout | null = null;

/** Agrupa ráfagas de cambios en un solo aviso para no saturar a los clientes. */
export function scheduleDashboardRefresh() {
  if (dashboardTimer) return;
  dashboardTimer = setTimeout(() => {
    dashboardTimer = null;
    broadcast({ type: 'dashboard.changed', payload: {} });
  }, 600);
}

const staff = (client: Client) => client.role !== 'STUDENT';

async function codeAndLevel(incidentId: string) {
  const row = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { number: true, priorityLevel: true, reporterId: true },
  });
  return row ? { code: formatIncidentCode(row.number), level: row.priorityLevel, reporterId: row.reporterId } : null;
}

export function registerRealtimeListeners() {
  bus.on('IncidentCreated', async ({ incidentId }) => {
    const info = await codeAndLevel(incidentId);
    if (!info) return;
    broadcast({ type: 'incident.created', payload: { incidentId, code: info.code, level: info.level } });
    scheduleDashboardRefresh();
  });

  const updated = ({ incidentId }: { incidentId: string }) => {
    if (incidentId) broadcast({ type: 'incident.updated', payload: { incidentId } });
    scheduleDashboardRefresh();
  };
  bus.on('StatusChanged', updated);
  bus.on('PriorityChanged', updated);
  bus.on('IncidentGrouped', updated);
  bus.on('IncidentUngrouped', updated);
  bus.on('RiskCorrected', updated);
  bus.on('IncidentTouched', updated);
  bus.on('SlaPassCompleted', () => scheduleDashboardRefresh());

  bus.on('SlaBreached', async ({ incidentId, newLevel }) => {
    const info = await codeAndLevel(incidentId);
    if (!info) return;
    broadcast({ type: 'incident.escalated', payload: { incidentId, code: info.code, level: newLevel } });
    scheduleDashboardRefresh();
  });

  bus.on('SlaWarning', async ({ incidentId }) => {
    const info = await codeAndLevel(incidentId);
    if (!info) return;
    broadcast({ type: 'incident.warning', payload: { incidentId, code: info.code } }, staff);
  });

  bus.on('SuggestionCreated', ({ suggestionId }) => {
    broadcast({ type: 'suggestion.created', payload: { suggestionId } }, staff);
  });
}
