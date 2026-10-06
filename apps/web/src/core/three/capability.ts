import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useUi } from '../theme/store';

export type SceneTier = 'checking' | 'full' | 'lite' | 'iso';

let cachedTier: Promise<number> | null = null;

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Nivel de GPU (0 a 3) con los benchmarks servidos localmente, sin depender de una CDN. */
function gpuTier(): Promise<number> {
  cachedTier ??= import('detect-gpu')
    .then(({ getGPUTier }) => getGPUTier({ benchmarksURL: '/gpu-benchmarks' }))
    .then((result) => result.tier)
    .catch(() => (hasWebGL() ? 2 : 0));
  return cachedTier;
}

/**
 * Decide cómo mostrar las escenas: 3D completo, 3D ligero (sin sombras ni postefectos)
 * o el campus isométrico en SVG para equipos sin WebGL o con movimiento reducido.
 */
export function useSceneTier(): SceneTier {
  const preference = useUi((state) => state.sceneMode);
  const reducedMotion = useReducedMotion();
  const [tier, setTier] = useState<SceneTier>('checking');

  useEffect(() => {
    if (preference === 'iso') return setTier('iso');
    if (!hasWebGL()) return setTier('iso');
    if (preference === '3d') return setTier('full');
    let alive = true;
    gpuTier().then((value) => {
      if (!alive) return;
      if (value <= 0 || reducedMotion) setTier('iso');
      else setTier(value === 1 ? 'lite' : 'full');
    });
    return () => {
      alive = false;
    };
  }, [preference, reducedMotion]);

  return tier;
}
