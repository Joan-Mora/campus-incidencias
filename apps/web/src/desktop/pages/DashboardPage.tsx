import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CATEGORIES, CATEGORY_LABELS, PRIORITY_LABELS, PRIORITY_LEVELS, type HeatCellDTO } from '@campus/shared';
import { listItem, stagger } from '../../core/motion';
import { levelVar, useCssVars, useLevelColors } from '../../core/theme/levels';
import { useHeatmap, useOverdue, useResolutionTime, useSlaCompliance, useSummary, useTopSpaces } from '../../features/dashboard/api';
import { CategoryTile, LevelBadge } from '../../features/incidents/badges';
import { slaSnapshot, useNow } from '../../features/incidents/sla';
import { useTwin } from '../../scenes/twinStore';
import { useNavigate } from 'react-router-dom';
import { AnimatedNumber } from '../../ui/AnimatedNumber';
import { EmptyState } from '../../ui/EmptyState';
import { formatNumber } from '../../ui/format';
import { Icon } from '../../ui/Icon';
import { CATEGORY_ICONS, Icons, type LucideIcon } from '../../ui/icons';
import { Panel, PanelHeader } from '../../ui/Panel';
import { Ring } from '../../ui/Ring';
import { Skeleton } from '../../ui/Skeleton';

const HOUR = 3_600_000;

