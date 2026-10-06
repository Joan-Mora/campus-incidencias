import { motion } from 'framer-motion';
import { duration, ease } from '../core/motion';

/** Marca propia: edificio con una línea de pulso que lo atraviesa. Mismo trazo que los íconos. */
export function BrandMark({ size = 36, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="El Campus También Se Daña" role="img">
      <defs>
        <linearGradient id="brand-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#141f3d" />
          <stop offset="1" stopColor="#070b16" />
        </linearGradient>
        <linearGradient id="brand-pulse" x1="10" y1="0" x2="54" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--level-medium)" />
          <stop offset="1" stopColor="var(--level-critical)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#brand-bg)" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" stroke="white" strokeOpacity="0.08" />
      <path d="M14 46V26l18-10 18 10v20" stroke="#c9d6f2" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <motion.path
        d="M10 38h10l4-8 6 14 5-10 3 4h16"
        stroke="url(#brand-pulse)"
        strokeWidth="3.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        initial={animated ? { pathLength: 0 } : false}
        animate={animated ? { pathLength: [0, 1, 1], opacity: [1, 1, 0.4] } : undefined}
        transition={animated ? { duration: duration.scene * 1.5, ease: ease.out, repeat: Infinity, repeatDelay: 0.4 } : undefined}
      />
      <circle cx="32" cy="24" r="2.6" fill="var(--level-critical)" />
    </svg>
  );
}
