import {
  PRIORITY_LEVELS,
  formatIncidentCode,
  snapshotAt,
  type DashboardSummaryDTO,
  type HeatCellDTO,
  type IncidentDTO,
  type PriorityLevel,
  type ResolutionTimeDTO,
  type SlaComplianceDTO,
  type SnapshotDTO,
  type TimelineDTO,
  type TopSpaceDTO,
} from '@campus/shared';
import { prisma } from '../../common/prisma';
import * as repo from '../incidents/incidents.repository';
import { toIncidentDTO } from '../incidents/incidents.mapper';

/** Indicadores de solo lectura. Cada consulta cuenta incidencias madre salvo donde se indica. */

export async function summary(): Promise<DashboardSummaryDTO> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [open, overdue, inProgress, resolvedToday, verifiedTotal, byLevelRows, compliance] = await Promise.all([
    prisma.incident.count({ where: { isClusterPrimary: true, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
    prisma.incident.count({ where: { isClusterPrimary: true, status: { in: ['PENDING', 'IN_PROGRESS'] }, isOverdue: true } }),
    prisma.incident.count({ where: { isClusterPrimary: true, status: 'IN_PROGRESS' } }),
    prisma.incident.count({ where: { isClusterPrimary: true, resolvedAt: { gte: startOfDay } } }),
    prisma.incident.count({ where: { isClusterPrimary: true, status: 'VERIFIED' } }),
    prisma.incident.groupBy({
      by: ['priorityLevel'],
      where: { isClusterPrimary: true, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      _count: true,
    }),
    slaCompliance(),
  ]);
  const byLevel = Object.fromEntries(PRIORITY_LEVELS.map((level) => [level, 0])) as Record<PriorityLevel, number>;
  for (const row of byLevelRows) byLevel[row.priorityLevel] = row._count;
  const total = compliance.reduce((sum, row) => sum + row.total, 0);
  const onTime = compliance.reduce((sum, row) => sum + row.onTime, 0);
  return {
    open,
    overdue,
    inProgress,
    resolvedToday,
    verifiedTotal,
    slaCompliance: total ? onTime / total : null,
    byLevel,
  };
}

export async function overdue(): Promise<IncidentDTO[]> {
  const rows = await prisma.incident.findMany({
    where: { isClusterPrimary: true, status: { in: ['PENDING', 'IN_PROGRESS'] }, isOverdue: true },
    include: repo.INCIDENT_INCLUDE,
    orderBy: [{ escalationSteps: 'desc' }, { createdAt: 'asc' }],
  });
  return rows.map(toIncidentDTO);
}

export async function resolutionTime(): Promise<ResolutionTimeDTO[]> {
  const rows = await prisma.$queryRaw<{ level: PriorityLevel; count: bigint; avg_ms: number | null; median_ms: number | null }[]>`
    SELECT "priorityLevel" AS level,
           count(*) AS count,
           avg(extract(epoch FROM ("resolvedAt" - "createdAt")) * 1000) AS avg_ms,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM ("resolvedAt" - "createdAt")) * 1000) AS median_ms
    FROM "Incident"
    WHERE "isClusterPrimary" = true AND "resolvedAt" IS NOT NULL
    GROUP BY "priorityLevel"`;
  const byLevel = new Map(rows.map((row) => [row.level, row]));
  return [...PRIORITY_LEVELS].reverse().map((level) => {
    const row = byLevel.get(level);
    return {
      level,
      count: row ? Number(row.count) : 0,
      avgMs: row?.avg_ms != null ? Number(row.avg_ms) : null,
      medianMs: row?.median_ms != null ? Number(row.median_ms) : null,
    };
  });
}

/** Cuenta todos los reportes, incluidas las hijas de un grupo: es lo que se acumula en el espacio. */
export async function topSpaces(limit = 10): Promise<TopSpaceDTO[]> {
  const rows = await prisma.$queryRaw<
    { space_id: string; space_name: string; space_code: string; block_name: string; campus_name: string; total: bigint; open: bigint }[]
  >`
    SELECT s.id AS space_id, s.name AS space_name, s.code AS space_code, b.name AS block_name, c.name AS campus_name,
           count(i.id) AS total,
           count(i.id) FILTER (WHERE i.status IN ('PENDING', 'IN_PROGRESS')) AS open
    FROM "Incident" i
    JOIN "Space" s ON s.id = i."spaceId"
    JOIN "Block" b ON b.id = s."blockId"
    JOIN "Campus" c ON c.id = b."campusId"
    GROUP BY s.id, b.name, c.name
    ORDER BY total DESC, open DESC
    LIMIT ${limit}`;
  return rows.map((row) => ({
    spaceId: row.space_id,
    spaceName: row.space_name,
    spaceCode: row.space_code,
    blockName: row.block_name,
    campusName: row.campus_name,
    total: Number(row.total),
    open: Number(row.open),
  }));
}

/** A tiempo: resuelta sin escalamientos y antes de su vencimiento de resolución. */
export async function slaCompliance(): Promise<SlaComplianceDTO[]> {
  const rows = await prisma.$queryRaw<{ level: PriorityLevel; total: bigint; on_time: bigint }[]>`
    SELECT "priorityLevel" AS level,
           count(*) AS total,
           count(*) FILTER (WHERE "escalationSteps" = 0 AND "resolvedAt" <= "resolutionDueAt") AS on_time
    FROM "Incident"
    WHERE "isClusterPrimary" = true AND "resolvedAt" IS NOT NULL
    GROUP BY "priorityLevel"`;
  const byLevel = new Map(rows.map((row) => [row.level, row]));
  return [...PRIORITY_LEVELS].reverse().map((level) => {
    const row = byLevel.get(level);
    const total = row ? Number(row.total) : 0;
    const onTime = row ? Number(row.on_time) : 0;
    return { level, total, onTime, rate: total ? onTime / total : null };
  });
}

export async function heatmap(): Promise<HeatCellDTO[]> {
  const rows = await prisma.$queryRaw<{ block_id: string; block_name: string; category: HeatCellDTO['category']; open: bigint }[]>`
    SELECT b.id AS block_id, b.name AS block_name, i.category, count(*) AS open
    FROM "Incident" i
    JOIN "Space" s ON s.id = i."spaceId"
    JOIN "Block" b ON b.id = s."blockId"
    WHERE i.status IN ('PENDING', 'IN_PROGRESS') AND i."isClusterPrimary" = true
    GROUP BY b.id, b.name, i.category
    ORDER BY b.name`;
  return rows.map((row) => ({ blockId: row.block_id, blockName: row.block_name, category: row.category, open: Number(row.open) }));
}

/** Historia completa compacta para que el navegador reproduzca el campus en el tiempo. */
export async function timeline(days = 14): Promise<TimelineDTO> {
  const since = new Date(Date.now() - days * 86_400_000);
  const incidents = await prisma.incident.findMany({
    where: { OR: [{ createdAt: { gte: since } }, { status: { in: ['PENDING', 'IN_PROGRESS', 'RESOLVED'] } }] },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      number: true,
      spaceId: true,
      category: true,
      hotspotX: true,
      hotspotY: true,
      hotspotZ: true,
      createdAt: true,
      clusterId: true,
      isClusterPrimary: true,
      priorityLevel: true,
      history: { orderBy: { changedAt: 'asc' }, select: { changedAt: true, toStatus: true, fromStatus: true } },
      events: {
        where: { type: { in: ['CREATED', 'PRIORITY_CHANGED', 'SLA_BREACHED'] } },
        orderBy: { createdAt: 'asc' },
        select: { type: true, payload: true, createdAt: true },
      },
    },
  });

  const items = incidents.map((incident) => {
    const levels: { at: string; level: PriorityLevel }[] = [];
    const breaches: string[] = [];
    for (const event of incident.events) {
      const payload = event.payload as { level?: PriorityLevel; to?: PriorityLevel };
      if (event.type === 'CREATED' && payload.level) levels.push({ at: event.createdAt.toISOString(), level: payload.level });
      if (event.type === 'PRIORITY_CHANGED' && payload.to) levels.push({ at: event.createdAt.toISOString(), level: payload.to });
      if (event.type === 'SLA_BREACHED') breaches.push(event.createdAt.toISOString());
    }
    if (levels.length === 0) levels.push({ at: incident.createdAt.toISOString(), level: incident.priorityLevel });
    return {
      id: incident.id,
      code: formatIncidentCode(incident.number),
      spaceId: incident.spaceId,
      category: incident.category,
      hotspot:
        incident.hotspotX != null && incident.hotspotY != null && incident.hotspotZ != null
          ? { x: incident.hotspotX, y: incident.hotspotY, z: incident.hotspotZ }
          : null,
      createdAt: incident.createdAt.toISOString(),
      clusterId: incident.clusterId,
      isClusterPrimary: incident.isClusterPrimary,
      transitions: incident.history
        .filter((h) => h.fromStatus !== h.toStatus)
        .map((h) => ({ at: h.changedAt.toISOString(), status: h.toStatus })),
      levels,
      breaches,
    };
  });

  const from = items[0]?.createdAt ?? new Date().toISOString();
  return { from, to: new Date().toISOString(), incidents: items };
}

export async function snapshot(at: Date): Promise<SnapshotDTO> {
  const data = await timeline(30);
  return { at: at.toISOString(), from: data.from, to: data.to, incidents: snapshotAt(data, at) };
}
