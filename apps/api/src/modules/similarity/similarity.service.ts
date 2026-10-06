import natural from 'natural';
import type { Prisma } from '@prisma/client';
import {
  combineSimilarity,
  decideSimilarity,
  explainSimilarity,
  normalizeText,
  tfidfCosine,
  tokenize,
  type Category,
  type DuplicateCandidateDTO,
  type GroupSuggestionDTO,
  type LocationRef,
  type Point3,
  type SimilarityBreakdown,
} from '@campus/shared';
import { bus } from '../../common/events';
import { prisma } from '../../common/prisma';
import { badRequest, conflict, notFound } from '../../common/errors';
import * as repo from '../incidents/incidents.repository';
import { toIncidentDTO } from '../incidents/incidents.mapper';
import { getSpaceContext } from '../locations/locations.service';
import { embed, embeddingsActive } from './embeddings';

const stem = (word: string) => natural.PorterStemmerEs.stem(word);
const tokens = (text: string) => tokenize(text, stem);

export interface Draft {
  spaceId: string;
  category: Category;
  description: string;
  hotspot: Point3 | null;
  createdAt?: Date;
  excludeIds?: string[];
  embedding?: number[] | null;
}

function refOf(row: repo.IncidentRow): LocationRef {
  return {
    campusId: row.space.block.campusId,
    blockId: row.space.blockId,
    floor: row.space.floor,
    spaceId: row.spaceId,
    hotspot:
      row.hotspotX != null && row.hotspotY != null && row.hotspotZ != null
        ? { x: row.hotspotX, y: row.hotspotY, z: row.hotspotZ }
        : null,
  };
}

/**
 * Puntúa un borrador contra los candidatos. Las hijas de un grupo se comparan también,
 * pero el resultado se reporta sobre la incidencia madre con el mejor puntaje del grupo.
 */
export async function scoreDraft(draft: Draft, limit = 5): Promise<DuplicateCandidateDTO[]> {
  const space = await getSpaceContext(draft.spaceId);
  const ids = await repo.similarityCandidateIds({
    campusId: space.block.campusId,
    blockId: space.blockId,
    normalizedText: normalizeText(draft.description),
    excludeIds: draft.excludeIds ?? [],
  });
  if (ids.length === 0) return [];

  const rows = await repo.findIncidents({ id: { in: ids } }, 50);
  const draftTokens = tokens(draft.description);
  const tfidf = tfidfCosine(draftTokens, rows.map((row) => tokens(row.description)));

  const vector = draft.embedding !== undefined ? draft.embedding : embeddingsActive() ? await embed(draft.description) : null;
  const semantic = vector ? await repo.embeddingSimilarities(vector, ids) : new Map<string, number>();

  const draftRef: LocationRef = {
    campusId: space.block.campusId,
    blockId: space.blockId,
    floor: space.floor,
    spaceId: space.id,
    hotspot: draft.hotspot,
  };
  const createdAt = draft.createdAt ?? new Date();

  const bestByPrimary = new Map<string, { breakdown: SimilarityBreakdown; primaryId: string }>();
  rows.forEach((row, index) => {
    const breakdown = combineSimilarity({
      location: { a: draftRef, b: refOf(row) },
      category: { a: draft.category, b: row.category },
      createdAt: { a: createdAt, b: row.createdAt },
      tfidf: tfidf[index],
      embedding: semantic.get(row.id) ?? null,
    });
    const primaryId = row.cluster?.primaryIncidentId ?? row.id;
    const current = bestByPrimary.get(primaryId);
    if (!current || breakdown.score > current.breakdown.score) bestByPrimary.set(primaryId, { breakdown, primaryId });
  });

  const ranked = [...bestByPrimary.values()]
    .filter((entry) => entry.breakdown.score >= 0.35)
    .sort((a, b) => b.breakdown.score - a.breakdown.score)
    .slice(0, limit);
  if (ranked.length === 0) return [];

  const primaries = await repo.findIncidents({ id: { in: ranked.map((r) => r.primaryId) } }, limit);
  const byId = new Map(primaries.map((row) => [row.id, row]));
  return ranked
    .filter((entry) => byId.has(entry.primaryId))
    .map((entry) => ({
      incident: toIncidentDTO(byId.get(entry.primaryId)!),
      similarity: entry.breakdown,
      explanation: explainSimilarity(entry.breakdown),
      decision: decideSimilarity(entry.breakdown.score),
    }));
}

