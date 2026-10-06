import { Component, lazy, Suspense, type ReactNode } from 'react';
import { useSceneTier } from '../core/three/capability';
import { Skeleton } from '../ui/Skeleton';
import RoomPlan from './RoomPlan';
import type { RoomPickerProps } from './RoomPicker';

const RoomPicker = lazy(() => import('./RoomPicker'));

class RoomBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Salón 3D cuando el equipo lo soporta; si no, el plano 2D con la misma interacción. */
export function RoomScene(props: RoomPickerProps) {
  const tier = useSceneTier();
  const plan = <RoomPlan {...props} />;
  if (tier === 'checking') return <Skeleton className="h-full w-full rounded-none" />;
  if (tier === 'iso') return plan;
  return (
    <RoomBoundary fallback={plan}>
      <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
        <RoomPicker {...props} />
      </Suspense>
    </RoomBoundary>
  );
}
