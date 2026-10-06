import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { easing } from 'maath';
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { CampusDTO } from '@campus/shared';
import { sceneDamping } from '../../core/motion';
import { blockCenter, spaceAnchor, type Vec3 } from './layout';
import type { TwinIncident } from './useTwinData';

interface CameraRigProps {
  campus: CampusDTO;
  incidents: TwinIncident[];
  bounds: { center: Vec3; radius: number };
  selectedId: string | null;
  focusBlockId: string | null;
  autoRotate?: boolean;
}

/** Vuelo de cámara amortiguado hacia la incidencia o el bloque elegidos; el usuario puede tomar el control. */
export function CameraRig({ campus, incidents, bounds, selectedId, focusBlockId, autoRotate }: CameraRigProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const flying = useRef(false);
  const goal = useRef({ target: new Vector3(), position: new Vector3() });

  const destination = useMemo(() => {
    const overview = {
      target: new Vector3(bounds.center[0], 3, bounds.center[2]),
      position: new Vector3(bounds.center[0] + bounds.radius * 1.5, bounds.radius * 1.25, bounds.center[2] + bounds.radius * 1.8),
    };
    const fromPoint = (point: Vec3, distance: number) => ({
      target: new Vector3(...point),
      position: new Vector3(point[0] + distance * 0.75, point[1] + distance * 0.6, point[2] + distance),
    });
    if (selectedId) {
      const incident = incidents.find((item) => item.id === selectedId);
      for (const block of campus.blocks) {
        const space = block.spaces.find((item) => item.id === incident?.spaceId);
        if (space) return fromPoint(spaceAnchor(block, space), 14);
      }
    }
    if (focusBlockId) {
      const block = campus.blocks.find((item) => item.id === focusBlockId);
      if (block) return fromPoint(blockCenter(block), Math.max(block.width, block.depth) * 1.6 + 8);
    }
    return overview;
    // Solo se recalcula cuando cambia la selección o el bloque, no con cada refresco de datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, focusBlockId, campus, bounds]);

  useEffect(() => {
    goal.current = destination;
    flying.current = true;
    invalidate();
  }, [destination, invalidate]);

  useFrame((_, delta) => {
    const orbit = controls.current;
    if (!orbit || !flying.current) return;
    const step = Math.min(delta, 0.05);
    const movingTarget = easing.damp3(orbit.target, goal.current.target, sceneDamping.camera, step);
    const movingCamera = easing.damp3(camera.position, goal.current.position, sceneDamping.camera, step);
    orbit.update();
    if (movingTarget || movingCamera) invalidate();
    else flying.current = false;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={8}
      maxDistance={bounds.radius * 4}
      maxPolarAngle={Math.PI / 2.15}
      minPolarAngle={0.25}
      autoRotate={autoRotate && !selectedId && !focusBlockId}
      autoRotateSpeed={0.35}
      onStart={() => {
        flying.current = false;
      }}
    />
  );
}
