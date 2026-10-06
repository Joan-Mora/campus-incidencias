import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useAppliedTheme, useLevelColors } from '../core/theme/levels';
import { Buildings } from './campus/Buildings';
import { Beacons, ClusterArcs } from './campus/Beacons';
import { CameraRig } from './campus/CameraRig';
import { HeatColumns } from './campus/HeatColumns';
import { SceneEnvironment } from './campus/SceneEnvironment';
import { Vegetation } from './campus/Vegetation';
import { campusBounds, daylight } from './campus/layout';
import { statsByBlock, type CampusSceneProps } from './campus/types';
import { PulseDriver } from './campus/PulseDriver';

/** Gemelo digital del campus. Se importa con React.lazy desde SceneHost. */
export default function CampusTwin(props: CampusSceneProps) {
  const { campus, incidents, mode, tier = 'full', clock } = props;
  const theme = useAppliedTheme();
  const colors = useLevelColors();
  const [dpr, setDpr] = useState(tier === 'full' ? 1.75 : 1);
  const bounds = useMemo(() => campusBounds(campus), [campus]);
  const stats = useMemo(() => statsByBlock(campus, incidents), [campus, incidents]);
  const light = daylight(clock);
  const animated =
    Boolean(props.autoRotate) || (mode === 'beacons' && incidents.some((incident) => incident.isOverdue || (incident.clusterId && !incident.isPrimary)));

  return (
    <Canvas
      shadows={tier === 'full'}
      dpr={dpr}
      frameloop="demand"
      camera={{ fov: 38, near: 0.5, far: 600, position: [bounds.center[0] + bounds.radius * 1.6, bounds.radius * 1.35, bounds.center[2] + bounds.radius * 1.9] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => {
        props.onSelect(null);
        props.onFocusBlock(null);
      }}
      aria-label={`Gemelo digital de ${campus.name}`}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(tier === 'full' ? 1.75 : 1)} />
      <SceneEnvironment theme={theme} light={light} radius={bounds.radius} center={bounds.center} shadows={tier === 'full'} />
      <Buildings
        campus={campus}
        theme={theme}
        light={light}
        stats={stats}
        focusBlockId={props.focusBlockId}
        onFocusBlock={props.onFocusBlock}
        shadows={tier === 'full'}
      />
      <Suspense fallback={null}>
        <Vegetation campus={campus} radius={bounds.radius} center={bounds.center} dense={tier === 'full'} />
      </Suspense>
      {mode === 'heat' ? (
        <HeatColumns campus={campus} incidents={incidents} colors={colors} />
      ) : (
        <>
          <Beacons campus={campus} incidents={incidents} colors={colors} selectedId={props.selectedId} onSelect={props.onSelect} />
          <ClusterArcs campus={campus} incidents={incidents} colors={colors} />
        </>
      )}
      <CameraRig
        campus={campus}
        incidents={incidents}
        bounds={bounds}
        selectedId={props.selectedId}
        focusBlockId={props.focusBlockId}
        autoRotate={props.autoRotate}
      />
      <PulseDriver active={animated} fps={tier === 'full' ? 45 : 24} />
    </Canvas>
  );
}
