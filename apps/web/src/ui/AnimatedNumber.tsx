import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { duration, ease } from '../core/motion';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}

/** Contador que se desliza hasta el nuevo valor. */
export function AnimatedNumber({ value, decimals = 0, suffix = '', className }: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(value);
  const text = useTransform(motionValue, (latest) =>
    `${latest.toLocaleString('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`,
  );

  useEffect(() => {
    if (reduced) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: duration.scene, ease: ease.out });
    return () => controls.stop();
  }, [value, reduced, motionValue]);

  return <motion.span className={`tabular ${className ?? ''}`}>{text}</motion.span>;
}
