import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { spring } from '../../core/motion';
import { useTwin } from '../../scenes/twinStore';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { Icons } from '../../ui/icons';
import { IncidentDetailPanel } from '../components/IncidentDetailPanel';
import { KpiPanel } from '../components/KpiPanel';
import { PriorityQueue } from '../components/PriorityQueue';
import { TwinStage } from '../components/TwinStage';

/** Anchos de los paneles según la ventana, para que el gemelo nunca quede aplastado. */
function usePanelWidths() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  if (width >= 1600) return { queue: 380, side: 440, roomy: true };
  if (width >= 1320) return { queue: 340, side: 390, roomy: true };
  return { queue: 320, side: 370, roomy: false };
}

/** Centro de mando: cola priorizada, gemelo del campus y detalle o indicadores. */
export function CommandCenterPage() {
  const { selectedId, select, campusId, focusBlockId } = useTwin();
  const widths = usePanelWidths();
  const [queueOpen, setQueueOpen] = useState(true);
  const [sideOpen, setSideOpen] = useState(() => widths.roomy || Boolean(selectedId));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);

  useEffect(() => {
    if (selectedId) setSideOpen(true);
    else if (!widths.roomy) setSideOpen(false);
  }, [selectedId, widths.roomy]);

  return (
    <div className="flex h-full gap-3 p-3">
      <CollapsiblePanel open={queueOpen} width={widths.queue} side="left" onToggle={() => setQueueOpen((value) => !value)} label="cola">
        <PriorityQueue campusId={campusId} blockId={focusBlockId} />
      </CollapsiblePanel>

      <section className="glass relative min-w-0 flex-1 overflow-hidden rounded-3xl">
        <TwinStage />
      </section>

      <CollapsiblePanel open={sideOpen} width={widths.side} side="right" onToggle={() => setSideOpen((value) => !value)} label="detalle">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={selectedId ?? 'kpis'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto">
            {selectedId ? <IncidentDetailPanel incidentId={selectedId} onClose={() => select(null)} /> : <KpiPanel />}
          </motion.div>
        </AnimatePresence>
      </CollapsiblePanel>
    </div>
  );
}

function CollapsiblePanel({
  open,
  width,
  side,
  label,
  onToggle,
  children,
}: {
  open: boolean;
  width: number;
  side: 'left' | 'right';
  label: string;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const icon = (side === 'left') === open ? Icons.chevronLeft : Icons.chevronRight;
  return (
    <motion.aside
      initial={false}
      animate={{ width: open ? width : 44 }}
      transition={spring.layout}
      className="glass relative shrink-0 overflow-hidden rounded-3xl"
    >
      <div className={cn('absolute z-10', open ? 'bottom-3' : 'top-3', side === 'left' ? 'right-2' : 'left-2', open && 'opacity-60 hover:opacity-100')}>
        <Button size="icon-sm" variant="ghost" icon={icon} onClick={onToggle} aria-label={open ? `Ocultar ${label}` : `Mostrar ${label}`} />
      </div>
      <motion.div animate={{ opacity: open ? 1 : 0 }} className={cn('h-full', !open && 'pointer-events-none')} style={{ width }}>
        {children}
      </motion.div>
    </motion.aside>
  );
}
