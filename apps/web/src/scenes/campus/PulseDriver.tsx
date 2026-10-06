import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * Con frameloop="demand" la escena solo se dibuja cuando algo cambia. Si hay balizas que laten
 * o rotación automática, se piden cuadros a una tasa limitada; si no, la GPU descansa.
 */
export function PulseDriver({ active, fps }: { active: boolean; fps: number }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = 0;
    const interval = 1000 / fps;
    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      if (document.hidden || time - last < interval) return;
      last = time;
      invalidate();
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [active, fps, invalidate]);
  return null;
}
