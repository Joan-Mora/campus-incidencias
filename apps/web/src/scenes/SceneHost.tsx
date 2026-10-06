import { Component, lazy, Suspense, type ReactNode } from 'react';
import { useSceneTier } from '../core/three/capability';
import { Skeleton } from '../ui/Skeleton';
import CampusIso from './CampusIso';
import type { CampusSceneProps } from './campus/types';

const CampusTwin = lazy(() => import('./CampusTwin'));

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('La escena 3D falló; se usa el campus isométrico.', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Elige entre el gemelo 3D (cargado bajo demanda) y el respaldo isométrico en SVG. */
export function CampusScene(props: Omit<CampusSceneProps, 'tier'>) {
  const tier = useSceneTier();
  const iso = <CampusIso {...props} />;
  if (tier === 'checking') return <Skeleton className="h-full w-full rounded-none opacity-40" />;
  if (tier === 'iso') return iso;
  return (
    <SceneBoundary fallback={iso}>
      <Suspense fallback={iso}>
        <CampusTwin {...props} tier={tier} />
      </Suspense>
    </SceneBoundary>
  );
}
