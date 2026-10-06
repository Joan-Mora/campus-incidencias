import type { Category, IncidentStatus, PriorityLevel } from '../enums';
import type { SnapshotIncidentDTO } from '../dto';
import type { Point3 } from './similarity-score';

export interface TimelineIncidentDTO {
  id: string;
  code: string;
  spaceId: string;
  category: Category;
  hotspot: Point3 | null;
  createdAt: string;
  clusterId: string | null;
  isClusterPrimary: boolean;
  /** Cambios de estado en orden, incluido el inicial a Pendiente. */
  transitions: { at: string; status: IncidentStatus }[];
  /** Nivel inicial y cada cambio posterior. */
  levels: { at: string; level: PriorityLevel }[];
  breaches: string[];
}

export interface TimelineDTO {
  from: string;
  to: string;
  incidents: TimelineIncidentDTO[];
}

function lastBefore<T extends { at: string }>(items: T[], time: number): T | undefined {
  let found: T | undefined;
  for (const item of items) {
    if (new Date(item.at).getTime() <= time) found = item;
    else break;
  }
  return found;
}

/** Estado de una incidencia en el instante `at`, o null si aún no existía. */
export function stateAt(item: TimelineIncidentDTO, at: Date): SnapshotIncidentDTO | null {
  const time = at.getTime();
  if (new Date(item.createdAt).getTime() > time) return null;
  const status = lastBefore(item.transitions, time)?.status ?? 'PENDING';
  const level = lastBefore(item.levels, time)?.level ?? item.levels[0]?.level ?? 'LOW';
  const open = status === 'PENDING' || status === 'IN_PROGRESS';
  const isOverdue = open && item.breaches.some((breach) => new Date(breach).getTime() <= time);
  return {
    id: item.id,
    code: item.code,
    spaceId: item.spaceId,
    category: item.category,
    status,
    level,
    isOverdue,
    clusterId: item.clusterId,
    hotspot: item.hotspot,
  };
}

export function snapshotAt(timeline: TimelineDTO, at: Date): SnapshotIncidentDTO[] {
  return timeline.incidents.map((item) => stateAt(item, at)).filter((s): s is SnapshotIncidentDTO => s !== null);
}
