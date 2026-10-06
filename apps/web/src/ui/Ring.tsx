import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { transition } from '../core/motion';
import { cn } from './cn';

interface RingProps {
  /** Fracción de 0 a 1 que queda llena. */
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  track?: string;
  pulse?: boolean;
  className?: string;
  children?: ReactNode;
  label?: string;
}

/** Anillo de progreso: el SLA es un anillo que se vacía. */
export function Ring({ value, size = 36, stroke = 3.5, color, track = 'var(--border)', pulse, className, children, label }: RingProps) {
  const radius = (size - stroke) / 2;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className={cn('relative inline-grid shrink-0 place-items-center', className)} style={{ width: size, height: size }} role="img" aria-label={label}>
      {pulse && <span className="absolute inset-0 animate-pulse-ring rounded-full" style={{ boxShadow: `0 0 0 2px ${color}` }} />}
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={false}
          animate={{ pathLength: clamped }}
          transition={transition.slow}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}
