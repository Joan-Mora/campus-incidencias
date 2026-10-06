import { useCallback, useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { toast } from 'sonner';
import { ROLE_LABELS } from '@campus/shared';
import { queryClient } from '../core/api/queryClient';
import { haptic, setViewOverride } from '../core/device/viewMode';
import { spring, transition, wizardStep } from '../core/motion';
import { useOfflineSync, useOnline } from '../core/offline/queue';
import { useRealtimeStatus } from '../core/realtime/realtime';
import { useResolvedTheme, useUi } from '../core/theme/store';
import { useCurrentUser, useLogout } from '../features/auth/api';
import { useIncidents } from '../features/incidents/api';
import { BrandMark } from '../ui/BrandMark';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';
import { Icon } from '../ui/Icon';
import { Icons, ROLE_ICONS, type LucideIcon } from '../ui/icons';
import { Sheet } from '../ui/Sheet';
import { useAlertWatcher, useUnreadAlerts } from './alerts';
import { NAV_STORAGE_KEY, useMobileNav, type MobileTab } from './navStore';
import { ReportWizard } from './report/ReportWizard';
import { AlertsScreen } from './screens/AlertsScreen';
import { IncidentSheet } from './screens/IncidentSheet';
import { InboxScreen } from './screens/InboxScreen';
import { MyReportsScreen } from './screens/MyReportsScreen';

const TAB_META: Record<MobileTab, { label: string; icon: LucideIcon }> = {
  inbox: { label: 'Bandeja', icon: Icons.inbox },
  report: { label: 'Reportar', icon: Icons.plus },
  mine: { label: 'Mis reportes', icon: Icons.history },
  alerts: { label: 'Avisos', icon: Icons.bell },
};

const STAFF_TABS: MobileTab[] = ['inbox', 'report', 'mine', 'alerts'];
const STUDENT_TABS: MobileTab[] = ['report', 'mine', 'alerts'];

const PULL_TRIGGER = 72;

export function MobileShell() {
  const user = useCurrentUser()!;
  const staff = user.role !== 'STUDENT';
  const tabs = staff ? STAFF_TABS : STUDENT_TABS;
  const { tab, direction, setTab, setPendingQr } = useMobileNav();
  const unread = useUnreadAlerts();
  const pending = useIncidents({ status: 'PENDING', limit: 100 }, { enabled: staff });
  const online = useOnline();
  const realtime = useRealtimeStatus((state) => state.status);
  const [menuOpen, setMenuOpen] = useState(false);
  const scroller = useRef<HTMLElement>(null);

  useAlertWatcher(user.role);
  useOfflineSync(useCallback((count: number) => toast.success(count === 1 ? 'Se envió el reporte guardado' : `Se enviaron ${count} reportes guardados`), []));

  const entryHandled = useRef(false);
  useEffect(() => {
    if (entryHandled.current) return;
    entryHandled.current = true;
    const url = new URL(window.location.href);
    const qr = url.searchParams.get('qr');
    if (qr) {
      setPendingQr(qr);
      setTab('report');
      url.searchParams.delete('qr');
      window.history.replaceState(null, '', url);
    } else if (staff && !sessionStorage.getItem(NAV_STORAGE_KEY)) {
      setTab('inbox');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0]!);
  }, [tab, tabs, setTab]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [tab]);

  const screens: Record<MobileTab, ReactNode> = {
    inbox: <InboxScreen />,
    report: <ReportWizard />,
    mine: <MyReportsScreen />,
    alerts: <AlertsScreen />,
  };

  const badge = (item: MobileTab) => (item === 'alerts' ? unread : item === 'inbox' ? (pending.data?.length ?? 0) : 0);

  return (
    <div className="aurora fixed inset-0 flex flex-col bg-bg">
      <header className="safe-top relative z-30 flex items-center gap-3 px-5 pt-2 pb-2">
        <BrandMark size={30} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name.split(' ')[0]}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className={cn('h-1.5 w-1.5 rounded-full', !online ? 'bg-level-high' : realtime === 'online' ? 'bg-level-low' : 'bg-faint')} />
            {!online ? 'Sin conexión' : realtime === 'online' ? 'En vivo' : 'Conectando'}
          </p>
        </div>
        <Button size="icon" variant="ghost" icon={ROLE_ICONS[user.role]} onClick={() => setMenuOpen(true)} aria-label="Menú de cuenta" />
      </header>

      <AnimatePresence>
        {!online && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="relative z-30 overflow-hidden">
            <p className="mx-5 mb-2 flex items-center gap-2 rounded-2xl bg-level-high/15 px-3 py-2 text-xs text-level-high">
              <Icon icon={Icons.wifiOff} size={14} />
              Sin señal: puedes seguir reportando, se enviará después.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <PullToRefresh scroller={scroller} enabled={tab !== 'report'}>
        <main ref={scroller} className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div key={tab} custom={direction} variants={wizardStep} initial="enter" animate="center" exit="leave" className="min-h-full">
              {screens[tab]}
            </motion.div>
          </AnimatePresence>
        </main>
      </PullToRefresh>

      <nav className="safe-bottom glass-strong fixed inset-x-3 bottom-3 z-40 rounded-[26px] px-2 pt-2 pb-2">
        <div className="flex">
          {tabs.map((item) => {
            const active = item === tab;
            const count = badge(item);
            const meta = TAB_META[item];
            return (
              <button
                key={item}
                onClick={() => {
                  haptic(6);
                  setTab(item);
                }}
                className="relative flex flex-1 flex-col items-center gap-0.5 py-1.5"
                aria-current={active ? 'page' : undefined}
              >
                {active && <motion.span layoutId="mobile-tab" transition={spring.snappy} className="absolute inset-0 rounded-2xl bg-accent/14" />}
                <span className={cn('relative', item === 'report' && !active && 'text-accent')}>
                  <Icon icon={meta.icon} className={active ? 'text-accent' : item === 'report' ? '' : 'text-muted'} />
                  {count > 0 && (
                    <motion.span
                      key={count}
                      initial={{ scale: 0.4 }}
                      animate={{ scale: 1 }}
                      transition={spring.bouncy}
                      className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-level-critical px-1 text-center font-mono text-[9px] leading-4 text-white"
                    >
                      {count > 99 ? '99' : count}
                    </motion.span>
                  )}
                </span>
                <span className={cn('relative text-[10px] font-medium', active ? 'text-fg' : 'text-muted')}>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <IncidentSheet />
      <AccountSheet open={menuOpen} onOpenChange={setMenuOpen} />
    </div>
  );
}

function AccountSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const user = useCurrentUser()!;
  const logout = useLogout();
  const theme = useResolvedTheme();
  const toggleTheme = useUi((state) => state.toggleTheme);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={user.name} description={`${ROLE_LABELS[user.role]}, ${user.email}`}>
      <div className="flex flex-col gap-2 pt-2">
        <Button size="lg" variant="secondary" icon={theme === 'dark' ? Icons.sun : Icons.moon} onClick={toggleTheme} className="justify-start">
          {theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
        </Button>
        <Button size="lg" variant="secondary" icon={Icons.desktop} onClick={() => setViewOverride('desktop')} className="justify-start">
          Ver versión de escritorio
        </Button>
        <Button size="lg" variant="danger" icon={Icons.logout} onClick={logout} className="justify-start">
          Cerrar sesión
        </Button>
      </div>
    </Sheet>
  );
}

/** Tirar hacia abajo desde arriba del todo vuelve a pedir los datos visibles. */
function PullToRefresh({ scroller, enabled, children }: { scroller: React.RefObject<HTMLElement | null>; enabled: boolean; children: ReactNode }) {
  const pull = useMotionValue(0);
  const rotate = useTransform(pull, [0, PULL_TRIGGER], [0, 270]);
  const opacity = useTransform(pull, [0, PULL_TRIGGER * 0.5, PULL_TRIGGER], [0, 0.6, 1]);
  const start = useRef<number | null>(null);
  const armed = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (event: TouchEvent) => {
    if (!enabled || refreshing || (scroller.current?.scrollTop ?? 0) > 0) return;
    start.current = event.touches[0].clientY;
  };
  const onTouchMove = (event: TouchEvent) => {
    if (start.current == null) return;
    const distance = Math.max(0, event.touches[0].clientY - start.current);
    pull.set(Math.min(PULL_TRIGGER * 1.4, distance * 0.5));
    const next = pull.get() >= PULL_TRIGGER;
    if (next && !armed.current) haptic(8);
    armed.current = next;
  };
  const onTouchEnd = async () => {
    if (start.current == null) return;
    start.current = null;
    if (armed.current) {
      armed.current = false;
      setRefreshing(true);
      animate(pull, PULL_TRIGGER * 0.8, transition.base);
      await queryClient.refetchQueries({ type: 'active' });
      setRefreshing(false);
    }
    animate(pull, 0, spring.gentle);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <motion.div style={{ height: pull, opacity }} className="flex shrink-0 items-end justify-center overflow-hidden">
        <motion.span style={{ rotate }} className={cn('mb-2 text-accent', refreshing && 'animate-spin')}>
          <Icon icon={Icons.refresh} />
        </motion.span>
      </motion.div>
      {children}
    </div>
  );
}
