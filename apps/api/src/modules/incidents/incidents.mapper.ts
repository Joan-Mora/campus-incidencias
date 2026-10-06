import { formatIncidentCode, type IncidentDTO, type PriorityBreakdown } from '@campus/shared';
import type { IncidentRow } from './incidents.repository';

export function evidenceUrl(evidence: { id: string; url: string | null }): string {
  return evidence.url ?? `/api/media/evidence/${evidence.id}`;
}

export function toIncidentDTO(row: IncidentRow): IncidentDTO {
  const photo = row.evidence[0];
  return {
    id: row.id,
    number: row.number,
    code: formatIncidentCode(row.number),
    description: row.description,
    category: row.category,
    riskLevel: row.riskLevel,
    status: row.status,
    priorityScore: row.priorityScore,
    priorityLevel: row.priorityLevel,
    priorityBreakdown: row.priorityBreakdown as unknown as PriorityBreakdown,
    escalationSteps: row.escalationSteps,
    isOverdue: row.isOverdue,
    responseDueAt: row.responseDueAt.toISOString(),
    resolutionDueAt: row.resolutionDueAt.toISOString(),
    slaWarnedAt: row.slaWarnedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    stageStartedAt: row.stageStartedAt.toISOString(),
    firstResponseAt: row.firstResponseAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    hotspot:
      row.hotspotX != null && row.hotspotY != null && row.hotspotZ != null
        ? { x: row.hotspotX, y: row.hotspotY, z: row.hotspotZ }
        : null,
    space: {
      id: row.space.id,
      code: row.space.code,
      name: row.space.name,
      type: row.space.type,
      floor: row.space.floor,
      capacity: row.space.capacity,
      block: { id: row.space.block.id, code: row.space.block.code, name: row.space.block.name },
      campus: { id: row.space.block.campus.id, code: row.space.block.campus.code, name: row.space.block.campus.name },
    },
    reporter: row.reporter,
    assignee: row.assignee,
    clusterId: row.clusterId,
    isClusterPrimary: row.isClusterPrimary,
    clusterSize: row.cluster?.reportsCount ?? 1,
    thumbnailUrl: photo ? evidenceUrl(photo) : null,
  };
}
