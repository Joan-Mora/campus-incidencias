import type { CampusDTO } from '@campus/shared';
import type { TwinMode } from '../twinStore';
import type { TwinIncident } from './useTwinData';

/** Contrato común del gemelo 3D y del respaldo isométrico: mismos datos y mismas interacciones. */
export interface CampusSceneProps {
  campus: CampusDTO;
  incidents: TwinIncident[];
  mode: TwinMode;
  selectedId: string | null;
  focusBlockId: string | null;
  clock: Date;
  onSelect: (id: string | null) => void;
  onFocusBlock: (id: string | null) => void;
  /** Rotación lenta automática para el modo proyector. */
  autoRotate?: boolean;
  tier?: 'full' | 'lite';
}

export interface BlockStats {
  open: number;
  critical: number;
  overdue: number;
}

export function statsByBlock(campus: CampusDTO, incidents: TwinIncident[]) {
  const blockBySpace = new Map<string, string>();
  for (const block of campus.blocks) for (const space of block.spaces) blockBySpace.set(space.id, block.id);
  const stats = new Map<string, BlockStats>();
  for (const block of campus.blocks) stats.set(block.id, { open: 0, critical: 0, overdue: 0 });
  for (const incident of incidents) {
    if (!incident.isPrimary) continue;
    const entry = stats.get(blockBySpace.get(incident.spaceId) ?? '');
    if (!entry) continue;
    entry.open += 1;
    if (incident.level === 'CRITICAL') entry.critical += 1;
    if (incident.isOverdue) entry.overdue += 1;
  }
  return stats;
}

/** Agrupa por espacio para repartir balizas y calcular columnas de calor. */
export function incidentsBySpace(incidents: TwinIncident[]) {
  const map = new Map<string, TwinIncident[]>();
  for (const incident of incidents) {
    const list = map.get(incident.spaceId) ?? [];
    list.push(incident);
    map.set(incident.spaceId, list);
  }
  return map;
}
