import { AnimatePresence, motion } from 'framer-motion';
import { slideFromEdge } from '../../core/motion';
import { useTwin } from '../../scenes/twinStore';
import { IncidentDetailPanel } from './IncidentDetailPanel';

/** Detalle de la incidencia seleccionada como panel lateral sobre la página actual. */
export function DetailDrawer() {
  const { selectedId, select } = useTwin();
  return (
    <AnimatePresence>
      {selectedId && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-black/30"
            onClick={() => select(null)}
          />
          <motion.aside
            key="drawer"
            variants={slideFromEdge('right')}
            initial="hidden"
            animate="show"
            exit="exit"
            className="glass-strong absolute top-3 right-3 bottom-3 z-30 w-[460px] overflow-hidden rounded-3xl shadow-2xl"
          >
            <div className="h-full overflow-y-auto">
              <IncidentDetailPanel incidentId={selectedId} onClose={() => select(null)} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
