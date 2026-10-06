import { lazy, Suspense } from 'react';
import { useViewMode } from '../core/device/viewMode';
import { BootScreen } from './BootScreen';

const DesktopApp = lazy(() => import('../desktop/DesktopApp'));
const MobileApp = lazy(() => import('../mobile/MobileApp'));

/** Carga solo el árbol de interfaz que corresponde al dispositivo. */
export function DeviceGate() {
  const mode = useViewMode();
  return (
    <Suspense fallback={<BootScreen />}>{mode === 'mobile' ? <MobileApp /> : <DesktopApp projector={mode === 'projector'} />}</Suspense>
  );
}
