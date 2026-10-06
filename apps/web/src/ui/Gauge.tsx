import { motion } from 'framer-motion';
import { spring } from '../core/motion';
import { AnimatedNumber } from './AnimatedNumber';

interface GaugeProps {
  /** Puntaje de 0 a 100. */
  value: number;
  color: string;
  size?: number;
  label?: string;
  caption?: string;
  /** Umbrales que se marcan sobre el arco (por defecto los cortes de nivel). */
  ticks?: number[];
  decimals?: number;
  suffix?: string;
}

/** Medidor semicircular de prioridad que se llena con un resorte. */
export function Gauge({ value, color, size = 220, label, caption, ticks = [25, 50, 75], decimals = 1, suffix }: GaugeProps) {
  const stroke = size * 0.075;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const arc = `M ${stroke / 2} ${center} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${center}`;
  const fraction = Math.max(0, Math.min(1, value / 100));

  return (
    <div className="relative" style={{ width: size, height: center + stroke }}>
      <svg width={size} height={center + stroke} viewBox={`0 0 ${size} ${center + stroke}`}>
        <path d={arc} fill="none" stroke="var(--border)" strokeWidth={stroke} strokeLinecap="round" />
        <motion.path
          d={arc}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: fraction }}
          transition={spring.gentle}
          style={{ filter: `drop-shadow(0 0 10px ${color})` }}
        />
        {ticks.map((tick) => {
          const angle = Math.PI * (1 - tick / 100);
          const inner = radius - stroke * 0.9;
          const outer = radius + stroke * 0.9;
          return (
            <line
              key={tick}
              x1={center + inner * Math.cos(angle)}
              y1={center - inner * Math.sin(angle)}
              x2={center + outer * Math.cos(angle)}
              y2={center - outer * Math.sin(angle)}
              stroke="var(--bg)"
              strokeWidth={2.5}
            />
          );
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <AnimatedNumber value={value} decimals={decimals} suffix={suffix} className="font-display text-4xl font-semibold tracking-tight" />
        {label && (
          <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color }}>
            {label}
          </span>
        )}
        {caption && <span className="mt-0.5 text-xs text-muted">{caption}</span>}
      </div>
    </div>
  );
}
