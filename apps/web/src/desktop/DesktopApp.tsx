import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../core/auth/store';
import { BootScreen } from '../app/BootScreen';
import { DesktopLogin } from './DesktopLogin';
import { Shell } from './layout/Shell';
import { CommandCenterPage } from './pages/CommandCenterPage';

const BoardPage = lazy(() => import('./pages/BoardPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SuggestionsPage = lazy(() => import('./pages/SuggestionsPage'));
const MyReportsPage = lazy(() => import('./pages/MyReportsPage'));
const ProjectorPage = lazy(() => import('./pages/ProjectorPage'));

export default function DesktopApp({ projector = false }: { projector?: boolean }) {
  const user = useAuth((state) => state.user);
  if (!user) return <DesktopLogin />;

  if (projector) {
    return (
      <Suspense fallback={<BootScreen />}>
        <ProjectorPage />
      </Suspense>
    );
  }

  const isStaff = user.role !== 'STUDENT';
  return (
    <BrowserRouter>
      <Shell>
        <Suspense fallback={<BootScreen />}>
          <Routes>
            <Route path="/" element={<CommandCenterPage />} />
            <Route path="/tablero" element={isStaff ? <BoardPage /> : <Navigate to="/" replace />} />
            <Route path="/panel" element={<DashboardPage />} />
            <Route path="/sugerencias" element={isStaff ? <SuggestionsPage /> : <Navigate to="/" replace />} />
            <Route path="/mis-reportes" element={<MyReportsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Shell>
    </BrowserRouter>
  );
}
