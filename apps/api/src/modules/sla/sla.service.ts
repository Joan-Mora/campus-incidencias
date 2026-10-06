import {
  SLA_WARNING_FRACTION,
  activeSlaKind,
  effectiveLevel,
  levelFromScore,
  slaDurationMs,
  type PriorityLevel,
} from '@campus/shared';
import type { Prisma } from '@prisma/client';
import { bus } from '../../common/events';
import { env } from '../../common/env';
import { prisma } from '../../common/prisma';
import * as repo from '../incidents/incidents.repository';
import { recordHistory } from '../workflow/workflow.service';
import { recomputeOpen } from '../prioritization/prioritization.service';

interface Breach {
  incidentId: string;
  kind: 'response' | 'resolution';
  newLevel: PriorityLevel;
}

/**
 * Escala lo vencido. `FOR UPDATE SKIP LOCKED` permite correr varias réplicas del API:
 * cada fila la toma una sola transacción y las demás la saltan.
 * Un caso que ya es crítico y ya está marcado como vencido no tiene a dónde subir, así que se excluye:
 * sin esto el contador de escalamientos crecería en cada ventana de SLA sin aportar información.
 */
export async function escalateBreached(now = new Date()): Promise<Breach[]> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Incident"
      WHERE "isClusterPrimary" = true
        AND NOT ("isOverdue" = true AND "priorityLevel" = 'CRITICAL')
        AND (
          (status = 'PENDING' AND "responseDueAt" < ${now})
          OR (status IN ('PENDING', 'IN_PROGRESS') AND "resolutionDueAt" < ${now})
        )
      ORDER BY "resolutionDueAt" ASC
      LIMIT 100
      FOR UPDATE SKIP LOCKED`;

    const breaches: Breach[] = [];
    for (const { id } of rows) {
      const incident = await tx.incident.findUniqueOrThrow({ where: { id } });
      const kind: Breach['kind'] =
        incident.status === 'PENDING' && incident.responseDueAt < now ? 'response' : 'resolution';
      const steps = incident.escalationSteps + 1;
      const newLevel = effectiveLevel(levelFromScore(incident.priorityScore), steps);
      const data: Prisma.IncidentUncheckedUpdateManyInput = {
        escalationSteps: steps,
        isOverdue: true,
        priorityLevel: newLevel,
        slaWarnedAt: null,
        resolutionDueAt: new Date(now.getTime() + slaDurationMs(newLevel, 'resolution', env.SLA_TIME_SCALE)),
      };
      if (incident.status === 'PENDING') {
        data.responseDueAt = new Date(now.getTime() + slaDurationMs(newLevel, 'response', env.SLA_TIME_SCALE));
      }
      const ids = incident.clusterId
        ? (await tx.incident.findMany({ where: { clusterId: incident.clusterId }, select: { id: true } })).map((r) => r.id)
        : [incident.id];
      await repo.updateIncidents(ids, data, tx);
      await recordHistory(tx, {
        incidentId: incident.id,
        fromStatus: incident.status,
        toStatus: incident.status,
        changedById: null,
        reason: 'AUTO_ESCALATION',
        note: `SLA de ${kind === 'response' ? 'respuesta' : 'resolución'} vencido`,
        at: now,
      });
      await repo.logEvent(incident.id, 'SLA_BREACHED', { kind, from: incident.priorityLevel, to: newLevel, steps }, null, tx);
      if (newLevel !== incident.priorityLevel) {
        await repo.logEvent(incident.id, 'PRIORITY_CHANGED', { from: incident.priorityLevel, to: newLevel, reason: 'AUTO_ESCALATION' }, null, tx);
      }
      breaches.push({ incidentId: incident.id, kind, newLevel });
    }
    return breaches;
  });
}

/** Aviso cuando se consume el 80 % del SLA que corre en la etapa actual. */
export async function warnApproaching(now = new Date()) {
  const open = await prisma.incident.findMany({
    where: { isClusterPrimary: true, status: { in: ['PENDING', 'IN_PROGRESS'] }, slaWarnedAt: null },
    select: { id: true, status: true, priorityLevel: true, responseDueAt: true, resolutionDueAt: true },
  });
  const warned: string[] = [];
  for (const incident of open) {
    const kind = activeSlaKind(incident.status);
    if (!kind) continue;
    const due = kind === 'response' ? incident.responseDueAt : incident.resolutionDueAt;
    const window = slaDurationMs(incident.priorityLevel, kind, env.SLA_TIME_SCALE);
    const warnAt = due.getTime() - window * (1 - SLA_WARNING_FRACTION);
    if (now.getTime() >= warnAt && now < due) {
      await repo.updateIncident(incident.id, { slaWarnedAt: now });
      await repo.logEvent(incident.id, 'SLA_WARNING', { kind, dueAt: due.toISOString() });
      bus.emit('SlaWarning', { incidentId: incident.id, kind });
      warned.push(incident.id);
    }
  }
  return warned;
}

export async function runSlaPass() {
  const now = new Date();
  const breaches = await escalateBreached(now);
  for (const breach of breaches) bus.emit('SlaBreached', breach);
  const warned = await warnApproaching(now);
  const recomputed = await recomputeOpen();
  return { breaches: breaches.length, warned: warned.length, recomputed };
}
