import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { easing } from 'maath';
import { AdditiveBlending, type Group } from 'three';
import { levelRank, type CampusDTO, type PriorityLevel } from '@campus/shared';
import { sceneDamping } from '../../core/motion';
import { roofAnchor, type Vec3 } from './layout';
import { incidentsBySpace } from './types';
import type { TwinIncident } from './useTwinData';

const UNIT = 1.6;

/** El top de espacios convertido en paisaje: la altura de cada columna es la cantidad de reportes abiertos. */
export function HeatColumns({ campus, incidents, colors }: { campus: CampusDTO; incidents: TwinIncident[]; colors: Record<PriorityLevel, string> }) {
  const columns = useMemo(() => {
    const bySpace = incidentsBySpace(incidents);
    const result: { id: string; label: string; position: Vec3; count: number; color: string }[] = [];
    for (const block of campus.blocks) {
      for (const space of block.spaces) {
        const list = bySpace.get(space.id);
        if (!list?.length) continue;
        const worst = list.reduce((a, b) => (levelRank(b.level) > levelRank(a.level) ? b : a));
        result.push({ id: space.id, label: space.name, position: roofAnchor(block, space), count: list.length, color: colors[worst.level] });
      }
    }
    return result;
  }, [campus, incidents, colors]);

  return (
    <group>
      {columns.map((column) => (
        <Column key={column.id} {...column} />
      ))}
    </group>
  );
}

function Column({ position, count, color, label }: { position: Vec3; count: number; color: string; label: string }) {
  const group = useRef<Group>(null);
  const height = count * UNIT;
  useFrame((state, delta) => {
    if (group.current && easing.damp(group.current.scale, 'y', height, sceneDamping.column, Math.min(delta, 0.05))) state.invalidate();
  });
  return (
    <group position={position}>
      <group ref={group} scale={[1, 0.001, 1]}>
        <mesh position-y={0.5}>
          <cylinderGeometry args={[0.9, 0.9, 1, 32, 1, true]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={2} />
        </mesh>
        <mesh position-y={0.5}>
          <cylinderGeometry args={[0.5, 0.5, 1, 24]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
      <Html position={[0, height + 1, 0]} center distanceFactor={50} style={{ pointerEvents: 'none' }}>
        <div className="glass-strong whitespace-nowrap rounded-full px-2 py-0.5 text-[11px]">
          <span className="font-mono font-semibold" style={{ color }}>
            {count}
          </span>{' '}
          <span className="text-muted">{label}</span>
        </div>
      </Html>
    </group>
  );
}
