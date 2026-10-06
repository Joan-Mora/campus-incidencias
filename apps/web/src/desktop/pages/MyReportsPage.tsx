import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { CATEGORY_LABELS, type IncidentDTO, type TransitionRule } from '@campus/shared';
import { useMobileUrl } from '../../core/device/mobileUrl';
import { setViewOverride } from '../../core/device/viewMode';
import { listItem, stagger } from '../../core/motion';
import { useCurrentUser } from '../../features/auth/api';
import { useIncidents } from '../../features/incidents/api';
import { CategoryTile, LevelBadge } from '../../features/incidents/badges';
import { StatusProgress } from '../../features/workflow/StatusProgress';
import { transitionsFor, useTransition } from '../../features/workflow/api';
import { useTwin } from '../../scenes/twinStore';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { Icons } from '../../ui/icons';
import { Panel } from '../../ui/Panel';
import { QrCode } from '../../ui/QrCode';
import { Segmented } from '../../ui/Segmented';
import { Skeleton } from '../../ui/Skeleton';
import { DetailDrawer } from '../components/DetailDrawer';
import { needsDialog, TransitionDialog } from '../components/TransitionDialog';

const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function MyReportsPage() {
  const user = useCurrentUser();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const query = useIncidents({ mine: true, status: filter === 'open' ? 'PENDING,IN_PROGRESS,RESOLVED' : undefined });
  const [dialog, setDialog] = useState<{ incident: IncidentDTO; rule: TransitionRule } | null>(null);
  const transition = useTransition();
  const select = useTwin((state) => state.select);
  const mobileUrl = useMobileUrl();

  const run = (incident: IncidentDTO, rule: TransitionRule) => {
    if (needsDialog(rule, user?.role)) return setDialog({ incident, rule });
    transition.mutate({ incidentId: incident.id, to: rule.to }, { onError: (error) => toast.error(error.message) });
  };

  const waiting = query.data?.filter((incident) => incident.status === 'RESOLVED' && transitionsFor(user, incident).length > 0).length ?? 0;

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_300px] gap-5 p-5">
        <div className="flex flex-col gap-4">
          <header className="flex items-end gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold">Mis reportes</h1>
              <p className="text-sm text-muted">
                {waiting > 0 ? `${waiting} ${waiting === 1 ? 'arreglo espera' : 'arreglos esperan'} tu confirmación.` : 'Sigue el estado de cada daño que reportaste.'}
              </p>
            </div>
            <Segmented
              size="sm"
              className="ml-auto"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'open', label: 'En curso' },
                { value: 'all', label: 'Todos' },
              ]}
            />
          </header>

          {query.isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-36 w-full rounded-3xl" />
              ))}
            </div>
          ) : !query.data?.length ? (
            <EmptyState icon={Icons.inbox} illustration="campus" title="Aún no tienes reportes" description="Reporta un daño desde el celular: escanea el QR del salón y marca el punto exacto." className="mt-8" />
          ) : (
            <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {query.data.map((incident) => {
                  const rules = transitionsFor(user, incident);
                  return (
                    <motion.div key={incident.id} layout variants={listItem} exit="exit">
                      <Panel className="p-5">
                        <div className="flex items-start gap-3">
                          <CategoryTile category={incident.category} level={incident.priorityLevel} size="lg" />
                          <button className="min-w-0 flex-1 text-left" onClick={() => select(incident.id)}>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs text-muted">{incident.code}</span>
                              <LevelBadge level={incident.priorityLevel} />
                              {!incident.isClusterPrimary && incident.clusterId && (
                                <span className="flex items-center gap-1 rounded-full bg-accent/12 px-1.5 py-0.5 text-[10px] text-accent">
                                  <Icon icon={Icons.merge} size={10} />
                                  Sumado a otro reporte
                                </span>
                              )}
                            </div>
                            <h3 className="mt-1 font-medium">{CATEGORY_LABELS[incident.category]}</h3>
                            <p className="line-clamp-2 text-sm text-muted">{incident.description}</p>
                            <p className="mt-1 text-[11px] text-faint">
                              {incident.space.name}, {incident.space.block.name}, {dateFormat.format(new Date(incident.createdAt))}
                            </p>
                          </button>
                          <div className="flex shrink-0 flex-col gap-2">
                            {rules.map((rule) => (
                              <Button
                                key={rule.to}
                                size="sm"
                                variant={rule.to === 'VERIFIED' ? 'success' : 'secondary'}
                                icon={rule.to === 'VERIFIED' ? Icons.checkAll : Icons.reopen}
                                onClick={() => run(incident, rule)}
                              >
                                {rule.to === 'VERIFIED' ? 'Confirmar arreglo' : 'No quedó bien'}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4">
                          <StatusProgress status={incident.status} />
                        </div>
                      </Panel>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        <aside className="flex flex-col gap-3">
          <Panel className="flex flex-col items-center gap-3 p-5 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/12 text-accent">
              <Icon icon={Icons.mobile} />
            </span>
            <h2 className="font-display font-semibold">Reporta desde el celular</h2>
            <p className="text-xs text-muted">Escanea este código para abrir la app de campo con cámara, QR del salón y el salón en 3D.</p>
            <QrCode value={mobileUrl} size={150} />
            <Button size="sm" variant="ghost" icon={Icons.mobile} onClick={() => setViewOverride('mobile')}>
              Ver la app móvil aquí
            </Button>
          </Panel>
        </aside>
      </div>
      </div>

      <DetailDrawer />
      <TransitionDialog incident={dialog?.incident ?? null} rule={dialog?.rule ?? null} onClose={() => setDialog(null)} />
    </div>
  );
}
