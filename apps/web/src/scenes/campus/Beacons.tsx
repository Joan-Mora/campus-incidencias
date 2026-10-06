import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, QuadraticBezierLine } from '@react-three/drei';
import { easing } from 'maath';
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { CATEGORY_LABELS, PRIORITY_LABELS, type CampusDTO, type PriorityLevel } from '@campus/shared';
import { sceneDamping } from '../../core/motion';
import { Icon } from '../../ui/Icon';
import { CATEGORY_ICONS } from '../../ui/icons';
import { spaceAnchor, spreadOffset, type Vec3 } from './layout';
import { incidentsBySpace } from './types';
import type { TwinIncident } from './useTwinData';

interface PlacedIncident {
  incident: TwinIncident;
  position: Vec3;
}

/** Ubica cada incidencia en la fachada de su piso, repartiendo las del mismo espacio. */
export function usePlacedIncidents(campus: CampusDTO, incidents: TwinIncident[]) {
  return useMemo(() => {
    const bySpace = incidentsBySpace(incidents);
    const placed: PlacedIncident[] = [];
    for (const block of campus.blocks) {
      for (const space of block.spaces) {
        const list = bySpace.get(space.id);
        if (!list) continue;
        const ordered = [...list].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
        ordered.forEach((incident, index) => {
          placed.push({ incident, position: spaceAnchor(block, space, spreadOffset(index, ordered.length)) });
        });
      }
    }
    return placed;
  }, [campus, incidents]);
}

interface BeaconsProps {
  campus: CampusDTO;
  incidents: TwinIncident[];
  colors: Record<PriorityLevel, string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function Beacons({ campus, incidents, colors, selectedId, onSelect }: BeaconsProps) {
  const placed = usePlacedIncidents(campus, incidents);
  return (
    <group>
      {placed.map(({ incident, position }) => (
        <Beacon
          key={incident.id}
          incident={incident}
          position={position}
          color={colors[incident.level]}
          selected={incident.id === selectedId}
          onSelect={() => onSelect(incident.id)}
        />
      ))}
    </group>
  );
}

function Beacon({
  incident,
  position,
  color,
  selected,
  onSelect,
}: {
  incident: TwinIncident;
  position: Vec3;
  color: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const group = useRef<Group>(null);
  const head = useRef<Mesh>(null);
  const pulse = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const base = incident.isPrimary ? 1 : 0.55;

  useFrame((state, delta) => {
    const target = base * (selected ? 1.55 : hovered ? 1.25 : 1);
    if (group.current && easing.damp3(group.current.scale, [target, target, target], sceneDamping.beacon, Math.min(delta, 0.05))) {
      state.invalidate();
    }
    if (head.current) head.current.position.y = 1.25 + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.08;
    if (pulse.current && incident.isOverdue) {
      const t = (state.clock.elapsedTime * 0.7 + position[2] * 0.1) % 1;
      pulse.current.scale.setScalar(0.6 + t * 2.6);
      (pulse.current.material as MeshBasicMaterial).opacity = 0.85 * (1 - t);
    }
  });

  const Glyph = CATEGORY_ICONS[incident.category];

  return (
    <group
      ref={group}
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = '';
      }}
    >
      <mesh position-y={0.6}>
        <cylinderGeometry args={[0.05, 0.05, 1.2, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh ref={head} position-y={1.25}>
        <sphereGeometry args={[0.32, 24, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position-y={1.25}>
        <sphereGeometry args={[0.55, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[0.3, 0.42, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} toneMapped={false} />
      </mesh>
      {incident.isOverdue && (
        <mesh ref={pulse} rotation-x={-Math.PI / 2} position-y={0.03}>
          <ringGeometry args={[0.38, 0.5, 40]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {selected && (
        <mesh position-y={1.25}>
          <torusGeometry args={[0.6, 0.035, 8, 48]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      )}
      {(hovered || selected) && (
        <Html position={[0, 2.1, 0]} center distanceFactor={28} zIndexRange={[30, 10]} style={{ pointerEvents: 'none' }}>
          <div className="glass-strong flex items-center gap-2 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs">
            <span className="grid h-6 w-6 place-items-center rounded-md" style={{ background: color, color: '#0b1020' }}>
              <Icon icon={Glyph} size={13} />
            </span>
            <div className="leading-tight">
              <div className="font-mono font-semibold">{incident.code}</div>
              <div className="text-[10px] text-muted">
                {CATEGORY_LABELS[incident.category]}, {PRIORITY_LABELS[incident.level]}
                {incident.isOverdue ? ', vencida' : ''}
              </div>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

/** Curvas de luz que unen la incidencia madre con cada reporte de su grupo. */
export function ClusterArcs({ campus, incidents, colors }: { campus: CampusDTO; incidents: TwinIncident[]; colors: Record<PriorityLevel, string> }) {
  const placed = usePlacedIncidents(campus, incidents);
  const arcs = useMemo(() => {
    const byCluster = new Map<string, PlacedIncident[]>();
    for (const item of placed) {
      if (!item.incident.clusterId) continue;
      const list = byCluster.get(item.incident.clusterId) ?? [];
      list.push(item);
      byCluster.set(item.incident.clusterId, list);
    }
    const result: { key: string; start: Vec3; end: Vec3; mid: Vec3; color: string }[] = [];
    for (const [clusterId, members] of byCluster) {
      const primary = members.find((member) => member.incident.isPrimary) ?? members[0];
      for (const member of members) {
        if (member === primary) continue;
        const start: Vec3 = [primary.position[0], primary.position[1] + 1.25, primary.position[2]];
        const end: Vec3 = [member.position[0], member.position[1] + 1.25, member.position[2]];
        const distance = Math.hypot(end[0] - start[0], end[2] - start[2]);
        const mid: Vec3 = [(start[0] + end[0]) / 2, Math.max(start[1], end[1]) + 1.2 + distance * 0.35, (start[2] + end[2]) / 2 + 0.6];
        result.push({ key: `${clusterId}-${member.incident.id}`, start, end, mid, color: colors[primary.incident.level] });
      }
    }
    return result;
  }, [placed, colors]);

  return (
    <group>
      {arcs.map(({ key, ...arc }) => (
        <Arc key={key} {...arc} />
      ))}
    </group>
  );
}

function Arc({ start, end, mid, color }: { start: Vec3; end: Vec3; mid: Vec3; color: string }) {
  // El tipo de drei no expone el material de la línea; se anima su desplazamiento de guiones.
  const line = useRef<{ material: { dashOffset: number } } | null>(null);
  useFrame((_, delta) => {
    if (line.current) line.current.material.dashOffset -= delta * 0.8;
  });
  return (
    <QuadraticBezierLine
      ref={line as never}
      start={start}
      end={end}
      mid={mid}
      color={color}
      lineWidth={2}
      dashed
      dashSize={0.35}
      gapSize={0.2}
      transparent
      opacity={0.9}
      toneMapped={false}
    />
  );
}
