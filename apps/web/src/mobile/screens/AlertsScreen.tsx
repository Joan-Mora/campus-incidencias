import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { levelVar } from '../../core/theme/levels';
import { listItem, stagger } from '../../core/motion';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { Icons, STATUS_ICONS, type LucideIcon } from '../../ui/icons';
import { useAlerts, type MobileAlert } from '../alerts';
import { useMobileNav } from '../navStore';

const KIND_ICON: Record<MobileAlert['kind'], LucideIcon> = {
  status: Icons.bell,
  created: Icons.plus,
  escalated: Icons.alarm,
  warning: Icons.timer,
};

const time = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function AlertsScreen() {
  const { items, markAllRead, clear } = useAlerts();
  const openIncident = useMobileNav((state) => state.openIncident);

  useEffect(() => {
    const timer = setTimeout(markAllRead, 1200);
    return () => clearTimeout(timer);
  }, [items.length, markAllRead]);

  return (
    <div className="flex flex-col gap-4 px-5 pb-28">
      <header className="flex items-end pt-2">
        <div>
          <h1 className="font-display text-2xl font-semibold">Avisos</h1>
          <p className="text-sm text-muted">Cambios en tus reportes y en el campus.</p>
        </div>
        {items.length > 0 && (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={clear}>
            Limpiar
          </Button>
        )}
      </header>

      {!items.length ? (
        <EmptyState icon={Icons.bell} title="Sin avisos" description="Aquí verás cuando un técnico tome tu reporte, lo resuelva o cuando algo urgente pase en el campus." className="mt-6" />
      ) : (
        <motion.div variants={stagger(0.03)} initial="hidden" animate="show" className="flex flex-col gap-2">
          {items.map((item) => {
            const tone = item.level ? levelVar(item.level) : 'var(--accent)';
            return (
              <motion.button key={item.id} variants={listItem} whileTap={{ scale: 0.98 }} onClick={() => openIncident(item.incidentId)} className="glass relative flex items-start gap-3 rounded-2xl p-3.5 text-left">
                {!item.read && <span className="absolute top-3.5 right-3.5 h-2 w-2 rounded-full bg-accent" />}
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}>
                  <Icon icon={item.status ? STATUS_ICONS[item.status] : KIND_ICON[item.kind]} size="sm" />
                </span>
                <span className="min-w-0 flex-1 pr-4">
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="block text-xs text-muted">{item.body}</span>
                  <span className="mt-1 block text-[10px] text-faint">{time.format(item.at)}</span>
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
