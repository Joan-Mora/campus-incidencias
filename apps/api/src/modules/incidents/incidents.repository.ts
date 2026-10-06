import { Prisma } from '@prisma/client';
import type { EventType } from '@campus/shared';
import { prisma } from '../../common/prisma';
import { notFound } from '../../common/errors';

/** Único punto de acceso a las tablas Incident, Evidence e IncidentEvent para los demás módulos. */

export const INCIDENT_INCLUDE = {
  space: { include: { block: { include: { campus: true } } } },
  reporter: { select: { id: true, name: true, role: true } },
  assignee: { select: { id: true, name: true, role: true } },
  cluster: { select: { reportsCount: true, primaryIncidentId: true } },
  evidence: {
    where: { stage: 'REPORT', kind: 'PHOTO' },
    select: { id: true, url: true },
    take: 1,
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.IncidentInclude;

export type IncidentRow = Prisma.IncidentGetPayload<{ include: typeof INCIDENT_INCLUDE }>;

export async function findIncident(id: string): Promise<IncidentRow> {
  const row = await prisma.incident.findUnique({ where: { id }, include: INCIDENT_INCLUDE });
  if (!row) throw notFound('La incidencia no existe');
  return row;
}

export function findIncidents(where: Prisma.IncidentWhereInput, take = 200) {
  return prisma.incident.findMany({
    where,
    include: INCIDENT_INCLUDE,
    orderBy: [{ priorityLevel: 'desc' }, { priorityScore: 'desc' }, { createdAt: 'asc' }],
    take,
  });
}

export function updateIncident(id: string, data: Prisma.IncidentUncheckedUpdateInput, tx: Prisma.TransactionClient = prisma) {
  return tx.incident.update({ where: { id }, data });
}

export function updateIncidents(ids: string[], data: Prisma.IncidentUncheckedUpdateManyInput, tx: Prisma.TransactionClient = prisma) {
  return tx.incident.updateMany({ where: { id: { in: ids } }, data });
}

export function clusterMemberIds(clusterId: string, excludeId?: string) {
  return prisma.incident
    .findMany({ where: { clusterId, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })
    .then((rows) => rows.map((r) => r.id));
}

export function logEvent(
  incidentId: string,
  type: EventType,
  payload: Record<string, unknown>,
  actorId: string | null = null,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.incidentEvent.create({
    data: { incidentId, type, payload: payload as Prisma.InputJsonValue, actorId },
  });
}

export function addTextEvidence(
  incidentId: string,
  stage: 'REPORT' | 'FIX',
  text: string,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.evidence.create({ data: { incidentId, stage, kind: 'TEXT', text } });
}

export function hasFixEvidence(incidentId: string) {
  return prisma.evidence.count({ where: { incidentId, stage: 'FIX' } }).then((count) => count > 0);
}

export async function setEmbedding(incidentId: string, vector: number[]) {
  const literal = `[${vector.map((v) => v.toFixed(6)).join(',')}]`;
  await prisma.$executeRaw`UPDATE "Incident" SET embedding = ${literal}::vector WHERE id = ${incidentId}`;
}

/** Similitud coseno con pgvector (operador <=> es distancia coseno). */
export async function embeddingSimilarities(vector: number[], ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const literal = `[${vector.map((v) => v.toFixed(6)).join(',')}]`;
  const rows = await prisma.$queryRaw<{ id: string; sim: number }[]>`
    SELECT id, 1 - (embedding <=> ${literal}::vector) AS sim
    FROM "Incident"
    WHERE id IN (${Prisma.join(ids)}) AND embedding IS NOT NULL`;
  return new Map(rows.map((row) => [row.id, Number(row.sim)]));
}

/** Candidatos de la misma sede en los últimos 14 días: mismo bloque o texto parecido (pg_trgm). */
export async function similarityCandidateIds(params: {
  campusId: string;
  blockId: string;
  normalizedText: string;
  excludeIds: string[];
}): Promise<string[]> {
  const exclude = params.excludeIds.length ? Prisma.sql`AND i.id NOT IN (${Prisma.join(params.excludeIds)})` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT i.id
    FROM "Incident" i
    JOIN "Space" s ON s.id = i."spaceId"
    JOIN "Block" b ON b.id = s."blockId"
    WHERE i.status <> 'VERIFIED'
      AND b."campusId" = ${params.campusId}
      AND i."createdAt" > now() - interval '14 days'
      AND (s."blockId" = ${params.blockId} OR similarity(i."descriptionNorm", ${params.normalizedText}) > 0.15)
      ${exclude}
    ORDER BY (s."blockId" = ${params.blockId}) DESC, similarity(i."descriptionNorm", ${params.normalizedText}) DESC
    LIMIT 50`;
  return rows.map((row) => row.id);
}

export function openPrimaries() {
  return prisma.incident.findMany({
    where: { isClusterPrimary: true, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    include: { space: true, cluster: { select: { reportsCount: true } } },
  });
}
