import { useMemo, useSyncExternalStore } from 'react';
import type { PriorityLevel } from '@campus/shared';

/** Clases de Tailwind por nivel; todas salen de los tokens --color-level-*. */
export const LEVEL_STYLES: Record<PriorityLevel, { text: string; bg: string; soft: string; border: string; ring: string }> = {
  CRITICAL: {
    text: 'text-level-critical',
    bg: 'bg-level-critical',
    soft: 'bg-level-critical/12',
    border: 'border-level-critical/40',
    ring: 'ring-level-critical/40',
  },
  HIGH: {
    text: 'text-level-high',
    bg: 'bg-level-high',
    soft: 'bg-level-high/12',
    border: 'border-level-high/40',
    ring: 'ring-level-high/40',
  },
  MEDIUM: {
    text: 'text-level-medium',
    bg: 'bg-level-medium',
    soft: 'bg-level-medium/12',
    border: 'border-level-medium/40',
    ring: 'ring-level-medium/40',
  },
  LOW: {
    text: 'text-level-low',
    bg: 'bg-level-low',
    soft: 'bg-level-low/12',
    border: 'border-level-low/40',
    ring: 'ring-level-low/40',
  },
};

const VAR_BY_LEVEL: Record<PriorityLevel, string> = {
  CRITICAL: '--level-critical',
  HIGH: '--level-high',
  MEDIUM: '--level-medium',
  LOW: '--level-low',
};

export const levelVar = (level: PriorityLevel) => `var(${VAR_BY_LEVEL[level]})`;

function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

const readTheme = () => document.documentElement.dataset.theme ?? 'dark';

/** Tema aplicado realmente en el documento (no la preferencia), para leer variables CSS. */
export function useAppliedTheme() {
  return useSyncExternalStore(subscribeTheme, readTheme);
}

/** Colores hexadecimales de los niveles para three.js y Recharts, recalculados al cambiar de tema. */
export function useLevelColors(): Record<PriorityLevel, string> {
  const theme = useAppliedTheme();
  return useMemo(() => {
    const styles = getComputedStyle(document.documentElement);
    const read = (level: PriorityLevel) => styles.getPropertyValue(VAR_BY_LEVEL[level]).trim() || '#888888';
    return { CRITICAL: read('CRITICAL'), HIGH: read('HIGH'), MEDIUM: read('MEDIUM'), LOW: read('LOW') };
    // El tema no se usa dentro, pero al cambiar hay que volver a leer las variables CSS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}

/** Lee cualquier variable CSS del tema actual (para materiales 3D). */
export function useCssVars<T extends string>(names: readonly T[]): Record<T, string> {
  const theme = useAppliedTheme();
  const signature = names.join('|');
  return useMemo(() => {
    const styles = getComputedStyle(document.documentElement);
    return Object.fromEntries(signature.split('|').map((name) => [name, styles.getPropertyValue(`--${name}`).trim()])) as Record<
      T,
      string
    >;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, signature]);
}
