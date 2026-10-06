import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { levelRank, PRIORITY_LABELS, PRIORITY_LEVELS, type IncidentDTO, type PriorityLevel } from '@campus/shared';
import { duration, listItem, spring } from '../../core/motion';
import { levelVar, LEVEL_STYLES } from '../../core/theme/levels';
import { useIncidents } from '../../features/incidents/api';
import { CategoryTile, LevelBadge, SlaRing } from '../../features/incidents/badges';
import { useNow } from '../../features/incidents/sla';
import { useTwin } from '../../scenes/twinStore';
import { cn } from '../../ui/cn';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { Icons } from '../../ui/icons';
import { Segmented } from '../../ui/Segmented';
import { SkeletonRows } from '../../ui/Skeleton';

type StatusFilter = 'open' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';

const STATUS_QUERY: Record<StatusFilter, string> = {
  open: 'PENDING,IN_PROGRESS',
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
};

/** Cola priorizada: filtros en la URL, reordenamiento animado y destello cuando una incidencia sube de nivel. */
export function PriorityQueue({ campusId, blockId }: { campusId: string | null; blockId: string | null }) {
  const [params, setParams] = useSearchParams();
  const status = (params.get('estado') as StatusFilter) ?? 'open';
  const levels = params.get('nivel')?.split(',').filter(Boolean) ?? [];
  const overdue = params.get('vencidas') === '1';
  const [search, setSearch] = useState(params.get('q') ?? '');
  const { selectedId, select } = useTwin();
  const now = useNow(1000);

  useEffect(() => {
    const timer = setTimeout(() => update('q', search || null), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function update(key: string, value: string | null) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  const query = useIncidents({
    status: STATUS_QUERY[status] ?? STATUS_QUERY.open,
    level: levels.join(',') || undefined,
    overdue: overdue || undefined,
    q: params.get('q') ?? undefined,
    campusId: blockId ? undefined : (campusId ?? undefined),
    blockId: blockId ?? undefined,
  });

  const flashing = useLevelFlash(query.data);
  const toggleLevel = (level: PriorityLevel) => {
    const next = levels.includes(level) ? levels.filter((item) => item !== level) : [...levels, level];
    update('nivel', next.join(',') || null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2.5 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Icon icon={Icons.queue} size="sm" className="text-accent" />
          <h2 className="font-display text-sm font-semibold">Cola priorizada</h2>
          <span className="ml-auto font-mono text-xs text-muted">{query.data?.length ?? 0}</span>
        </div>
        <div className="glass flex h-9 items-center gap-2 rounded-xl px-3">
          <Icon icon={Icons.search} size="sm" className="text-faint" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Código, descripción o espacio"
            className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-faint hover:text-fg" aria-label="Limpiar búsqueda">
              <Icon icon={Icons.close} size="sm" />
            </button>
          )}
        </div>
        <Segmented
          size="sm"
          value={status}
          onChange={(value) => update('estado', value === 'open' ? null : value)}
          options={[
            { value: 'open', label: 'Abiertas' },
            { value: 'PENDING', label: 'Pendientes' },
            { value: 'IN_PROGRESS', label: 'En proceso' },
            { value: 'RESOLVED', label: 'Resueltas' },
          ]}
          className="w-full [&>button]:flex-1"
        />
        <div className="flex flex-wrap gap-1.5">
          {[...PRIORITY_LEVELS].reverse().map((level) => {
            const active = levels.includes(level);
            return (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  active ? cn(LEVEL_STYLES[level].soft, LEVEL_STYLES[level].border, LEVEL_STYLES[level].text) : 'border-line text-muted hover:text-fg',
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: levelVar(level) }} />
                {PRIORITY_LABELS[level]}
              </button>
            );
          })}
          <button
            onClick={() => update('vencidas', overdue ? null : '1')}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              overdue ? 'border-level-critical/40 bg-level-critical/12 text-level-critical' : 'border-line text-muted hover:text-fg',
            )}
          >
            <Icon icon={Icons.alarm} size={12} />
            Vencidas
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-12">
        {query.isLoading ? (
          <SkeletonRows count={7} />
        ) : !query.data?.length ? (
          <EmptyState icon={Icons.checkAll} illustration="check" title="Nada pendiente aquí" description="No hay incidencias con estos filtros. El campus está en orden." />
        ) : (
          <motion.ul layout className="flex flex-col gap-1">
            <AnimatePresence initial={false}>
              {query.data.map((incident, index) => (
                <QueueRow
                  key={incident.id}
                  incident={incident}
                  rank={index + 1}
                  now={now}
                  selected={incident.id === selectedId}
                  flashing={flashing.has(incident.id)}
                  onSelect={() => select(incident.id === selectedId ? null : incident.id)}
                />
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </div>
  );
}

/** Detecta incidencias cuyo nivel subió desde el último refresco. */
function useLevelFlash(data: IncidentDTO[] | undefined) {
  const previous = useRef(new Map<string, PriorityLevel>());
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    const risen = new Set<string>();
    for (const incident of data) {
      const before = previous.current.get(incident.id);
      if (before && levelRank(incident.priorityLevel) > levelRank(before)) risen.add(incident.id);
      previous.current.set(incident.id, incident.priorityLevel);
    }
    if (!risen.size) return;
    setFlashing(risen);
    const timer = setTimeout(() => setFlashing(new Set()), 1800);
    return () => clearTimeout(timer);
  }, [data]);
  return flashing;
}

function QueueRow({
  incident,
  rank,
  now,
  selected,
  flashing,
  onSelect,
}: {
  incident: IncidentDTO;
  rank: number;
  now: Date;
  selected: boolean;
  flashing: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.li
      layout="position"
      variants={listItem}
      initial="hidden"
      animate="show"
      exit="exit"
      transition={spring.layout}
      className="relative"
    >
      <button
        onClick={onSelect}
        className={cn(
          'group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border p-2.5 text-left transition-colors',
          selected ? 'border-accent/50 bg-accent/10' : 'border-transparent hover:border-line hover:bg-surface-hover',
        )}
      >
        <AnimatePresence>
          {flashing && (
            <motion.span
              initial={{ opacity: 0.55 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.scene * 1.4 }}
              className="pointer-events-none absolute inset-0"
              style={{ background: levelVar(incident.priorityLevel) }}
            />
          )}
        </AnimatePresence>
        <span className="w-4 text-right font-mono text-[10px] text-faint">{rank}</span>
        <CategoryTile category={incident.category} level={incident.priorityLevel} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-muted">{incident.code}</span>
            <LevelBadge level={incident.priorityLevel} escalated={incident.escalationSteps || undefined} />
            {incident.clusterSize > 1 && (
              <span className="flex items-center gap-0.5 rounded-full bg-accent/12 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                <Icon icon={Icons.merge} size={10} />
                {incident.clusterSize}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[13px]">{incident.description}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="truncate text-[11px] text-faint">
              {incident.space.name}, {incident.space.block.name.split('·')[0].trim()}
            </span>
            <span className="ml-auto h-1 w-14 shrink-0 overflow-hidden rounded-full bg-surface">
              <motion.span
                className="block h-full rounded-full"
                style={{ background: levelVar(incident.priorityLevel) }}
                initial={false}
                animate={{ width: `${incident.priorityScore}%` }}
                transition={spring.gentle}
              />
            </span>
            <span className="w-8 text-right font-mono text-[10px] text-muted">{incident.priorityScore.toFixed(0)}</span>
          </div>
        </div>
        <SlaRing incident={incident} now={now} />
      </button>
    </motion.li>
  );
}
