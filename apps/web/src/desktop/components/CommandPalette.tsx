import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import * as RadixDialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { CATEGORY_LABELS } from '@campus/shared';
import { setViewOverride } from '../../core/device/viewMode';
import { fadeIn, scaleIn } from '../../core/motion';
import { useUi } from '../../core/theme/store';
import { useCurrentUser } from '../../features/auth/api';
import { useIncidents } from '../../features/incidents/api';
import { LevelBadge } from '../../features/incidents/badges';
import { useTwin } from '../../scenes/twinStore';
import { Icon } from '../../ui/Icon';
import { CATEGORY_ICONS, Icons, type LucideIcon } from '../../ui/icons';

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const incidents = useIncidents({ status: 'PENDING,IN_PROGRESS,RESOLVED' }, { enabled: open });
  const { select, setMode, setReplayAt, setPlaying } = useTwin();
  const toggleTheme = useUi((state) => state.toggleTheme);
  const setSceneMode = useUi((state) => state.setSceneMode);
  const isStaff = user?.role !== 'STUDENT';

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  const actions: { label: string; icon: LucideIcon; run: () => void; staff?: boolean; keywords?: string }[] = [
    { label: 'Ir al centro de mando', icon: Icons.radar, run: () => navigate('/') },
    { label: 'Ir al tablero', icon: Icons.board, run: () => navigate('/tablero'), staff: true, keywords: 'kanban estados' },
    { label: 'Ver indicadores', icon: Icons.chart, run: () => navigate('/panel'), keywords: 'dashboard panel' },
    { label: 'Revisar sugerencias de agrupación', icon: Icons.merge, run: () => navigate('/sugerencias'), staff: true },
    { label: 'Ver columnas de calor', icon: Icons.chart, run: () => (navigate('/'), setMode('heat')), keywords: 'heatmap' },
    { label: 'Ver balizas', icon: Icons.pin, run: () => (navigate('/'), setMode('beacons')) },
    {
      label: 'Reproducir la semana en el campus',
      icon: Icons.history,
      run: () => {
        navigate('/');
        setReplayAt(Date.now() - 7 * 86_400_000);
        setPlaying(true);
      },
      keywords: 'repeticion tiempo historial',
    },
    { label: 'Volver al campus en vivo', icon: Icons.activity, run: () => setReplayAt(null) },
    { label: 'Cambiar tema claro u oscuro', icon: Icons.contrast, run: toggleTheme },
    { label: 'Usar mapa isométrico ligero', icon: Icons.layers, run: () => setSceneMode('iso') },
    { label: 'Usar gemelo 3D', icon: Icons.box, run: () => setSceneMode('auto') },
    { label: 'Modo proyector', icon: Icons.projector, run: () => setViewOverride('projector') },
    { label: 'Abrir la app de campo', icon: Icons.mobile, run: () => setViewOverride('mobile') },
  ];

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild forceMount>
              <motion.div variants={fadeIn} initial="hidden" animate="show" exit="exit" className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
            </RadixDialog.Overlay>
            <RadixDialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div variants={scaleIn} initial="hidden" animate="show" exit="exit" className="fixed top-[14vh] left-1/2 z-50 w-[min(640px,92vw)] -translate-x-1/2">
                <RadixDialog.Title className="sr-only">Paleta de comandos</RadixDialog.Title>
                <Command className="glass-strong overflow-hidden rounded-3xl" loop>
                  <div className="flex items-center gap-3 border-b border-line px-5">
                    <Icon icon={Icons.search} className="text-muted" />
                    <Command.Input autoFocus placeholder="Busca por código, descripción, espacio o acción" className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" />
                  </div>
                  <Command.List className="max-h-[56vh] overflow-y-auto p-2">
                    <Command.Empty className="px-4 py-10 text-center text-sm text-muted">Sin resultados</Command.Empty>
                    <Command.Group heading="Acciones" className="px-1 text-[11px] font-semibold tracking-wider text-faint uppercase [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
                      {actions
                        .filter((action) => !action.staff || isStaff)
                        .map((action) => (
                          <Command.Item
                            key={action.label}
                            value={`${action.label} ${action.keywords ?? ''}`}
                            onSelect={() => run(action.run)}
                            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-normal tracking-normal text-fg normal-case data-[selected=true]:bg-surface-hover"
                          >
                            <Icon icon={action.icon} size="sm" className="text-accent" />
                            {action.label}
                          </Command.Item>
                        ))}
                    </Command.Group>
                    <Command.Group heading="Incidencias" className="px-1 text-[11px] font-semibold tracking-wider text-faint uppercase [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
                      {(incidents.data ?? []).slice(0, 120).map((incident) => (
                        <Command.Item
                          key={incident.id}
                          value={`${incident.code} ${incident.description} ${incident.space.name} ${incident.space.block.name} ${CATEGORY_LABELS[incident.category]}`}
                          onSelect={() =>
                            run(() => {
                              navigate('/');
                              useTwin.getState().setCampus(incident.space.campus.id);
                              select(incident.id);
                            })
                          }
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-normal tracking-normal text-fg normal-case data-[selected=true]:bg-surface-hover"
                        >
                          <Icon icon={CATEGORY_ICONS[incident.category]} size="sm" className="text-muted" />
                          <span className="font-mono text-xs text-muted">{incident.code}</span>
                          <span className="min-w-0 flex-1 truncate">{incident.description}</span>
                          <span className="hidden truncate text-xs text-faint sm:block">{incident.space.name}</span>
                          <LevelBadge level={incident.priorityLevel} />
                        </Command.Item>
                      ))}
                    </Command.Group>
                  </Command.List>
                </Command>
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  );
}
