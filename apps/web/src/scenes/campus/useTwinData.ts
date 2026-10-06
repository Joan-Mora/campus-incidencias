import { useMemo } from 'react';
import { OPEN_STATUSES, stateAt, type CampusDTO, type Category, type IncidentStatus, type Point3, type PriorityLevel } from '@campus/shared';
import { useTimeline } from '../../features/dashboard/api';
import { useNow } from '../../features/incidents/sla';

export interface TwinIncident {
  id: string;
  code: string;
  spaceId: string;
  category: Category;
  status: IncidentStatus;
  level: PriorityLevel;
  isOverdue: boolean;
  clusterId: string | null;
  isPrimary: boolean;
  hotspot: Point3 | null;
}

/**
 * Estado de las incidencias abiertas de una sede en un instante. En vivo usa "ahora";
 * en repetición usa el instante del deslizador. Ambos salen de la misma historia compacta.
 */
export function useTwinData(campus: CampusDTO | undefined, replayAt: number | null) {
  const timeline = useTimeline(14);
  const now = useNow(20_000);
  const at = replayAt ?? now.getTime();

  const spaceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const block of campus?.blocks ?? []) for (const space of block.spaces) ids.add(space.id);
    return ids;
  }, [campus]);

  const incidents = useMemo<TwinIncident[]>(() => {
    if (!timeline.data) return [];
    const instant = new Date(at);
    const result: TwinIncident[] = [];
    for (const item of timeline.data.incidents) {
      if (!spaceIds.has(item.spaceId)) continue;
      const state = stateAt(item, instant);
      if (!state || !OPEN_STATUSES.includes(state.status)) continue;
      result.push({ ...state, isPrimary: item.isClusterPrimary || !item.clusterId });
    }
    return result;
  }, [timeline.data, spaceIds, at]);

  return {
    incidents,
    range: timeline.data ? { from: new Date(timeline.data.from).getTime(), to: new Date(timeline.data.to).getTime() } : null,
    loading: timeline.isLoading,
    clock: new Date(at),
  };
}