async function breakdownBetween(incidentId: string, targetId: string): Promise<SimilarityBreakdown> {
  const [a, b] = await Promise.all([repo.findIncident(incidentId), repo.findIncident(targetId)]);
  const [tfidf] = tfidfCosine(tokens(a.description), [tokens(b.description)]);
  return combineSimilarity({
    location: { a: refOf(a), b: refOf(b) },
    category: { a: a.category, b: b.category },
    createdAt: { a: a.createdAt, b: b.createdAt },
    tfidf,
  });
}

/** Une una incidencia (y sus hijas, si era madre) al grupo de la incidencia destino. */
export async function groupInto(
  incidentId: string,
  targetId: string,
  options: { breakdown?: SimilarityBreakdown | null; actorId?: string | null; mode: 'auto' | 'joined' | 'manual' | 'suggestion' },
) {
  if (incidentId === targetId) throw badRequest('No se puede agrupar una incidencia consigo misma');
  const target = await repo.findIncident(targetId);
  const primaryId = target.cluster?.primaryIncidentId ?? target.id;
  const incident = await repo.findIncident(incidentId);
  if (incident.clusterId && incident.clusterId === target.clusterId) throw conflict('Ya pertenecen al mismo grupo');

  const breakdown = options.breakdown ?? (await breakdownBetween(incidentId, primaryId));

  const clusterId = await prisma.$transaction(async (tx) => {
    let cluster = target.clusterId ? await tx.incidentCluster.findUnique({ where: { id: target.clusterId } }) : null;
    if (!cluster) {
      cluster = await tx.incidentCluster.create({
        data: { primaryIncidentId: primaryId, spaceId: target.spaceId, category: target.category, reportsCount: 1 },
      });
      await repo.updateIncident(primaryId, { clusterId: cluster.id, isClusterPrimary: true }, tx);
    }

    const moving = incident.clusterId
      ? (await tx.incident.findMany({ where: { clusterId: incident.clusterId }, select: { id: true } })).map((r) => r.id)
      : [incident.id];
    const oldClusterId = incident.clusterId;
    await repo.updateIncidents(moving, { clusterId: cluster.id, isClusterPrimary: false }, tx);
    if (oldClusterId) await tx.incidentCluster.delete({ where: { id: oldClusterId } });

    const reportsCount = await tx.incident.count({ where: { clusterId: cluster.id } });
    await tx.incidentCluster.update({ where: { id: cluster.id }, data: { reportsCount } });
    await repo.logEvent(
      incident.id,
      'GROUPED',
      { clusterId: cluster.id, primaryIncidentId: primaryId, similarity: breakdown, mode: options.mode, moved: moving.length },
      options.actorId ?? null,
      tx,
    );
    await repo.logEvent(
      primaryId,
      'GROUPED',
      { clusterId: cluster.id, joinedIncidentId: incident.id, similarity: breakdown, mode: options.mode, reportsCount },
      options.actorId ?? null,
      tx,
    );
    await tx.groupSuggestion.updateMany({
      where: { status: 'PENDING', OR: [{ incidentId: incident.id }, { candidateId: incident.id }] },
      data: { status: options.mode === 'suggestion' ? 'ACCEPTED' : 'REJECTED', resolvedAt: new Date() },
    });
    return cluster.id;
  });

  bus.emit('IncidentGrouped', { incidentId: incident.id, clusterId, score: breakdown.score });
  return { clusterId, primaryIncidentId: primaryId };
}

export async function ungroup(incidentId: string, actorId: string) {
  const incident = await repo.findIncident(incidentId);
  if (!incident.clusterId) throw badRequest('La incidencia no pertenece a un grupo');
  if (incident.isClusterPrimary) throw badRequest('Separa primero las hijas; la incidencia madre sostiene el grupo');
  const clusterId = incident.clusterId;

  await prisma.$transaction(async (tx) => {
    await repo.updateIncident(incident.id, { clusterId: null, isClusterPrimary: true }, tx);
    const remaining = await tx.incident.count({ where: { clusterId } });
    if (remaining <= 1) {
      await tx.incident.updateMany({ where: { clusterId }, data: { clusterId: null, isClusterPrimary: true } });
      await tx.incidentCluster.delete({ where: { id: clusterId } });
    } else {
      await tx.incidentCluster.update({ where: { id: clusterId }, data: { reportsCount: remaining } });
    }
    await repo.logEvent(incident.id, 'UNGROUPED', { clusterId }, actorId, tx);
  });

  bus.emit('IncidentUngrouped', {
    incidentId: incident.id,
    clusterId,
    previousPrimaryId: incident.cluster!.primaryIncidentId,
  });
}

