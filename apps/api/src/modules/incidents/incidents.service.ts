import type { Prisma } from '@prisma/client';
import {
  PRIORITY_LEVELS,
  SLA_HOURS,
  STATUSES,
  availableTransitions,
  computeDueDates,
  formatIncidentCode,
  normalizeText,
  type CreateIncidentInput,
  type EvidenceDTO,
  type IncidentDetailDTO,
  type IncidentDTO,
  type IncidentEventDTO,
  type IncidentListQuery,
  type PreviewIncidentInput,
  type PriorityPreviewDTO,
  type RiskLevel,
  type TransitionActor,
} from '@campus/shared';
import { bus } from '../../common/events';
import { env } from '../../common/env';
import { prisma } from '../../common/prisma';
import { badRequest, forbidden, notFound } from '../../common/errors';
import { getSpaceContext } from '../locations/locations.service';
import { evaluate } from '../prioritization/prioritization.service';
import { clusterBreakdowns, scoreDraft } from '../similarity/similarity.service';
import { getHistory } from '../workflow/workflow.service';
import { processImage } from '../media/media.service';
import * as repo from './incidents.repository';
import { evidenceUrl, toIncidentDTO } from './incidents.mapper';

const csv = <T extends string>(value: string | undefined, allowed: readonly T[]) =>
  value
    ?.split(',')
    .map((v) => v.trim().toUpperCase())
    .filter((v): v is T => (allowed as readonly string[]).includes(v));

export async function list(query: IncidentListQuery, actor: TransitionActor): Promise<IncidentDTO[]> {
  const where: Prisma.IncidentWhereInput = {};
  const statuses = csv(query.status, STATUSES);
  const levels = csv(query.level, PRIORITY_LEVELS);
  if (statuses?.length) where.status = { in: statuses };
  if (levels?.length) where.priorityLevel = { in: levels };
  if (query.spaceId) where.spaceId = query.spaceId;
  else if (query.blockId) where.space = { blockId: query.blockId };
  else if (query.campusId) where.space = { block: { campusId: query.campusId } };
  if (query.overdue) where.isOverdue = true;
  if (query.mine) where.reporterId = actor.id;
  else where.isClusterPrimary = true;
  if (query.assignedToMe) where.assigneeId = actor.id;
  if (query.q?.trim()) {
    const q = query.q.trim();
    const number = Number(q.replace(/\D/g, ''));
    where.OR = [
      { descriptionNorm: { contains: normalizeText(q) } },
      { space: { name: { contains: q, mode: 'insensitive' } } },
      ...(number ? [{ number }] : []),
    ];
  }
  const rows = await repo.findIncidents(where, query.limit);
  return rows.map(toIncidentDTO);
}

