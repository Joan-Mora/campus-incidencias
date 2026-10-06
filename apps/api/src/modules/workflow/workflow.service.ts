import type { Prisma } from '@prisma/client';
import {
  canActorTransition,
  checkTransition,
  formatIncidentCode,
  slaDurationMs,
  type HistoryReason,
  type IncidentStatus,
  type StatusHistoryDTO,
  type TransitionActor,
  type TransitionInput,
} from '@campus/shared';
import { bus } from '../../common/events';
import { env } from '../../common/env';
import { prisma } from '../../common/prisma';
import { badRequest, forbidden } from '../../common/errors';
import * as repo from '../incidents/incidents.repository';

/** StatusHistory pertenece a este módulo; el SLA registra sus escalamientos por aquí. */
export async function recordHistory(
  tx: Prisma.TransactionClient,
  entry: {
    incidentId: string;
    fromStatus: IncidentStatus | null;
    toStatus: IncidentStatus;
    changedById: string | null;
    reason: HistoryReason;
    note?: string | null;
    at?: Date;
  },
) {
  const at = entry.at ?? new Date();
  const previous = await tx.statusHistory.findFirst({
    where: { incidentId: entry.incidentId },
    orderBy: { changedAt: 'desc' },
    select: { changedAt: true },
  });
  return tx.statusHistory.create({
    data: {
      incidentId: entry.incidentId,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      changedById: entry.changedById,
      reason: entry.reason,
      note: entry.note ?? null,
      changedAt: at,
      durationInPrevMs: previous ? at.getTime() - previous.changedAt.getTime() : null,
    },
  });
}

export async function getHistory(incidentId: string): Promise<StatusHistoryDTO[]> {
  const rows = await prisma.statusHistory.findMany({
    where: { incidentId },
    orderBy: { changedAt: 'asc' },
    include: { changedBy: { select: { id: true, name: true, role: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    changedBy: row.changedBy,
    changedAt: row.changedAt.toISOString(),
    durationInPrevMs: row.durationInPrevMs,
    reason: row.reason,
    note: row.note,
  }));
}

function stageFields(to: IncidentStatus, from: IncidentStatus, current: { firstResponseAt: Date | null; priorityLevel: Parameters<typeof slaDurationMs>[0] }, now: Date) {
  const data: Prisma.IncidentUncheckedUpdateManyInput = { status: to, stageStartedAt: now, slaWarnedAt: null };
  if (to === 'IN_PROGRESS' && from === 'PENDING' && !current.firstResponseAt) data.firstResponseAt = now;
  if (to === 'RESOLVED') data.resolvedAt = now;
  if (to === 'VERIFIED') data.verifiedAt = now;
  if (to === 'IN_PROGRESS' && from === 'RESOLVED') {
    data.resolvedAt = null;
    data.resolutionDueAt = new Date(now.getTime() + slaDurationMs(current.priorityLevel, 'resolution', env.SLA_TIME_SCALE));
  }
  return data;
}

export async function transition(incidentId: string, actor: TransitionActor, input: TransitionInput) {
  const incident = await repo.findIncident(incidentId);
  if (!incident.isClusterPrimary) {
    const primary = await repo.findIncident(incident.cluster!.primaryIncidentId);
    throw badRequest(`Este reporte está agrupado: el estado se cambia en la incidencia madre ${formatIncidentCode(primary.number)}`);
  }

  const subject = { status: incident.status, reporterId: incident.reporterId, assigneeId: incident.assigneeId };
  const roleCheck = canActorTransition(actor, subject, input.to);
  if (!roleCheck.ok) throw forbidden(roleCheck.reason);
  const hasFix = input.to === 'RESOLVED' ? await repo.hasFixEvidence(incident.id) : false;
  const check = checkTransition(actor, subject, input.to, { note: input.note, hasFixEvidence: hasFix });
  if (!check.ok) throw badRequest(check.reason, check.reason.includes('nota') ? 'note' : undefined);

  let assigneeId = incident.assigneeId;
  if (incident.status === 'PENDING' && input.to === 'IN_PROGRESS') {
    if (actor.role === 'TECHNICIAN') assigneeId = actor.id;
    else {
      if (!input.assigneeId) throw badRequest('Elige el técnico al que asignas el caso', 'assigneeId');
      const technician = await prisma.user.findFirst({ where: { id: input.assigneeId, role: 'TECHNICIAN' } });
      if (!technician) throw badRequest('El usuario elegido no es técnico', 'assigneeId');
      assigneeId = technician.id;
    }
  }

  const now = new Date();
  const from = incident.status;
  const to = input.to;
  const memberIds = incident.clusterId ? await repo.clusterMemberIds(incident.clusterId, incident.id) : [];
  const fields = { ...stageFields(to, from, incident, now), assigneeId };

  await prisma.$transaction(async (tx) => {
    await repo.updateIncident(incident.id, fields, tx);
    await recordHistory(tx, { incidentId: incident.id, fromStatus: from, toStatus: to, changedById: actor.id, reason: 'MANUAL', note: input.note, at: now });
    if (to === 'RESOLVED' && input.note?.trim()) await repo.addTextEvidence(incident.id, 'FIX', input.note.trim(), tx);
    if (assigneeId && assigneeId !== incident.assigneeId) {
      await repo.logEvent(incident.id, 'ASSIGNED', { assigneeId, by: actor.id }, actor.id, tx);
    }
    for (const memberId of memberIds) {
      const member = await tx.incident.findUniqueOrThrow({ where: { id: memberId }, select: { status: true, firstResponseAt: true, priorityLevel: true } });
      if (member.status === to) continue;
      await repo.updateIncident(memberId, { ...stageFields(to, member.status, member, now), assigneeId }, tx);
      await recordHistory(tx, { incidentId: memberId, fromStatus: member.status, toStatus: to, changedById: actor.id, reason: 'CLUSTER_PROPAGATION', at: now });
    }
  });

  bus.emit('StatusChanged', { incidentId: incident.id, from, to, actorId: actor.id });
  return { incidentId: incident.id, from, to };
}

/** Una hija recién agrupada adopta el estado y el técnico de la madre. */
export async function syncMemberToPrimary(memberId: string) {
  const member = await prisma.incident.findUnique({ where: { id: memberId }, include: { cluster: true } });
  if (!member?.cluster || member.isClusterPrimary) return;
  const primary = await prisma.incident.findUnique({ where: { id: member.cluster.primaryIncidentId } });
  if (!primary) return;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const members = await tx.incident.findMany({ where: { clusterId: member.cluster!.id, isClusterPrimary: false } });
    for (const row of members) {
      const data: Prisma.IncidentUncheckedUpdateInput = {
        assigneeId: primary.assigneeId,
        escalationSteps: primary.escalationSteps,
        isOverdue: primary.isOverdue,
        responseDueAt: primary.responseDueAt,
        resolutionDueAt: primary.resolutionDueAt,
        firstResponseAt: primary.firstResponseAt,
        resolvedAt: primary.resolvedAt,
        verifiedAt: primary.verifiedAt,
      };
      if (row.status !== primary.status) {
        data.status = primary.status;
        data.stageStartedAt = now;
        await recordHistory(tx, { incidentId: row.id, fromStatus: row.status, toStatus: primary.status, changedById: null, reason: 'CLUSTER_PROPAGATION', at: now });
      }
      await repo.updateIncident(row.id, data, tx);
    }
  });
}

export function registerWorkflowListeners() {
  bus.on('IncidentGrouped', ({ incidentId }) => syncMemberToPrimary(incidentId));
}
