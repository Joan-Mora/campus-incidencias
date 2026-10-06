import { useMemo, useState, type DragEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { STATUS_FLOW, STATUS_LABELS, type IncidentDTO, type IncidentStatus, type TransitionRule } from '@campus/shared';
import { listItem, spring } from '../../core/motion';
import { levelVar } from '../../core/theme/levels';
import { useCurrentUser } from '../../features/auth/api';
import { useIncidents } from '../../features/incidents/api';
import { CategoryTile, LevelBadge, SlaRing } from '../../features/incidents/badges';
import { useNow } from '../../features/incidents/sla';
import { transitionsFor, useTransition } from '../../features/workflow/api';
import { useTwin } from '../../scenes/twinStore';
import { cn } from '../../ui/cn';
import { Icon } from '../../ui/Icon';
import { Icons, STATUS_ICONS } from '../../ui/icons';
import { Segmented } from '../../ui/Segmented';
import { Skeleton } from '../../ui/Skeleton';
import { DetailDrawer } from '../components/DetailDrawer';
import { needsDialog, TransitionDialog } from '../components/TransitionDialog';

const COLUMN_TONE: Record<IncidentStatus, string> = {
  PENDING: 'var(--level-high)',
  IN_PROGRESS: 'var(--level-medium)',
  RESOLVED: 'var(--accent)',
  VERIFIED: 'var(--level-low)',
};

/** Tablero por estado: al arrastrar se iluminan solo las columnas a las que tu rol puede mover el caso. */
export default function BoardPage() {
  const user = useCurrentUser();
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const mine = scope === 'mine' && user?.role === 'TECHNICIAN';
  const active = useIncidents({ status: 'PENDING,IN_PROGRESS,RESOLVED', limit: 300, assignedToMe: mine || undefined });
  const verified = useIncidents({ status: 'VERIFIED', limit: 40, assignedToMe: mine || undefined });
  const transition = useTransition();
  const { selectedId, select } = useTwin();
  const now = useNow(1000);

  const [dragging, setDragging] = useState<{ incident: IncidentDTO; rules: TransitionRule[] } | null>(null);
  const [hover, setHover] = useState<IncidentStatus | null>(null);
  const [pending, setPending] = useState<Record<string, IncidentStatus>>({});
  const [dialog, setDialog] = useState<{ incident: IncidentDTO; rule: TransitionRule } | null>(null);

  const columns = useMemo(() => {
    const map: Record<IncidentStatus, IncidentDTO[]> = { PENDING: [], IN_PROGRESS: [], RESOLVED: [], VERIFIED: [] };
    for (const incident of [...(active.data ?? []), ...(verified.data ?? [])]) {
      map[pending[incident.id] ?? incident.status].push(incident);
    }
    return map;
  }, [active.data, verified.data, pending]);

  const move = (incident: IncidentDTO, rule: TransitionRule) => {
    if (needsDialog(rule, user?.role)) return setDialog({ incident, rule });
    setPending((current) => ({ ...current, [incident.id]: rule.to }));
    transition.mutate(
      { incidentId: incident.id, to: rule.to },
      {
        onSuccess: () => toast.success(`${incident.code}: ${rule.label.toLowerCase()}`),
        onError: (error) => toast.error(error.message),
        onSettled: () =>
          setPending((current) => {
            const { [incident.id]: _, ...rest } = current;
            return rest;
          }),
      },
    );
  };

  const onDrop = (status: IncidentStatus) => {
    const rule = dragging?.rules.find((item) => item.to === status);
    if (dragging && rule) move(dragging.incident, rule);
    setDragging(null);
    setHover(null);
  };

  const loading = active.isLoading || verified.isLoading;

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex items-center gap-3 px-2 pt-1">
        <div>
          <h1 className="font-display text-xl font-semibold">Tablero de trabajo</h1>
          <p className="text-xs text-muted">Arrastra una tarjeta: solo se iluminan los estados a los que tu rol puede moverla.</p>
        </div>
        {user?.role === 'TECHNICIAN' && (
          <Segmented
            size="sm"
            className="ml-auto"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'all', label: 'Todo el campus', icon: Icons.map },
              { value: 'mine', label: 'Asignadas a mí', icon: Icons.user },
            ]}
          />
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-4 gap-3">
        {STATUS_FLOW.map((status) => {
          const valid = dragging?.rules.some((rule) => rule.to === status) ?? false;
          const rule = dragging?.rules.find((item) => item.to === status);
          const dimmed = dragging && !valid && dragging.incident.status !== status;
          return (
            <section
              key={status}
              onDragOver={(event: DragEvent) => {
                if (!valid) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setHover(status);
              }}
              onDragLeave={() => setHover((current) => (current === status ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                onDrop(status);
              }}
              className={cn(
                'glass relative flex min-h-0 flex-col overflow-hidden rounded-3xl border-2 transition-[opacity,border-color,box-shadow] duration-200',
                valid ? 'border-dashed' : 'border-transparent',
                dimmed && 'opacity-40',
              )}
              style={{
                borderColor: valid ? COLUMN_TONE[status] : undefined,
                boxShadow: hover === status ? `0 0 0 4px color-mix(in srgb, ${COLUMN_TONE[status]} 25%, transparent), 0 0 40px color-mix(in srgb, ${COLUMN_TONE[status]} 25%, transparent)` : undefined,
              }}
            >
              <header className="flex items-center gap-2 px-4 pt-4 pb-3">
                <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${COLUMN_TONE[status]} 18%, transparent)`, color: COLUMN_TONE[status] }}>
                  <Icon icon={STATUS_ICONS[status]} size="sm" />
                </span>
                <h2 className="text-sm font-semibold">{STATUS_LABELS[status]}</h2>
                <span className="ml-auto rounded-full bg-surface px-2 py-0.5 font-mono text-[11px] text-muted">{columns[status].length}</span>
              </header>

              <AnimatePresence>
                {valid && rule && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mx-3 mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium"
                    style={{ background: `color-mix(in srgb, ${COLUMN_TONE[status]} 14%, transparent)`, color: COLUMN_TONE[status] }}
                  >
                    <Icon icon={Icons.arrowRight} size={12} />
                    Soltar para {rule.label.toLowerCase()}
                    {rule.requires?.includes('fixEvidence') && <span className="ml-auto text-[10px] opacity-80">pide evidencia</span>}
                    {rule.requires?.includes('note') && <span className="ml-auto text-[10px] opacity-80">pide nota</span>}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                {loading ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 4 }, (_, index) => (
                      <Skeleton key={index} className="h-24 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : columns[status].length === 0 ? (
                  <p className="px-2 py-8 text-center text-xs text-faint">Sin casos en este estado</p>
                ) : (
                  <motion.ul layout className="flex flex-col gap-2">
                    <AnimatePresence initial={false}>
                      {columns[status].map((incident) => {
                        const rules = transitionsFor(user, incident);
                        return (
                          <BoardCard
                            key={incident.id}
                            incident={incident}
                            now={now}
                            draggable={rules.length > 0}
                            selected={incident.id === selectedId}
                            moving={Boolean(pending[incident.id])}
                            onSelect={() => select(incident.id)}
                            onDragStart={() => setDragging({ incident, rules })}
                            onDragEnd={() => {
                              setDragging(null);
                              setHover(null);
                            }}
                          />
                        );
                      })}
                    </AnimatePresence>
                  </motion.ul>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <DetailDrawer />

      <TransitionDialog incident={dialog?.incident ?? null} rule={dialog?.rule ?? null} onClose={() => setDialog(null)} />
    </div>
  );
}

function BoardCard({
  incident,
  now,
  draggable,
  selected,
  moving,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  incident: IncidentDTO;
  now: Date;
  draggable: boolean;
  selected: boolean;
  moving: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const open = incident.status === 'PENDING' || incident.status === 'IN_PROGRESS';
  return (
    <motion.li layout="position" variants={listItem} initial="hidden" animate="show" exit="exit" transition={spring.layout}>
      <div
        role="button"
        tabIndex={0}
        draggable={draggable}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', incident.id);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onClick={onSelect}
        onKeyDown={(event) => event.key === 'Enter' && onSelect()}
        className={cn(
          'group relative overflow-hidden rounded-2xl border bg-surface p-3 transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg',
          selected ? 'border-accent/60' : 'border-line',
          draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
          moving && 'animate-pulse',
          incident.isOverdue && 'border-level-critical/50',
        )}
      >
        <span className="absolute inset-y-0 left-0 w-1" style={{ background: levelVar(incident.priorityLevel) }} />
        <div className="flex items-start gap-2.5">
          <CategoryTile category={incident.category} level={incident.priorityLevel} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-muted">{incident.code}</span>
              <LevelBadge level={incident.priorityLevel} />
            </div>
            <p className="mt-1 line-clamp-2 text-[13px] leading-snug">{incident.description}</p>
          </div>
          {open && <SlaRing incident={incident} now={now} size={30} />}
        </div>
        <div className="mt-2.5 flex items-center gap-2 text-[11px] text-faint">
          <Icon icon={Icons.pin} size={11} />
          <span className="truncate">{incident.space.name}</span>
          {incident.clusterSize > 1 && (
            <span className="flex items-center gap-0.5 text-accent">
              <Icon icon={Icons.merge} size={11} />
              {incident.clusterSize}
            </span>
          )}
          {incident.assignee && (
            <span className="ml-auto flex items-center gap-1 truncate" title={incident.assignee.name}>
              <Icon icon={Icons.wrench} size={11} />
              {incident.assignee.name.split(' ')[0]}
            </span>
          )}
          {draggable && <Icon icon={Icons.grip} size={12} className={cn('opacity-0 transition-opacity group-hover:opacity-60', !incident.assignee && 'ml-auto')} />}
        </div>
      </div>
    </motion.li>
  );
}
