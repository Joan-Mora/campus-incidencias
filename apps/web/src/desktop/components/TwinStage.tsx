import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PRIORITY_LABELS, PRIORITY_LEVELS } from '@campus/shared';
import { fadeUp } from '../../core/motion';
import { levelVar } from '../../core/theme/levels';
import { useCampusTree } from '../../features/locations/api';
import { CampusScene } from '../../scenes/SceneHost';
import { useTwinData } from '../../scenes/campus/useTwinData';
import { useTwin } from '../../scenes/twinStore';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { Icons } from '../../ui/icons';
import { Segmented } from '../../ui/Segmented';
import { Skeleton } from '../../ui/Skeleton';
import { ReplayBar } from './ReplayBar';

/** Sede activa del gemelo; si no hay ninguna elegida toma la primera. */
export function useActiveCampus() {
  const campuses = useCampusTree();
  const { campusId, setCampus } = useTwin();
  useEffect(() => {
    if (!campusId && campuses.data?.[0]) setCampus(campuses.data[0].id);
  }, [campusId, campuses.data, setCampus]);
  const campus = campuses.data?.find((item) => item.id === campusId) ?? campuses.data?.[0];
  return { campus, campuses: campuses.data ?? [], loading: campuses.isLoading };
}

export function TwinStage({ autoRotate = false, controls = true }: { autoRotate?: boolean; controls?: boolean }) {
  const { campus, campuses, loading } = useActiveCampus();
  const { mode, selectedId, focusBlockId, replayAt, setCampus, setMode, select, focusBlock } = useTwin();
  const data = useTwinData(campus, replayAt);

  const counts = useMemo(() => {
    const result = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0, overdue: 0 };
    for (const incident of data.incidents) {
      if (!incident.isPrimary) continue;
      result[incident.level] += 1;
      if (incident.isOverdue) result.overdue += 1;
    }
    return result;
  }, [data.incidents]);

  const focusedBlock = campus?.blocks.find((block) => block.id === focusBlockId);

  if (loading) return <Skeleton className="h-full w-full rounded-none opacity-40" />;
  if (!campus) return <EmptyState icon={Icons.map} illustration="campus" title="Sin sedes" description="Ejecuta el seed para crear el campus de prueba." />;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <CampusScene
        campus={campus}
        incidents={data.incidents}
        mode={mode}
        selectedId={selectedId}
        focusBlockId={focusBlockId}
        clock={data.clock}
        onSelect={select}
        onFocusBlock={focusBlock}
        autoRotate={autoRotate}
      />

      {controls && (
        <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            {campuses.length > 1 && (
              <Segmented size="sm" value={campus.id} onChange={setCampus} options={campuses.map((item) => ({ value: item.id, label: item.name.replace(/^Sede\s+/i, '') }))} />
            )}
            <Segmented
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'beacons', label: 'Balizas', icon: Icons.pin },
                { value: 'heat', label: 'Calor', icon: Icons.chart },
              ]}
            />
            <AnimatePresence>
              {focusedBlock && (
                <motion.div variants={fadeUp} initial="hidden" animate="show" exit="exit">
                  <Button size="sm" variant="secondary" icon={Icons.close} onClick={() => focusBlock(null)}>
                    {focusedBlock.name}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="glass pointer-events-auto flex items-center gap-3 rounded-xl px-3 py-2">
            {[...PRIORITY_LEVELS].reverse().map((level) => (
              <span key={level} className="flex items-center gap-1.5 text-[11px] text-muted" title={PRIORITY_LABELS[level]}>
                <span className="h-2 w-2 rounded-full" style={{ background: levelVar(level), boxShadow: `0 0 8px ${levelVar(level)}` }} />
                <span className="tabular font-mono text-fg">{counts[level]}</span>
              </span>
            ))}
            {counts.overdue > 0 && (
              <span className="flex items-center gap-1 border-l border-line pl-3 text-[11px] font-semibold text-level-critical">
                <Icon icon={Icons.alarm} size={12} />
                {counts.overdue} vencidas
              </span>
            )}
          </div>
        </div>
      )}

      {controls && (
        <div className="absolute inset-x-4 bottom-4">
          <ReplayBar range={data.range} />
        </div>
      )}
    </div>
  );
}
