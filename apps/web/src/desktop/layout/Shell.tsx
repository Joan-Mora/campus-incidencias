import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { PRIORITY_LABELS, ROLE_LABELS } from '@campus/shared';
import { setViewOverride } from '../../core/device/viewMode';
import { pageTransition, spring } from '../../core/motion';
import { useRealtimeListener, useRealtimeStatus } from '../../core/realtime/realtime';
import { useUi, useResolvedTheme } from '../../core/theme/store';
import { useCurrentUser, useLogout } from '../../features/auth/api';
import { useSuggestions } from '../../features/similarity/api';
import { useTwin } from '../../scenes/twinStore';
import { BrandMark } from '../../ui/BrandMark';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { Kbd } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Icons, ROLE_ICONS, type LucideIcon } from '../../ui/icons';
import { Tooltip } from '../../ui/Tooltip';
import { CommandPalette } from '../components/CommandPalette';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  staff?: boolean;
  student?: boolean;
  badge?: number;
}

export function Shell({ children }: { children: ReactNode }) {
  const user = useCurrentUser()!;
  const location = useLocation();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isStaff = user.role !== 'STUDENT';
  const suggestions = useSuggestions(isStaff);
  const select = useTwin((state) => state.select);

  const items: NavItem[] = [
    { to: '/', label: 'Centro de mando', icon: Icons.radar },
    { to: '/tablero', label: 'Tablero', icon: Icons.board, staff: true },
    { to: '/panel', label: 'Indicadores', icon: Icons.chart },
    { to: '/sugerencias', label: 'Sugerencias', icon: Icons.merge, staff: true, badge: suggestions.data?.length },
    { to: '/mis-reportes', label: 'Mis reportes', icon: Icons.inbox, student: true },
  ];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useRealtimeListener(
    (message) => {
      const open = (id: string) => {
        select(id);
        if (location.pathname !== '/') navigate('/');
      };
      if (message.type === 'incident.created') {
        toast(`Nuevo reporte ${message.payload.code}`, {
          description: `Prioridad ${PRIORITY_LABELS[message.payload.level].toLowerCase()}`,
          icon: <Icon icon={Icons.pin} size="sm" className="text-accent" />,
          action: { label: 'Ver', onClick: () => open(message.payload.incidentId) },
        });
      }
      if (message.type === 'incident.escalated') {
        toast.warning(`${message.payload.code} venció su SLA`, {
          description: `Sube a ${PRIORITY_LABELS[message.payload.level].toLowerCase()}`,
          icon: <Icon icon={Icons.alarm} size="sm" className="text-level-critical" />,
          action: { label: 'Ver', onClick: () => open(message.payload.incidentId) },
        });
      }
      if (message.type === 'incident.warning') {
        toast(`${message.payload.code} va al 80 % de su SLA`, { icon: <Icon icon={Icons.timer} size="sm" className="text-level-high" /> });
      }
      if (message.type === 'suggestion.created' && user.role === 'SUPERVISOR') {
        toast('Nueva sugerencia de agrupación', {
          icon: <Icon icon={Icons.merge} size="sm" className="text-accent" />,
          action: { label: 'Revisar', onClick: () => navigate('/sugerencias') },
        });
      }
    },
    [location.pathname, user.role],
  );

  return (
    <div className="aurora flex h-full">
      <nav className="relative z-20 flex w-[76px] shrink-0 flex-col items-center gap-2 border-r border-line py-4">
        <BrandMark size={40} />
        <div className="mt-6 flex flex-1 flex-col gap-1.5">
          {items
            .filter((item) => (!item.staff || isStaff) && (!item.student || !isStaff))
            .map((item) => (
              <Tooltip key={item.to} content={item.label} side="right">
                <NavLink to={item.to} end className="relative grid h-12 w-12 place-items-center rounded-2xl" aria-label={item.label}>
                  {({ isActive }) => (
                    <>
                      {isActive && <motion.span layoutId="nav-pill" transition={spring.snappy} className="absolute inset-0 rounded-2xl bg-accent/15 ring-1 ring-accent/40" />}
                      <Icon icon={item.icon} className={cn('relative transition-colors', isActive ? 'text-accent' : 'text-muted hover:text-fg')} />
                      {item.badge ? (
                        <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-level-critical px-1 font-mono text-[10px] font-bold text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              </Tooltip>
            ))}
        </div>
        <Tooltip content="Modo proyector" side="right">
          <Button variant="ghost" size="icon" icon={Icons.projector} onClick={() => setViewOverride('projector')} aria-label="Modo proyector" />
        </Tooltip>
        <Tooltip content="Ver la app de campo" side="right">
          <Button variant="ghost" size="icon" icon={Icons.mobile} onClick={() => setViewOverride('mobile')} aria-label="Ver la app de campo" />
        </Tooltip>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenPalette={() => setPaletteOpen(true)} />
        <main className="relative min-h-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} variants={pageTransition} initial="hidden" animate="show" exit="exit" className="absolute inset-0">
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const user = useCurrentUser()!;
  const logout = useLogout();
  const status = useRealtimeStatus((state) => state.status);
  const theme = useResolvedTheme();
  const toggleTheme = useUi((state) => state.toggleTheme);
  const sceneMode = useUi((state) => state.sceneMode);
  const setSceneMode = useUi((state) => state.setSceneMode);

  const statusCopy = { online: 'En vivo', connecting: 'Conectando', offline: 'Sin conexión', idle: 'Inactivo' }[status];
  const statusTone = status === 'online' ? 'bg-level-low' : status === 'offline' ? 'bg-level-critical' : 'bg-level-high';

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-5">
      <div className="min-w-0">
        <div className="font-display text-[15px] font-semibold tracking-tight">El Campus También Se Daña</div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="relative flex h-2 w-2">
            {status === 'online' && <span className={cn('absolute inset-0 animate-ping rounded-full opacity-60', statusTone)} />}
            <span className={cn('relative h-2 w-2 rounded-full', statusTone)} />
          </span>
          {statusCopy}
        </div>
      </div>

      <button
        onClick={onOpenPalette}
        className="glass mx-auto flex h-10 w-[min(420px,40vw)] items-center gap-2.5 rounded-xl px-3.5 text-sm text-faint transition-colors hover:text-muted"
      >
        <Icon icon={Icons.search} size="sm" />
        <span className="flex-1 text-left">Buscar incidencias, espacios o acciones</span>
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </button>

      <Tooltip content={sceneMode === 'iso' ? 'Usar el gemelo 3D' : 'Usar el mapa isométrico ligero'}>
        <Button
          variant="ghost"
          size="icon"
          icon={sceneMode === 'iso' ? Icons.box : Icons.layers}
          onClick={() => setSceneMode(sceneMode === 'iso' ? 'auto' : 'iso')}
          aria-label="Cambiar modo de escena"
        />
      </Tooltip>
      <Tooltip content={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}>
        <Button variant="ghost" size="icon" icon={theme === 'dark' ? Icons.sun : Icons.moon} onClick={toggleTheme} aria-label="Cambiar tema" />
      </Tooltip>
      <div className="glass flex items-center gap-2.5 rounded-xl py-1.5 pr-1.5 pl-3">
        <Icon icon={ROLE_ICONS[user.role]} size="sm" className="text-accent" />
        <div className="leading-tight">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-[11px] text-muted">{ROLE_LABELS[user.role]}</div>
        </div>
        <Tooltip content="Salir">
          <Button variant="ghost" size="icon-sm" icon={Icons.logout} onClick={logout} aria-label="Salir" />
        </Tooltip>
      </div>
    </header>
  );
}
