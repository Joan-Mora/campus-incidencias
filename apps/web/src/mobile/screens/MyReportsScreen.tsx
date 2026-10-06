import { AnimatePresence, motion } from 'framer-motion';
import { CATEGORY_LABELS, type IncidentDTO } from '@campus/shared';
import { listItem, stagger } from '../../core/motion';
import { useOfflineQueue } from '../../core/offline/queue';
import { useCurrentUser } from '../../features/auth/api';
import { useIncidents } from '../../features/incidents/api';
import { CategoryTile, LevelBadge } from '../../features/incidents/badges';
import { StatusProgress } from '../../features/workflow/StatusProgress';
import { transitionsFor } from '../../features/workflow/api';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { Icons } from '../../ui/icons';
import { Skeleton } from '../../ui/Skeleton';
import { useMobileNav } from '../navStore';

const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

function ago(iso: string | number) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return relative.format(hours, 'hour');
  return relative.format(Math.round(hours / 24), 'day');
}

export function MyReportsScreen() {
  const user = useCurrentUser();
  const query = useIncidents({ mine: true, limit: 100 });
  const queued = useOfflineQueue();
  const { openIncident, setTab } = useMobileNav();

  const toConfirm = (query.data ?? []).filter((incident) => incident.status === 'RESOLVED' && transitionsFor(user, incident).length > 0);
  const rest = (query.data ?? []).filter((incident) => !toConfirm.includes(incident));

  return (
    <div className="flex flex-col gap-4 px-5 pb-28">
      <header className="pt-2">
        <h1 className="font-display text-2xl font-semibold">Mis reportes</h1>
        <p className="text-sm text-muted">Cada cambio te llega como aviso.</p>
      </header>

      {queued.length > 0 && (
        <section className="flex flex-col gap-2">
          {queued.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-level-high/35 bg-level-high/8 p-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-level-high/15 text-level-high">
                <Icon icon={Icons.cloudOff} size="sm" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.spaceLabel}</span>
                <span className="block text-xs text-muted">En cola, se enviará al volver la señal</span>
              </span>
            </div>
          ))}
        </section>
      )}

      {toConfirm.length > 0 && (
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-level-low uppercase">
            <Icon icon={Icons.bellRing} size={12} />
            Esperan tu confirmación
          </p>
          <div className="flex flex-col gap-2">
            {toConfirm.map((incident) => (
              <ReportCard key={incident.id} incident={incident} highlight onOpen={() => openIncident(incident.id)} />
            ))}
          </div>
        </section>
      )}

      {query.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-3xl" />
          ))}
        </div>
      ) : !query.data?.length && !queued.length ? (
        <EmptyState
          icon={Icons.inbox}
          illustration="campus"
          title="Aún no has reportado nada"
          description="Si ves algo dañado en el campus, repórtalo en menos de un minuto."
          action={
            <Button variant="primary" icon={Icons.plus} onClick={() => setTab('report')}>
              Reportar un daño
            </Button>
          }
          className="mt-6"
        />
      ) : (
        <motion.div variants={stagger(0.04)} initial="hidden" animate="show" className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {rest.map((incident) => (
              <ReportCard key={incident.id} incident={incident} onOpen={() => openIncident(incident.id)} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

function ReportCard({ incident, highlight, onOpen }: { incident: IncidentDTO; highlight?: boolean; onOpen: () => void }) {
  return (
    <motion.button
      layout
      variants={listItem}
      whileTap={{ scale: 0.98 }}
      onClick={onOpen}
      className={highlight ? 'rounded-3xl border border-level-low/40 bg-level-low/8 p-4 text-left' : 'glass rounded-3xl p-4 text-left'}
    >
      <div className="flex items-start gap-3">
        <CategoryTile category={incident.category} level={incident.priorityLevel} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-muted">{incident.code}</span>
            <LevelBadge level={incident.priorityLevel} />
          </div>
          <p className="mt-0.5 font-medium">{CATEGORY_LABELS[incident.category]}</p>
          <p className="truncate text-xs text-muted">
            {incident.space.name}, {ago(incident.createdAt)}
          </p>
        </div>
        {!incident.isClusterPrimary && incident.clusterId && (
          <span className="flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-[10px] text-accent">
            <Icon icon={Icons.users} size={10} />
            Sumado
          </span>
        )}
      </div>
      <div className="mt-3">
        <StatusProgress status={incident.status} compact />
      </div>
    </motion.button>
  );
}
