import type { MouseEvent } from 'react';
import { ROOM_DIMENSIONS } from '@campus/shared';
import type { RoomPickerProps } from './RoomPicker';

const PADDING = 0.6;
/** Altura asumida para un punto marcado sobre el plano (a la altura de la mano). */
const PLAN_HEIGHT = 1;

/** Respaldo 2D del salón: plano visto desde arriba; un toque marca x y z. */
export default function RoomPlan({ type, value, onChange, markers = [], accent }: RoomPickerProps) {
  const { width, depth } = ROOM_DIMENSIONS[type];
  const viewWidth = width + PADDING * 2;
  const viewDepth = depth + PADDING * 2;

  const pick = (event: MouseEvent<SVGSVGElement>) => {
    if (!onChange) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * viewWidth - PADDING - width / 2;
    const z = ((event.clientY - box.top) / box.height) * viewDepth - PADDING - depth / 2;
    onChange({
      x: Math.round(Math.max(-width / 2, Math.min(width / 2, x)) * 100) / 100,
      y: PLAN_HEIGHT,
      z: Math.round(Math.max(-depth / 2, Math.min(depth / 2, z)) * 100) / 100,
    });
  };

  const toView = (x: number, z: number) => ({ cx: x + width / 2 + PADDING, cy: z + depth / 2 + PADDING });

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewDepth}`}
      className="h-full w-full bg-bg-elevated"
      preserveAspectRatio="xMidYMid meet"
      onClick={pick}
      role="img"
      aria-label="Plano del espacio"
    >
      <defs>
        <pattern id="plan-grid" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M1 0H0V1" fill="none" stroke="var(--border)" strokeWidth="0.02" />
        </pattern>
      </defs>
      <rect x={PADDING} y={PADDING} width={width} height={depth} fill="url(#plan-grid)" stroke="var(--border-strong)" strokeWidth="0.08" rx="0.1" />
      <rect x={PADDING + width * 0.25} y={PADDING - 0.04} width={width * 0.5} height="0.12" fill="var(--text-muted)" rx="0.04" />
      <text x={viewWidth / 2} y={PADDING - 0.18} textAnchor="middle" fontSize="0.32" fill="var(--text-faint)">
        Tablero
      </text>
      <rect x={PADDING + width - 0.05} y={PADDING + depth - 1.4} width="0.1" height="1" fill="var(--accent)" opacity="0.6" />
      {markers.map((marker) => {
        const point = toView(marker.point.x, marker.point.z);
        return <circle key={marker.id} {...point} r="0.18" fill={marker.color} opacity="0.75" />;
      })}
      {value && (
        <g>
          <circle {...toView(value.x, value.z)} r="0.55" fill={accent} opacity="0.18">
            <animate attributeName="r" values="0.3;0.7;0.3" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <circle {...toView(value.x, value.z)} r="0.24" fill={accent} stroke="white" strokeWidth="0.06" />
        </g>
      )}
    </svg>
  );
}
