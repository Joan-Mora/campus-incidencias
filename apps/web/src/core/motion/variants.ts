import type { Variants } from 'framer-motion';
import { duration, ease, spring, transition } from './tokens';

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: transition.slow },
  exit: { opacity: 0, y: -8, transition: transition.fast },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transition.base },
  exit: { opacity: 0, transition: transition.fast },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: spring.bouncy },
  exit: { opacity: 0, scale: 0.96, transition: transition.fast },
};

export const stagger = (step = 0.05, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

export const listItem: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: spring.gentle },
  exit: { opacity: 0, x: 16, transition: transition.fast },
};

export const slideFromEdge = (edge: 'left' | 'right' | 'bottom'): Variants => {
  const offset = edge === 'left' ? { x: -32 } : edge === 'right' ? { x: 32 } : { y: 40 };
  return {
    hidden: { opacity: 0, ...offset },
    show: { opacity: 1, x: 0, y: 0, transition: spring.gentle },
    exit: { opacity: 0, ...offset, transition: transition.base },
  };
};

/** Pasos del asistente móvil: entra por la dirección del avance. */
export const wizardStep: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction > 0 ? 56 : -56 }),
  center: { opacity: 1, x: 0, transition: spring.gentle },
  leave: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -56 : 56,
    transition: { duration: duration.base, ease: ease.gentle },
  }),
};

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: transition.slow },
  exit: { opacity: 0, y: -6, filter: 'blur(4px)', transition: transition.fast },
};
