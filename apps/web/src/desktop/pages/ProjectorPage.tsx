import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PRIORITY_LABELS, type PriorityLevel } from '@campus/shared';
import { useMobileUrl } from '../../core/device/mobileUrl';
import { setViewOverride } from '../../core/device/viewMode';
import { listItem, slideFromEdge, spring } from '../../core/motion';
import { useRealtimeListener } from '../../core/realtime/realtime';
import { levelVar } from '../../core/theme/levels';
import { useSummary } from '../../features/dashboard/api';
import { useIncidents } from '../../features/incidents/api';
import { CategoryTile, SlaRing } from '../../features/incidents/badges';
import { useNow } from '../../features/incidents/sla';
import { useTwin } from '../../scenes/twinStore';
import { AnimatedNumber } from '../../ui/AnimatedNumber';
import { BrandMark } from '../../ui/BrandMark';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Icons, type LucideIcon } from '../../ui/icons';
import { QrCode } from '../../ui/QrCode';
import { TwinStage } from '../components/TwinStage';

interface TickerItem {
  id: string;
  icon: LucideIcon;
  text: string;
  level?: PriorityLevel;
  at: Date;
}

const clockFormat = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Pantalla grande para la sustentación: el campus gira solo y cada reporte nuevo se ve llegar. */
export default function ProjectorPage() {
  const now = useNow(1000);
  const summary = useSummary();
  const queue = useIncidents({ status: 'PENDING,IN_PROGRESS', limit: 6 });
  const mobileUrl = useMobileUrl();
  const select = useTwin((state) => state.select);
  const [ticker, setTicker] = useState<TickerItem[]>([]);
  const focusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setViewOverride('desktop');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => () => clearTimeout(focusTimer.current), []);

  useRealtimeListener((message) => {
    let item: TickerItem | null = null;
    if (message.type === 'incident.created') {
      item = { id: `${message.payload.incidentId}-c`, icon: Icons.plus, text: `Nuevo reporte ${message.payload.code}`, level: message.payload.level, at: new Date() };
      clearTimeout(focusTimer.current);
      focusTimer.current = setTimeout(() => {
        select(message.payload.incidentId);
        focusTimer.current = setTimeout(() => select(null), 7000);
      }, 1500);
    } else if (message.type === 'incident.escalated') {
      item = { id: `${message.payload.incidentId}-e-${Date.now()}`, icon: Icons.alarm, text: `${message.payload.code} venció su SLA y subió a ${PRIORITY_LABELS[message.payload.level]}`, level: message.payload.level, at: new Date() };
    } else if (message.type === 'incident.warning') {
      item = { id: `${message.payload.incidentId}-w-${Date.now()}`, icon: Icons.timer, text: `${message.payload.code} consumió el 80 % de su plazo`, level: 'HIGH', at: new Date() };
    }
    if (item) setTicker((current) => [item!, ...current].slice(0, 6));
  });

  const data = summary.data;
  const compliance = data?.slaCompliance == null ? null : Math.round(data.slaCompliance * 100);

  return (
    <div className="aurora relative h-dvh w-screen overflow-hidden bg-bg text-fg">
      <div className="absolute inset-0">
        <TwinStage autoRotate controls={false} />
      </div>

      <header className="pointer-events-none absolute inset-x-6 top-6 flex items-start justify-between">
        <div className="glass-strong pointer-events-auto flex items-center gap-4 rounded-3xl px-5 py-4">
          <BrandMark size={44} />
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">El Campus También Se Daña</h1>
            <p className="text-sm text-muted">Gemelo digital en vivo, UNIMINUTO</p>
          </div>
        </div>
        <div className="glass-strong pointer-events-auto flex items-center gap-3 rounded-3xl px-5 py-4">
          <span className="tabular font-mono text-2xl">{clockFormat.format(now)}</span>
          <Button size="icon-sm" variant="ghost" icon={Icons.minimize} onClick={() => setViewOverride('desktop')} aria-label="Salir del modo proyector" />
        </div>
      </header>

      <motion.aside variants={slideFromEdge('right')} initial="hidden" animate="show" className="absolute top-32 right-6 bottom-6 flex w-[400px] flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <BigStat label="Abiertas" value={data?.open ?? 0} />
          <BigStat label="Vencidas" value={data?.overdue ?? 0} tone="var(--level-critical)" />
          <BigStat label="SLA" value={compliance ?? 0} suffix=" %" tone="var(--level-low)" />
        </div>

        <div className="glass-strong flex min-h-0 flex-1 flex-col rounded-3xl p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-muted uppercase">
            <Icon icon={Icons.queue} size={14} />
            Lo más urgente
          </p>
          <motion.ul layout className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {queue.data?.slice(0, 6).map((incident) => (
                <motion.li key={incident.id} layout variants={listItem} initial="hidden" animate="show" exit="exit" transition={spring.layout} className="flex items-center gap-3 rounded-2xl bg-surface p-2.5">
                  <CategoryTile category={incident.category} level={incident.priorityLevel} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs" style={{ color: levelVar(incident.priorityLevel) }}>
                      {incident.code} {PRIORITY_LABELS[incident.priorityLevel]}
                    </span>
                    <span className="block truncate text-sm">{incident.space.name}</span>
                  </span>
                  <SlaRing incident={incident} now={now} size={36} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        </div>

        <div className="glass-strong rounded-3xl p-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-muted uppercase">
            <Icon icon={Icons.activity} size={14} />
            En vivo
          </p>
          <div className="flex h-36 flex-col gap-1.5 overflow-hidden">
            <AnimatePresence initial={false}>
              {ticker.length === 0 ? (
                <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-faint">
                  Esperando reportes...
                </motion.p>
              ) : (
                ticker.map((item) => (
                  <motion.div key={item.id} layout initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2.5 text-sm">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg" style={{ background: item.level ? `color-mix(in srgb, ${levelVar(item.level)} 20%, transparent)` : undefined, color: item.level ? levelVar(item.level) : undefined }}>
                      <Icon icon={item.icon} size={13} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.text}</span>
                    <span className="font-mono text-[10px] text-faint">{clockFormat.format(item.at)}</span>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>

      <motion.div variants={slideFromEdge('left')} initial="hidden" animate="show" className="glass-strong absolute bottom-6 left-6 flex items-center gap-4 rounded-3xl p-4">
        <QrCode value={mobileUrl} size={120} />
        <div className="max-w-[200px]">
          <p className="font-display text-lg leading-tight font-semibold">Reporta un daño ahora</p>
          <p className="mt-1 text-sm text-muted">Escanea con el celular y míralo aparecer en el campus.</p>
        </div>
      </motion.div>
    </div>
  );
}

function BigStat({ label, value, suffix, tone }: { label: string; value: number; suffix?: string; tone?: string }) {
  return (
    <div className="glass-strong rounded-3xl p-4">
      <p className="text-xs text-muted">{label}</p>
      <AnimatedNumber value={value} suffix={suffix} className="mt-1 block font-display text-3xl font-semibold" />
      {tone && <span className="mt-2 block h-1 w-8 rounded-full" style={{ background: tone }} />}
    </div>
  );
}
