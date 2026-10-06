import { motion } from 'framer-motion';
import { PRIORITY_LABELS, PRIORITY_LEVELS } from '@campus/shared';
import { listItem, stagger } from '../../core/motion';
import { levelVar } from '../../core/theme/levels';
import { useOverdue, useSummary, useTopSpaces } from '../../features/dashboard/api';
import { CategoryTile } from '../../features/incidents/badges';
import { useTwin } from '../../scenes/twinStore';
import { AnimatedNumber } from '../../ui/AnimatedNumber';
import { Gauge } from '../../ui/Gauge';
import { Icon } from '../../ui/Icon';
import { Icons, type LucideIcon } from '../../ui/icons';
import { Skeleton } from '../../ui/Skeleton';

export function KpiPanel() {
  const summary = useSummary();
  const overdue = useOverdue();
  const top = useTopSpaces();
  const select = useTwin((state) => state.select);
  const data = summary.data;
  const totalOpen = data ? Math.max(1, Object.values(data.byLevel).reduce((sum, value) => sum + value, 0)) : 1;
  const compliance = data?.slaCompliance == null ? null : Math.round(data.slaCompliance * 100);

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="flex flex-col gap-5 p-5">
      <motion.div variants={listItem} className="flex items-center gap-2">
        <Icon icon={Icons.activity} size="sm" className="text-accent" />
        <h2 className="font-display text-sm font-semibold">Pulso del campus</h2>
      </motion.div>

      {!data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <motion.div variants={listItem} className="grid grid-cols-2 gap-2">
            <Stat icon={Icons.inbox} label="Abiertas" value={data.open} />
            <Stat icon={Icons.alarm} label="Vencidas" value={data.overdue} tone={data.overdue ? 'var(--level-critical)' : undefined} />
            <Stat icon={Icons.wrench} label="En proceso" value={data.inProgress} />
            <Stat icon={Icons.checkAll} label="Resueltas hoy" value={data.resolvedToday} tone="var(--level-low)" />
          </motion.div>

          <motion.div variants={listItem} className="flex flex-col items-center rounded-2xl border border-line bg-surface p-4">
            <Gauge
              value={compliance ?? 0}
              size={200}
              color={compliance == null ? 'var(--text-faint)' : compliance >= 85 ? 'var(--level-low)' : compliance >= 60 ? 'var(--level-high)' : 'var(--level-critical)'}
              decimals={0}
              suffix=" %"
              label={compliance == null ? 'Sin datos' : undefined}
              caption="Cumplimiento de SLA"
            />
          </motion.div>

          <motion.div variants={listItem}>
            <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Abiertas por prioridad</p>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface">
              {[...PRIORITY_LEVELS].reverse().map((level) => (
                <motion.span
                  key={level}
                  initial={{ width: 0 }}
                  animate={{ width: `${(data.byLevel[level] / totalOpen) * 100}%` }}
                  style={{ background: levelVar(level) }}
                  title={`${PRIORITY_LABELS[level]}: ${data.byLevel[level]}`}
                />
              ))}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {[...PRIORITY_LEVELS].reverse().map((level) => (
                <div key={level} className="text-center">
                  <div className="tabular font-mono text-sm" style={{ color: levelVar(level) }}>
                    {data.byLevel[level]}
                  </div>
                  <div className="text-[10px] text-faint">{PRIORITY_LABELS[level]}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}

      {Boolean(overdue.data?.length) && (
        <motion.div variants={listItem}>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-level-critical uppercase">
            <Icon icon={Icons.alarm} size={12} />
            Vencidas
          </p>
          <div className="flex flex-col gap-1">
            {overdue.data!.slice(0, 5).map((incident) => (
              <button
                key={incident.id}
                onClick={() => select(incident.id)}
                className="flex items-center gap-2.5 rounded-xl border border-level-critical/25 bg-level-critical/6 p-2 text-left transition-colors hover:bg-level-critical/12"
              >
                <CategoryTile category={incident.category} level={incident.priorityLevel} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[11px] text-muted">{incident.code}</span>
                  <span className="block truncate text-xs">{incident.space.name}</span>
                </span>
                <Icon icon={Icons.chevronRight} size="sm" className="text-faint" />
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {Boolean(top.data?.length) && (
        <motion.div variants={listItem}>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Espacios con más reportes</p>
          <div className="flex flex-col gap-1.5">
            {top.data!.slice(0, 5).map((space, index) => (
              <div key={space.spaceId} className="flex items-center gap-2.5">
                <span className="w-4 font-mono text-[10px] text-faint">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{space.spaceName}</span>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface">
                    <motion.span
                      className="block h-full rounded-full bg-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${(space.total / top.data![0].total) * 100}%` }}
                    />
                  </span>
                </span>
                <span className="tabular font-mono text-xs text-muted">{space.total}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function Stat({ icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted">
        <Icon icon={icon} size={12} />
        {label}
      </div>
      <AnimatedNumber value={value} className="mt-1 block font-display text-2xl font-semibold" />
      {tone && <span className="mt-1.5 block h-0.5 w-6 rounded-full" style={{ background: tone }} />}
    </div>
  );
}
