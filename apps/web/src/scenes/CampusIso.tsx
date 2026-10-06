import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FLOOR_HEIGHT, levelRank, type BlockDTO } from '@campus/shared';
import { levelVar } from '../core/theme/levels';
import { spring } from '../core/motion';
import { blockToWorld, campusBounds, daylight, spaceAnchor, spreadOffset, type Vec3 } from './campus/layout';
import { incidentsBySpace, statsByBlock, type CampusSceneProps } from './campus/types';

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);
const SCALE = 9;

const project = ([x, y, z]: Vec3, center: Vec3): [number, number] => [
  (x - center[0] - (z - center[2])) * COS30 * SCALE,
  ((x - center[0] + (z - center[2])) * SIN30 - y) * SCALE,
];

const toPoints = (points: [number, number][]) => points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/**
 * Campus isométrico en SVG: respaldo ligero del gemelo 3D para equipos sin WebGL o con movimiento reducido.
 * Mismos datos e interacciones: clic en un bloque lo enfoca, clic en una baliza abre la incidencia.
 */
export default function CampusIso({ campus, incidents, mode, selectedId, focusBlockId, clock, onSelect, onFocusBlock }: CampusSceneProps) {
  const [hoverBlock, setHoverBlock] = useState<string | null>(null);
  const { center, radius } = useMemo(() => campusBounds(campus), [campus]);
  const stats = useMemo(() => statsByBlock(campus, incidents), [campus, incidents]);
  const bySpace = useMemo(() => incidentsBySpace(incidents), [incidents]);
  const light = daylight(clock);

  const blocks = useMemo(
    () => [...campus.blocks].sort((a, b) => a.posX + a.posZ - (b.posX + b.posZ)),
    [campus.blocks],
  );

  const extent = radius * SCALE * 1.9;

  return (
    <svg
      viewBox={`${-extent} ${-extent * 0.85} ${extent * 2} ${extent * 1.45}`}
      className="h-full w-full"
      onClick={() => onFocusBlock(null)}
      role="img"
      aria-label={`Mapa isométrico de ${campus.name}`}
    >
      <defs>
        <radialGradient id="iso-ground" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--accent)" stopOpacity={0.12 + light * 0.06} />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={0} cy={0} rx={extent * 0.95} ry={extent * 0.55} fill="url(#iso-ground)" />

      {blocks.map((block) => (
        <IsoBlock
          key={block.id}
          block={block}
          center={center}
          light={light}
          active={focusBlockId === block.id || hoverBlock === block.id}
          dimmed={Boolean(focusBlockId && focusBlockId !== block.id)}
          open={stats.get(block.id)?.open ?? 0}
          onHover={(hovering) => setHoverBlock(hovering ? block.id : null)}
          onClick={() => onFocusBlock(block.id)}
        />
      ))}

      {mode === 'heat'
        ? campus.blocks.flatMap((block) =>
            block.spaces.map((space) => {
              const list = (bySpace.get(space.id) ?? []).filter((i) => i.isPrimary);
              if (!list.length) return null;
              const top = blockToWorld(block, space.localX, block.floors * FLOOR_HEIGHT, 0);
              const [x, y] = project(top, center);
              const height = list.length * 14;
              const worst = list.reduce((a, b) => (levelRank(b.level) > levelRank(a.level) ? b : a));
              return (
                <motion.rect
                  key={space.id}
                  x={x - 5}
                  width={10}
                  rx={3}
                  initial={{ y, height: 0 }}
                  animate={{ y: y - height, height }}
                  transition={spring.gentle}
                  fill={levelVar(worst.level)}
                  opacity={0.85}
                />
              );
            }),
          )
        : campus.blocks.flatMap((block) =>
            block.spaces.flatMap((space) => {
              const list = bySpace.get(space.id) ?? [];
              return list.map((incident, index) => {
                const [x, y] = project(spaceAnchor(block, space, spreadOffset(index, list.length)), center);
                const size = incident.isPrimary ? 5.5 : 3;
                const selected = incident.id === selectedId;
                return (
                  <g
                    key={incident.id}
                    transform={`translate(${x} ${y})`}
                    className="cursor-pointer"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(incident.id);
                    }}
                  >
                    <title>{incident.code}</title>
                    {incident.isOverdue && (
                      <circle
                        r={size}
                        fill="none"
                        stroke={levelVar(incident.level)}
                        strokeWidth={1.5}
                        className="animate-pulse-ring"
                        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                      />
                    )}
                    <line y1={0} y2={14} stroke={levelVar(incident.level)} strokeOpacity={0.5} strokeWidth={1.5} />
                    <circle r={size} fill={levelVar(incident.level)} stroke={selected ? 'var(--text)' : 'none'} strokeWidth={2} />
                  </g>
                );
              });
            }),
          )}
    </svg>
  );
}