function formatHours(ms: number | null) {
  if (ms == null) return 'sin datos';
  const hours = ms / HOUR;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${formatNumber(hours)} h`;
  return `${formatNumber(hours / 24)} d`;
}

export default function DashboardPage() {
  const summary = useSummary();
  const data = summary.data;
  const compliance = data?.slaCompliance == null ? null : Math.round(data.slaCompliance * 100);

  return (
    <div className="h-full overflow-y-auto">
      <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="mx-auto flex max-w-[1500px] flex-col gap-4 p-5">
        <motion.header variants={listItem} className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">Panel de indicadores</h1>
            <p className="text-sm text-muted">Se actualiza en tiempo real con cada reporte, transición y escalamiento.</p>
          </div>
        </motion.header>

        <motion.div variants={listItem} className="grid grid-cols-5 gap-3">
          <Kpi icon={Icons.inbox} label="Abiertas" value={data?.open} />
          <Kpi icon={Icons.alarm} label="Vencidas" value={data?.overdue} tone="var(--level-critical)" />
          <Kpi icon={Icons.wrench} label="En proceso" value={data?.inProgress} tone="var(--level-medium)" />
          <Kpi icon={Icons.checkAll} label="Verificadas" value={data?.verifiedTotal} tone="var(--level-low)" />
          <Kpi icon={Icons.target} label="Cumplimiento de SLA" value={compliance ?? undefined} suffix=" %" tone="var(--accent)" empty={data && compliance == null} />
        </motion.div>

        <div className="grid grid-cols-12 gap-4">
          <motion.div variants={listItem} className="col-span-7">
            <ResolutionChart />
          </motion.div>
          <motion.div variants={listItem} className="col-span-5">
            <SlaByLevel />
          </motion.div>
          <motion.div variants={listItem} className="col-span-5">
            <OverdueList />
          </motion.div>
          <motion.div variants={listItem} className="col-span-7">
            <TopSpaces />
          </motion.div>
          <motion.div variants={listItem} className="col-span-12">
            <Heatmap />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function Kpi({ icon, label, value, suffix, tone, empty }: { icon: LucideIcon; label: string; value?: number; suffix?: string; tone?: string; empty?: boolean }) {
  return (
    <Panel className="relative overflow-hidden p-4">
      {tone && <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full blur-2xl" style={{ background: tone, opacity: 0.16 }} />}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span style={tone ? { color: tone } : undefined}>
          <Icon icon={icon} size="sm" />
        </span>
        {label}
      </div>
      {value == null ? (
        empty ? <p className="mt-2 font-display text-3xl font-semibold text-faint">--</p> : <Skeleton className="mt-2 h-9 w-20" />
      ) : (
        <AnimatedNumber value={value} suffix={suffix} className="mt-1 block font-display text-3xl font-semibold" />
      )}
    </Panel>
  );
}

function ResolutionChart() {
  const query = useResolutionTime();
  const colors = useLevelColors();
  const vars = useCssVars(['text-muted', 'border', 'surface-strong'] as const);
  const rows = useMemo(
    () =>
      [...PRIORITY_LEVELS].reverse().map((level) => {
        const row = query.data?.find((item) => item.level === level);
        return {
          level,
          name: PRIORITY_LABELS[level],
          promedio: row?.avgMs == null ? 0 : +(row.avgMs / HOUR).toFixed(2),
          mediana: row?.medianMs == null ? 0 : +(row.medianMs / HOUR).toFixed(2),
          count: row?.count ?? 0,
        };
      }),
    [query.data],
  );

  return (
    <Panel className="h-full p-5">
      <PanelHeader icon={Icons.timer} title="Tiempo de resolución por prioridad" subtitle="Horas desde el reporte hasta Resuelto. La mediana evita que un caso atípico distorsione el promedio." />
      <div className="mt-4 h-72">
        {query.isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} barGap={6}>
              <CartesianGrid vertical={false} stroke={vars.border} strokeDasharray="3 6" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: vars['text-muted'], fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: vars['text-muted'], fontSize: 11 }} unit=" h" width={48} />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                contentStyle={{ background: vars['surface-strong'], border: `1px solid ${vars.border}`, borderRadius: 12, fontSize: 12 }}
                formatter={(value, name) => [`${String(value ?? 0).replace('.', ',')} h`, name === 'promedio' ? 'Promedio' : 'Mediana']}
              />
              <Legend formatter={(value: string) => <span className="text-xs text-muted">{value === 'promedio' ? 'Promedio' : 'Mediana'}</span>} />
              <Bar dataKey="promedio" radius={[8, 8, 2, 2]} animationDuration={900}>
                {rows.map((row) => (
                  <Cell key={row.level} fill={colors[row.level]} />
                ))}
              </Bar>
              <Bar dataKey="mediana" radius={[8, 8, 2, 2]} animationDuration={900}>
                {rows.map((row) => (
                  <Cell key={row.level} fill={colors[row.level]} fillOpacity={0.4} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
        {rows.map((row) => (
          <div key={row.level} className="text-[11px] text-faint">
            {row.count} resueltas
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SlaByLevel() {
  const query = useSlaCompliance();
  return (
    <Panel className="h-full p-5">
      <PanelHeader icon={Icons.target} title="Cumplimiento de SLA" subtitle="Resueltas dentro del plazo y sin escalamientos" />
      <div className="mt-5 grid grid-cols-2 gap-4">
        {[...PRIORITY_LEVELS].reverse().map((level) => {
          const row = query.data?.find((item) => item.level === level);
          const rate = row?.rate == null ? null : Math.round(row.rate * 100);
          return (
            <div key={level} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
              <Ring value={(rate ?? 0) / 100} size={64} stroke={6} color={levelVar(level)}>
                <span className="font-mono text-sm">{rate == null ? '--' : `${rate}%`}</span>
              </Ring>
              <div>
                <LevelBadge level={level} />
                <p className="mt-1 text-[11px] text-muted">{row ? `${row.onTime} de ${row.total} a tiempo` : 'Sin casos cerrados'}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function OverdueList() {
  const query = useOverdue();
  const now = useNow(1000);
  const select = useTwin((state) => state.select);
  const navigate = useNavigate();
  return (
    <Panel className="flex h-full max-h-[440px] flex-col p-5">
      <PanelHeader icon={Icons.alarm} title="Incidencias vencidas" subtitle="Superaron el plazo de respuesta o de resolución" />
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {query.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !query.data?.length ? (
          <EmptyState icon={Icons.checkAll} illustration="check" title="Nada vencido" description="Todos los casos abiertos están dentro de su plazo." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {query.data.map((incident) => {
              const sla = slaSnapshot(incident, now);
              return (
                <button
                  key={incident.id}
                  onClick={() => {
                    select(incident.id);
                    navigate('/');
                  }}
                  className="flex items-center gap-3 rounded-xl border border-level-critical/25 bg-level-critical/5 p-2.5 text-left transition-colors hover:bg-level-critical/10"
                >
                  <CategoryTile category={incident.category} level={incident.priorityLevel} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-muted">{incident.code}</span>
                      <LevelBadge level={incident.priorityLevel} escalated={incident.escalationSteps || undefined} />
                    </span>
                    <span className="block truncate text-xs">
                      {incident.space.name}, {incident.space.block.name}
                    </span>
                  </span>
                  <span className="text-right font-mono text-[11px] text-level-critical">
                    {sla.remainingMs < 0 ? `+${formatHours(-sla.remainingMs)}` : 'respuesta tardía'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}

function TopSpaces() {
  const query = useTopSpaces();
  const max = query.data?.[0]?.total ?? 1;
  return (
    <Panel className="h-full p-5">
      <PanelHeader icon={Icons.pin} title="Espacios con más reportes" subtitle="Total histórico y casos abiertos ahora" />
      <div className="mt-4 flex flex-col gap-2.5">
        {query.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          query.data?.slice(0, 8).map((space, index) => (
            <div key={space.spaceId} className="grid grid-cols-[24px_1fr_auto] items-center gap-3">
              <span className="font-mono text-xs text-faint">{String(index + 1).padStart(2, '0')}</span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-medium">{space.spaceName}</span>
                  <span className="truncate text-[11px] text-faint">
                    {space.blockName}, {space.campusName}
                  </span>
                </div>
                <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
                  <motion.div className="absolute inset-y-0 left-0 rounded-full bg-accent/35" initial={{ width: 0 }} animate={{ width: `${(space.total / max) * 100}%` }} />
                  <motion.div className="absolute inset-y-0 left-0 rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${(space.open / max) * 100}%` }} />
                </div>
              </div>
              <span className="text-right font-mono text-xs">
                {space.total}
                <span className="text-faint"> / {space.open} abiertas</span>
              </span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function Heatmap() {
  const query = useHeatmap();
  const { blocks, max, lookup } = useMemo(() => {
    const cells = query.data ?? [];
    const blockMap = new Map<string, string>();
    const lookupMap = new Map<string, HeatCellDTO>();
    for (const cell of cells) {
      blockMap.set(cell.blockId, cell.blockName);
      lookupMap.set(`${cell.blockId}:${cell.category}`, cell);
    }
    return { blocks: [...blockMap.entries()], max: Math.max(1, ...cells.map((cell) => cell.open)), lookup: lookupMap };
  }, [query.data]);

  return (
    <Panel className="p-5">
      <PanelHeader icon={Icons.layers} title="Mapa de calor por bloque y categoría" subtitle="Casos abiertos; la intensidad crece con la concentración" />
      {query.isLoading ? (
        <Skeleton className="mt-4 h-48 w-full" />
      ) : !blocks.length ? (
        <p className="mt-6 text-center text-sm text-muted">No hay casos abiertos.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <div className="grid min-w-[760px] gap-1.5" style={{ gridTemplateColumns: `200px repeat(${CATEGORIES.length}, minmax(0, 1fr))` }}>
            <div />
            {CATEGORIES.map((category) => (
              <div key={category} className="flex flex-col items-center gap-1 pb-1 text-[11px] text-muted">
                <Icon icon={CATEGORY_ICONS[category]} size="sm" />
                {CATEGORY_LABELS[category]}
              </div>
            ))}
            {blocks.map(([blockId, blockName]) => (
              <HeatRow key={blockId} blockId={blockId} blockName={blockName} max={max} lookup={lookup} />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function HeatRow({ blockId, blockName, max, lookup }: { blockId: string; blockName: string; max: number; lookup: Map<string, HeatCellDTO> }) {
  return (
    <>
      <div className="flex items-center truncate pr-2 text-xs">{blockName}</div>
      {CATEGORIES.map((category, index) => {
        const value = lookup.get(`${blockId}:${category}`)?.open ?? 0;
        const intensity = value / max;
        return (
          <motion.div
            key={category}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.03 }}
            title={`${blockName}, ${CATEGORY_LABELS[category]}: ${value}`}
            className="grid h-11 place-items-center rounded-xl font-mono text-xs"
            style={{
              background: value
                ? `color-mix(in srgb, var(--level-critical) ${Math.round(20 + intensity * 70)}%, color-mix(in srgb, var(--level-high) 60%, transparent))`
                : 'var(--surface)',
              color: value ? (intensity > 0.5 ? '#fff' : 'var(--text)') : 'var(--text-faint)',
            }}
          >
            {value || ''}
          </motion.div>
        );
      })}
    </>
  );
}
