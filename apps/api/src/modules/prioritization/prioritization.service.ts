import type { Prisma } from '@prisma/client';
import {
  computePriority,
  effectiveLevel,
  levelRank,
  slaConsumed,
  slaDurationMs,
  type Category,
  type PriorityLevel,
  type PriorityResult,
  type RiskLevel,
  type SpaceType,
} from '@campus/shared';
import { bus } from '../../common/events';
import { env } from '../../common/env';
import { prisma } from '../../common/prisma';
import * as repo from '../incidents/incidents.repository';

export interface PriorityContext {
  riskLevel: RiskLevel;
  category: Category;
  spaceType: SpaceType;
  capacity: number;
  similarCount: number;
  createdAt: Date;
  resolutionDueAt: Date | null;
  escalationSteps: number;
  now?: Date;
}

export function evaluate(context: PriorityContext): PriorityResult & { level: PriorityLevel } {
  const now = context.now ?? new Date();
  const result = computePriority({
    riskLevel: context.riskLevel,
    category: context.category,
    spaceType: context.spaceType,
    capacity: context.capacity,
    similarCount: context.similarCount,
    slaConsumed: context.resolutionDueAt ? slaConsumed(now, context.createdAt, context.resolutionDueAt) : 0,
  });
  return { ...result, level: effectiveLevel(result.baseLevel, context.escalationSteps) };
}

type RecomputeReason = 'GROUPED' | 'UNGROUPED' | 'RISK_CORRECTED' | 'AGE' | 'CREATED';

/** Recalcula la incidencia madre de un grupo (o la incidencia suelta) y replica el resultado a las hijas. */
export async function recompute(incidentId: string, reason: RecomputeReason, actorId: string | null = null) {
  const target = await prisma.incident.findUnique({ where: { id: incidentId }, include: { cluster: true } });
  if (!target) return null;
  const primaryId = target.cluster?.primaryIncidentId ?? target.id;
  const primary = await prisma.incident.findUnique({
    where: { id: primaryId },
    include: { space: true, cluster: { select: { reportsCount: true } } },
  });
  if (!primary) return null;

  const done = primary.status === 'RESOLVED' || primary.status === 'VERIFIED';
  const result = evaluate({
    riskLevel: primary.riskLevel,
    category: primary.category,
    spaceType: primary.space.type,
    capacity: primary.space.capacity,
    similarCount: primary.clusterId ? (primary.cluster?.reportsCount ?? 1) : 1,
    createdAt: primary.createdAt,
    resolutionDueAt: primary.resolutionDueAt,
    escalationSteps: primary.escalationSteps,
    now: done ? (primary.resolvedAt ?? new Date()) : new Date(),
  });

  const data: Prisma.IncidentUncheckedUpdateManyInput = {
    priorityScore: result.score,
    priorityLevel: result.level,
    priorityBreakdown: result.breakdown as unknown as Prisma.InputJsonValue,
  };

  // Si la fórmula sube el nivel, el SLA se acorta, pero nunca hacia atrás de "ahora".
  if (!done && levelRank(result.level) > levelRank(primary.priorityLevel)) {
    const now = Date.now();
    const shorten = (current: Date, kind: 'response' | 'resolution') => {
      const candidate = primary.createdAt.getTime() + slaDurationMs(result.level, kind, env.SLA_TIME_SCALE);
      return new Date(Math.min(current.getTime(), Math.max(candidate, now)));
    };
    data.responseDueAt = shorten(primary.responseDueAt, 'response');
    data.resolutionDueAt = shorten(primary.resolutionDueAt, 'resolution');
  }

  const memberIds = primary.clusterId ? await repo.clusterMemberIds(primary.clusterId) : [primary.id];
  await repo.updateIncidents(memberIds.length ? memberIds : [primary.id], data);

  const scoreChanged = Math.abs(result.score - primary.priorityScore) >= 0.05;
  if (result.level !== primary.priorityLevel) {
    await repo.logEvent(primary.id, 'PRIORITY_CHANGED', {
      from: primary.priorityLevel,
      to: result.level,
      score: result.score,
      reason,
    }, actorId);
    bus.emit('PriorityChanged', { incidentId: primary.id, from: primary.priorityLevel, to: result.level, score: result.score });
  }
  return { primaryId: primary.id, level: result.level, score: result.score, levelChanged: result.level !== primary.priorityLevel, scoreChanged };
}

/** Pasada periódica: la antigüedad (A) crece con el tiempo y puede cambiar el nivel. */
export async function recomputeOpen() {
  const open = await repo.openPrimaries();
  let changed = 0;
  for (const incident of open) {
    const result = await recompute(incident.id, 'AGE');
    if (result?.levelChanged || result?.scoreChanged) changed += 1;
  }
  return changed;
}

export function registerPriorityListeners() {
  bus.on('IncidentGrouped', ({ incidentId }) => recompute(incidentId, 'GROUPED').then(() => undefined));
  bus.on('IncidentUngrouped', async ({ incidentId, previousPrimaryId }) => {
    await recompute(incidentId, 'UNGROUPED');
    await recompute(previousPrimaryId, 'UNGROUPED');
  });
  bus.on('RiskCorrected', ({ incidentId }) => recompute(incidentId, 'RISK_CORRECTED').then(() => undefined));
  bus.on('SlaBreached', ({ incidentId }) => recompute(incidentId, 'AGE').then(() => undefined));
}
