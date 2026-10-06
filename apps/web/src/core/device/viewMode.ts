import { useEffect, useState } from 'react';

export type ViewMode = 'desktop' | 'mobile' | 'projector';

const OVERRIDE_KEY = 'campus-view';

/** `?view=mobile|desktop|projector` fuerza el árbol y se recuerda en la pestaña; `?view=auto` lo borra. */
function readOverride(): ViewMode | null {
  const param = new URLSearchParams(window.location.search).get('view');
  if (param === 'auto') {
    sessionStorage.removeItem(OVERRIDE_KEY);
    return null;
  }
  if (param === 'mobile' || param === 'desktop' || param === 'projector') {
    sessionStorage.setItem(OVERRIDE_KEY, param);
    return param;
  }
  const stored = sessionStorage.getItem(OVERRIDE_KEY);
  return stored === 'mobile' || stored === 'desktop' || stored === 'projector' ? stored : null;
}

function detect(): ViewMode {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.innerWidth < 900;
  const portraitTablet = coarse && window.innerWidth < 1100 && window.innerHeight > window.innerWidth;
  return narrow || portraitTablet ? 'mobile' : 'desktop';
}

export function useViewMode(): ViewMode {
  const [override] = useState(readOverride);
  const [mode, setMode] = useState<ViewMode>(() => override ?? detect());

  useEffect(() => {
    if (override) return;
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setMode(detect()));
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, [override]);

  return mode;
}

export function setViewOverride(mode: ViewMode | 'auto') {
  const url = new URL(window.location.href);
  url.searchParams.set('view', mode);
  window.location.href = url.toString();
}

export const supportsVibration = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

export function haptic(pattern: number | number[] = 12) {
  if (supportsVibration()) navigator.vibrate(pattern);
}
