import type { Transition } from 'framer-motion';

/** Duraciones en segundos. Única fuente para todas las animaciones de la interfaz. */
export const duration = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
  scene: 1.2,
  /** Ciclos continuos de fondo: barrido del lector QR, respiración de indicadores. */
  ambient: 2.6,
} as const;

export const ease = {
  snappy: [0.2, 0.9, 0.3, 1],
  gentle: [0.4, 0, 0.2, 1],
  out: [0.16, 1, 0.3, 1],
} as const;

export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 },
  gentle: { type: 'spring', stiffness: 220, damping: 30 },
  bouncy: { type: 'spring', stiffness: 380, damping: 18 },
  layout: { type: 'spring', stiffness: 420, damping: 40 },
} satisfies Record<string, Transition>;

export const transition = {
  fast: { duration: duration.fast, ease: ease.snappy },
  base: { duration: duration.base, ease: ease.snappy },
  slow: { duration: duration.slow, ease: ease.out },
} satisfies Record<string, Transition>;

/** Amortiguación de cámaras y objetos 3D (maath easing, en segundos hasta asentarse). */
export const sceneDamping = {
  camera: 0.45,
  beacon: 0.25,
  column: 0.35,
} as const;