export async function getDetail(id: string, actor: TransitionActor): Promise<IncidentDetailDTO> {
  const row = await repo.findIncident(id);
  const [evidence, history, events, members] = await Promise.all([
    prisma.evidence.findMany({ where: { incidentId: id }, orderBy: { createdAt: 'asc' } }),
    getHistory(id),
    prisma.incidentEvent.findMany({
      where: { incidentId: id },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { id: true, name: true, role: true } } },
    }),
    row.clusterId
      ? prisma.incident.findMany({
          where: { clusterId: row.clusterId },
          orderBy: { createdAt: 'asc' },
          include: { reporter: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);
  const breakdowns = row.clusterId ? await clusterBreakdowns(row.clusterId) : new Map();

  const dto = toIncidentDTO(row);
  const subject = { status: row.status, reporterId: row.reporterId, assigneeId: row.assigneeId };
  return {
    ...dto,
    evidence: evidence.map(
      (e): EvidenceDTO => ({
        id: e.id,
        stage: e.stage,
        kind: e.kind,
        url: e.kind === 'PHOTO' ? evidenceUrl(e) : null,
        text: e.text,
        width: e.width,
        height: e.height,
        createdAt: e.createdAt.toISOString(),
      }),
    ),
    history,
    events: events.map(
      (e): IncidentEventDTO => ({
        id: e.id,
        type: e.type,
        payload: e.payload as Record<string, unknown>,
        actor: e.actor,
        createdAt: e.createdAt.toISOString(),
      }),
    ),
    clusterMembers: members.map((m) => ({
      id: m.id,
      code: formatIncidentCode(m.number),
      description: m.description,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
      isClusterPrimary: m.isClusterPrimary,
      reporterName: m.reporter.name,
      similarity: breakdowns.get(m.id) ?? null,
    })),
    availableTransitions: row.isClusterPrimary ? availableTransitions(actor, subject) : [],
  };
}

export async function preview(input: PreviewIncidentInput): Promise<PriorityPreviewDTO> {
  if (!input.spaceId || !input.category) throw badRequest('Elige el espacio y la categoría', 'spaceId');
  const space = await getSpaceContext(input.spaceId);
  const duplicates =
    input.description.trim().length >= 6
      ? await scoreDraft({
          spaceId: input.spaceId,
          category: input.category,
          description: input.description,
          hotspot: input.hotspot ?? null,
        })
      : [];
  const joinable = duplicates.find((d) => d.decision === 'group');
  const result = evaluate({
    riskLevel: input.riskLevel,
    category: input.category,
    spaceType: space.type,
    capacity: space.capacity,
    similarCount: joinable ? joinable.incident.clusterSize + 1 : 1,
    createdAt: new Date(),
    resolutionDueAt: null,
    escalationSteps: 0,
  });
  return {
    score: result.score,
    level: result.level,
    breakdown: result.breakdown,
    responseHours: SLA_HOURS[result.level].response,
    resolutionHours: SLA_HOURS[result.level].resolution,
    duplicates: duplicates.filter((d) => d.decision !== 'none' || d.similarity.score >= 0.45),
  };
}

export async function create(input: CreateIncidentInput, actor: TransitionActor): Promise<IncidentDTO> {
  const space = await getSpaceContext(input.spaceId);
  if (input.joinIncidentId) {
    const target = await prisma.incident.findUnique({ where: { id: input.joinIncidentId }, select: { status: true } });
    if (!target) throw badRequest('El reporte al que te quieres sumar ya no existe', 'joinIncidentId');
    if (target.status === 'VERIFIED') throw badRequest('Ese reporte ya fue verificado; crea uno nuevo', 'joinIncidentId');
  }

  const now = new Date();
  const result = evaluate({
    riskLevel: input.riskLevel,
    category: input.category,
    spaceType: space.type,
    capacity: space.capacity,
    similarCount: 1,
    createdAt: now,
    resolutionDueAt: null,
    escalationSteps: 0,
  });
  const due = computeDueDates(now, result.level, env.SLA_TIME_SCALE);

  const incident = await prisma.$transaction(async (tx) => {
    const created = await tx.incident.create({
      data: {
        description: input.description,
        descriptionNorm: normalizeText(input.description),
        category: input.category,
        riskLevel: input.riskLevel,
        spaceId: space.id,
        hotspotX: input.hotspot?.x,
        hotspotY: input.hotspot?.y,
        hotspotZ: input.hotspot?.z,
        reporterId: actor.id,
        priorityScore: result.score,
        priorityLevel: result.level,
        priorityBreakdown: result.breakdown as unknown as Prisma.InputJsonValue,
        responseDueAt: due.responseDueAt,
        resolutionDueAt: due.resolutionDueAt,
        createdAt: now,
        stageStartedAt: now,
      },
    });
    await tx.statusHistory.create({
      data: { incidentId: created.id, fromStatus: null, toStatus: 'PENDING', changedById: actor.id, reason: 'MANUAL', changedAt: now },
    });
    await repo.logEvent(
      created.id,
      'CREATED',
      { score: result.score, level: result.level, breakdown: result.breakdown, joinIncidentId: input.joinIncidentId ?? null },
      actor.id,
      tx,
    );
    return created;
  });

  bus.emit('IncidentCreated', { incidentId: incident.id, joinIncidentId: input.joinIncidentId ?? null });
  return toIncidentDTO(await repo.findIncident(incident.id));
}

export async function addPhoto(
  incidentId: string,
  actor: TransitionActor,
  file: { buffer: Buffer; mime: string },
  stage: 'REPORT' | 'FIX',
): Promise<EvidenceDTO> {
  const incident = await repo.findIncident(incidentId);
  assertCanAttach(incident, actor, stage);
  const image = await processImage(file.buffer, file.mime);
  const evidence = await prisma.evidence.create({
    data: {
      incidentId,
      stage,
      kind: 'PHOTO',
      url: image.url,
      data: image.data ? new Uint8Array(image.data) : null,
      mime: image.mime,
      width: image.width,
      height: image.height,
    },
  });
  bus.emit('IncidentTouched', { incidentId });
  return {
    id: evidence.id,
    stage,
    kind: 'PHOTO',
    url: evidenceUrl(evidence),
    text: null,
    width: evidence.width,
    height: evidence.height,
    createdAt: evidence.createdAt.toISOString(),
  };
}

function assertCanAttach(incident: repo.IncidentRow, actor: TransitionActor, stage: 'REPORT' | 'FIX') {
  if (stage === 'REPORT' && actor.id !== incident.reporterId && actor.role !== 'SUPERVISOR') {
    throw forbidden('Solo quien reporta puede adjuntar evidencia del daño');
  }
  if (stage === 'FIX' && actor.id !== incident.assigneeId && actor.role !== 'SUPERVISOR') {
    throw forbidden('Solo el técnico asignado adjunta evidencia del arreglo');
  }
}

export async function getEvidenceFile(id: string) {
  const evidence = await prisma.evidence.findUnique({ where: { id }, select: { data: true, mime: true } });
  if (!evidence?.data) throw notFound('Imagen no disponible');
  return { data: Buffer.from(evidence.data), mime: evidence.mime ?? 'image/webp' };
}

export async function comment(incidentId: string, actor: TransitionActor, text: string) {
  await repo.findIncident(incidentId);
  await repo.logEvent(incidentId, 'COMMENT', { text }, actor.id);
  bus.emit('IncidentTouched', { incidentId });
}

export async function correctRisk(incidentId: string, actor: TransitionActor, riskLevel: RiskLevel, note?: string | null) {
  const incident = await repo.findIncident(incidentId);
  if (incident.riskLevel === riskLevel) return;
  const ids = incident.clusterId ? await repo.clusterMemberIds(incident.clusterId) : [incident.id];
  await repo.updateIncidents(ids, { riskLevel });
  await repo.logEvent(incident.cluster?.primaryIncidentId ?? incident.id, 'RISK_CORRECTED', { from: incident.riskLevel, to: riskLevel, note: note ?? null }, actor.id);
  bus.emit('RiskCorrected', { incidentId });
}
