import { useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { toast } from 'sonner';
import type { IncidentDTO } from '@campus/shared';
import { haptic } from '../../core/device/viewMode';
import { listItem, spring, stagger } from '../../core/motion';
import { useCurrentUser } from '../../features/auth/api';
import { useIncidents } from '../../features/incidents/api';
import { CategoryTile, LevelBadge, SlaRing } from '../../features/incidents/badges';
import { useNow } from '../../features/incidents/sla';
import { transitionsFor, useTransition } from '../../features/workflow/api';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { Icons } from '../../ui/icons';
import { Segmented } from '../../ui/Segmented';
import { Skeleton } from '../../ui/Skeleton';
import { useMobileNav } from '../navStore';

type Scope = 'pending' | 'mine' | 'verify';

const SWIPE_THRESHOLD = 110;

/** Bandeja de campo: deslizar a la derecha toma el caso o abre el cierre con evidencia. */
export function InboxScreen() {
  const user = useCurrentUser();
  const isTech = user?.role === 'TECHNICIAN';
  const [scope, setScope] = useState<Scope>('pending');
  const now = useNow(1000);
  const { openIncident } = useMobileNav();
  const transition = useTransition();

  const filters =
    scope === 'pending'
      ? { status: 'PENDING' }
      : scope === 'mine'
        ? { status: 'IN_PROGRESS', assignedToMe: isTech || undefined }
        : { status: 'RESOLVED' };
  const query = useIncidents({ ...filters, limit: 100 });

  const onSwipe = (incident: IncidentDTO) => {
    const rules = transitionsFor(user, incident);
    const take = rules.find((rule) => rule.from === 'PENDING' && rule.to === 'IN_PROGRESS');
    if (take && isTech) {
      haptic([12, 50, 12]);
      transition.mutate(
        { incidentId: incident.id, to: 'IN_PROGRESS' },
        { onSuccess: () => toast.success(`Tomaste ${incident.code}`), onError: (error) => toast.error(error.message) },
      );
      return;
    }
    openIncident(incident.id);
  };

  const hint =
    scope === 'pending' ? (isTech ? 'Desliza a la derecha para tomar el caso' : 'Desliza para asignar un técnico') : scope === 'mine' ? 'Desliza para cerrar con la foto del arreglo' : 'Desliza para verificar el arreglo';

  return (
    <div className="flex flex-col gap-4 px-5 pb-28">
      <header className="pt-2">
        <h1 className="font-display text-2xl font-semibold">Bandeja</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <Icon icon={Icons.arrowRight} size={12} />
          {hint}
        </p>
      </header>
      <Segmented
        value={scope}
        onChange={setScope}
        className="w-full [&>button]:flex-1"
        options={[
          { value: 'pending', label: 'Por tomar' },
          { value: 'mine', label: isTech ? 'Mis casos' : 'En proceso' },
          { value: 'verify', label: 'Por verificar' },
        ]}
      />

      {query.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-3xl" />
          ))}
        </div>
      ) : !query.data?.length ? (
        <EmptyState icon={Icons.checkAll} illustration="check" title="Bandeja limpia" description="No hay casos en esta lista por ahora." className="mt-6" />
      ) : (
        <motion.ul variants={stagger(0.04)} initial="hidden" animate="show" className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {query.data.map((incident) => (
              <SwipeCard key={incident.id} incident={incident} now={now} swipeable={transitionsFor(user, incident).length > 0} onSwipe={() => onSwipe(incident)} onOpen={() => openIncident(incident.id)} />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}

function SwipeCard({ incident, now, swipeable, onSwipe, onOpen }: { incident: IncidentDTO; now: Date; swipeable: boolean; onSwipe: () => void; onOpen: () => void }) {
  const x = useMotionValue(0);
  const reveal = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const iconScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.6, 1.1]);
  const [armed, setArmed] = useState(false);
  const dragged = useRef(false);
  const open = incident.status === 'PENDING' || incident.status === 'IN_PROGRESS';
  const actionIcon = incident.status === 'PENDING' ? Icons.wrench : incident.status === 'IN_PROGRESS' ? Icons.fix : Icons.checkAll;

  const onDrag = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 6) dragged.current = true;
    const next = info.offset.x > SWIPE_THRESHOLD;
    if (next !== armed) {
      setArmed(next);
      if (next) haptic(8);
    }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setArmed(false);
    if (info.offset.x > SWIPE_THRESHOLD) onSwipe();
    setTimeout(() => (dragged.current = false), 0);
  };

  return (
    <motion.li layout variants={listItem} exit={{ opacity: 0, x: 200 }} transition={spring.layout} className="relative">
      {swipeable && (
        <motion.div style={{ opacity: reveal }} className="absolute inset-0 flex items-center rounded-3xl bg-level-low/20 pl-6 text-level-low">
          <motion.span style={{ scale: iconScale }}>
            <Icon icon={actionIcon} size={26} />
          </motion.span>
        </motion.div>
      )}
      <motion.div
        drag={swipeable ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.7 }}
        dragSnapToOrigin
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        style={{ x, touchAction: 'pan-y' }}
        role="button"
        tabIndex={0}
        onClick={() => !dragged.current && onOpen()}
        onKeyDown={(event) => event.key === 'Enter' && onOpen()}
        className="glass-strong relative flex items-center gap-3 rounded-3xl p-3.5"
      >
        <CategoryTile category={incident.category} level={incident.priorityLevel} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-muted">{incident.code}</span>
            <LevelBadge level={incident.priorityLevel} escalated={incident.escalationSteps || undefined} />
          </div>
          <p className="mt-0.5 truncate text-sm">{incident.description}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-faint">
            <Icon icon={Icons.pin} size={10} />
            {incident.space.name}, piso {incident.space.floor}
            {incident.hotspot && (
              <>
                <Icon icon={Icons.crosshair} size={10} className="ml-1 text-accent" />
                punto marcado
              </>
            )}
          </p>
        </div>
        {open && <SlaRing incident={incident} now={now} size={36} />}
      </motion.div>
    </motion.li>
  );
}
