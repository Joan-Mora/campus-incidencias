import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { distance3, HOTSPOT_NEAR_METERS } from '@campus/shared';
import { haptic } from '../../core/device/viewMode';
import { fadeUp } from '../../core/motion';
import { useCssVars, useLevelColors } from '../../core/theme/levels';
import { useIncidents } from '../../features/incidents/api';
import { RoomScene } from '../../scenes/RoomHost';
import { Icon } from '../../ui/Icon';
import { Icons } from '../../ui/icons';
import { useDraft } from './draftStore';

export function StepSpot() {
  const { space, hotspot, setHotspot } = useDraft();
  const levelColors = useLevelColors();
  const { accent } = useCssVars(['accent'] as const);
  const existing = useIncidents({ spaceId: space?.id, status: 'PENDING,IN_PROGRESS' }, { enabled: Boolean(space) });

  const markers = useMemo(
    () =>
      (existing.data ?? [])
        .filter((incident) => incident.hotspot)
        .map((incident) => ({ id: incident.id, point: incident.hotspot!, color: levelColors[incident.priorityLevel] })),
    [existing.data, levelColors],
  );

  const near = useMemo(() => {
    if (!hotspot) return null;
    return (existing.data ?? []).find((incident) => incident.hotspot && distance3(incident.hotspot, hotspot) < HOTSPOT_NEAR_METERS) ?? null;
  }, [existing.data, hotspot]);

  if (!space) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Gira el salón con un dedo y toca donde está el daño: una toma, una lámpara, una mancha en el techo.</p>
      <div className="relative h-[42dvh] min-h-64 overflow-hidden rounded-3xl border border-line">
        <RoomScene
          type={space.type}
          value={hotspot}
          accent={accent || '#8b7bff'}
          markers={markers}
          onChange={(point) => {
            haptic(8);
            setHotspot(point);
          }}
        />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-between">
          <span className="glass rounded-full px-3 py-1.5 text-xs font-medium">{space.name}</span>
          {markers.length > 0 && (
            <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs">
              <Icon icon={Icons.pin} size={12} />
              {markers.length} ya reportados
            </span>
          )}
        </div>
        <AnimatePresence>
          {hotspot && (
            <motion.button
              variants={fadeUp}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={() => setHotspot(null)}
              className="glass-strong absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs"
            >
              <Icon icon={Icons.undo} size={12} />
              Quitar punto
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {near && (
          <motion.p variants={fadeUp} initial="hidden" animate="show" exit="exit" className="flex items-start gap-2 rounded-2xl border border-level-high/30 bg-level-high/10 p-3 text-sm">
            <Icon icon={Icons.info} size="sm" className="mt-0.5 shrink-0 text-level-high" />
            Muy cerca ya hay un reporte abierto ({near.code}). Si es el mismo daño podrás sumarte en el siguiente paso.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