function IsoBlock({
  block,
  center,
  light,
  active,
  dimmed,
  open,
  onHover,
  onClick,
}: {
  block: BlockDTO;
  center: Vec3;
  light: number;
  active: boolean;
  dimmed: boolean;
  open: number;
  onHover: (hovering: boolean) => void;
  onClick: () => void;
}) {
  const height = block.floors * FLOOR_HEIGHT;
  const hw = block.width / 2;
  const hd = block.depth / 2;
  const corners: [number, number][] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  const ground = corners.map(([x, z]) => blockToWorld(block, x, 0, z));
  const top = corners.map(([x, z]) => blockToWorld(block, x, height, z));

  const faces: { points: [number, number][]; shade: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const nx = top[j][2] - top[i][2];
    const nz = -(top[j][0] - top[i][0]);
    // Solo se dibujan las caras orientadas hacia el observador isométrico.
    if (nx + nz <= 0) continue;
    faces.push({
      points: [ground[i], ground[j], top[j], top[i]].map((p) => project(p, center)),
      shade: nx > nz ? 0.55 : 0.75,
    });
  }

  const window = 0.25 + (1 - light) * 0.6;
  const label = project(blockToWorld(block, 0, height + 2, 0), center);

  return (
    <g
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="cursor-pointer transition-opacity duration-300"
      opacity={dimmed ? 0.35 : 1}
    >
      {faces.map((face, index) => (
        <g key={index}>
          <polygon points={toPoints(face.points)} fill="var(--surface-strong)" stroke="var(--border-strong)" strokeWidth={1} />
          <polygon points={toPoints(face.points)} fill="var(--accent)" opacity={(active ? 0.22 : 0.08) * face.shade} />
          {Array.from({ length: block.floors }, (_, floor) => {
            const t = (floor + 0.55) / block.floors;
            const [a, b, c, d] = face.points;
            const lerp = (p: [number, number], q: [number, number], k: number): [number, number] => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
            const left = lerp(a, d, t);
            const right = lerp(b, c, t);
            return (
              <line
                key={floor}
                x1={lerp(left, right, 0.08)[0]}
                y1={lerp(left, right, 0.08)[1]}
                x2={lerp(left, right, 0.92)[0]}
                y2={lerp(left, right, 0.92)[1]}
                stroke="#ffd59a"
                strokeOpacity={window}
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })}
        </g>
      ))}
      <polygon points={toPoints(top.map((p) => project(p, center)))} fill="var(--surface-hover)" stroke={active ? 'var(--accent)' : 'var(--border-strong)'} strokeWidth={active ? 2 : 1} />
      <g transform={`translate(${label[0]} ${label[1]})`}>
        <rect x={-34} y={-11} width={68} height={20} rx={10} fill="var(--surface-strong)" stroke="var(--border)" />
        <text textAnchor="middle" y={3} fontSize={10} fontWeight={600} fill="var(--text)" fontFamily="var(--font-display)">
          {`Bloque ${block.code}${open ? `  ${open}` : ''}`}
        </text>
      </g>
    </g>
  );
}