/** Decide automáticamente al crear: agrupar, sugerir al supervisor o dejar independiente. */
export async function onIncidentCreated(incidentId: string, joinIncidentId?: string | null) {
  const incident = await repo.findIncident(incidentId);
  const vector = embeddingsActive() ? await embed(incident.description) : null;
  if (vector) await repo.setEmbedding(incident.id, vector);

  if (joinIncidentId) {
    await groupInto(incident.id, joinIncidentId, { mode: 'joined', actorId: incident.reporterId });
    return;
  }

  const candidates = await scoreDraft(
    {
      spaceId: incident.spaceId,
      category: incident.category,
      description: incident.description,
      hotspot: refOf(incident).hotspot,
      createdAt: incident.createdAt,
      excludeIds: [incident.id],
      embedding: vector,
    },
    3,
  );
  const best = candidates[0];
  if (!best) return;
  if (best.decision === 'group') {
    await groupInto(incident.id, best.incident.id, { breakdown: best.similarity, mode: 'auto' });
    return;
  }
  for (const candidate of candidates.filter((c) => c.decision === 'suggest').slice(0, 2)) {
    const suggestion = await prisma.groupSuggestion.upsert({
      where: { incidentId_candidateId: { incidentId: incident.id, candidateId: candidate.incident.id } },
      create: {
        incidentId: incident.id,
        candidateId: candidate.incident.id,
        score: candidate.similarity.score,
        breakdown: candidate.similarity as unknown as Prisma.InputJsonValue,
      },
      update: {},
    });
    bus.emit('SuggestionCreated', { suggestionId: suggestion.id, incidentId: incident.id });
  }
}

export async function listSuggestions(): Promise<GroupSuggestionDTO[]> {
  const suggestions = await prisma.groupSuggestion.findMany({ where: { status: 'PENDING' }, orderBy: { score: 'desc' } });
  const ids = [...new Set(suggestions.flatMap((s) => [s.incidentId, s.candidateId]))];
  const rows = await repo.findIncidents({ id: { in: ids } }, 500);
  const byId = new Map(rows.map((row) => [row.id, toIncidentDTO(row)]));
  return suggestions
    .filter((s) => byId.has(s.incidentId) && byId.has(s.candidateId))
    .map((s) => {
      const breakdown = s.breakdown as unknown as SimilarityBreakdown;
      return {
        id: s.id,
        score: s.score,
        breakdown,
        explanation: explainSimilarity(breakdown),
        createdAt: s.createdAt.toISOString(),
        incident: byId.get(s.incidentId)!,
        candidate: byId.get(s.candidateId)!,
      };
    });
}

export async function decideSuggestion(id: string, decision: 'accept' | 'reject', actorId: string) {
  const suggestion = await prisma.groupSuggestion.findUnique({ where: { id } });
  if (!suggestion || suggestion.status !== 'PENDING') throw notFound('La sugerencia ya fue resuelta');
  if (decision === 'reject') {
    await prisma.groupSuggestion.update({
      where: { id },
      data: { status: 'REJECTED', resolvedById: actorId, resolvedAt: new Date() },
    });
    return { status: 'REJECTED' as const };
  }
  await groupInto(suggestion.incidentId, suggestion.candidateId, {
    breakdown: suggestion.breakdown as unknown as SimilarityBreakdown,
    actorId,
    mode: 'suggestion',
  });
  await prisma.groupSuggestion.update({ where: { id }, data: { status: 'ACCEPTED', resolvedById: actorId, resolvedAt: new Date() } });
  return { status: 'ACCEPTED' as const };
}

export async function clusterBreakdowns(clusterId: string): Promise<Map<string, SimilarityBreakdown>> {
  const events = await prisma.incidentEvent.findMany({
    where: { type: 'GROUPED', incident: { clusterId } },
    orderBy: { createdAt: 'asc' },
  });
  const map = new Map<string, SimilarityBreakdown>();
  for (const event of events) {
    const payload = event.payload as { similarity?: SimilarityBreakdown; joinedIncidentId?: string };
    if (payload.similarity && !payload.joinedIncidentId) map.set(event.incidentId, payload.similarity);
  }
  return map;
}

export function registerSimilarityListeners() {
  bus.on('IncidentCreated', ({ incidentId, joinIncidentId }) => onIncidentCreated(incidentId, joinIncidentId));
}
