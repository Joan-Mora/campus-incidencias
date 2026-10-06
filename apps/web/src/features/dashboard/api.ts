import { useQuery } from '@tanstack/react-query';
import type {
  DashboardSummaryDTO,
  HeatCellDTO,
  IncidentDTO,
  ResolutionTimeDTO,
  SlaComplianceDTO,
  TimelineDTO,
  TopSpaceDTO,
} from '@campus/shared';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/queryClient';

const dashboardQuery = <T,>(part: string, params?: Record<string, string | number>) => ({
  queryKey: keys.dashboard(part, params),
  queryFn: () => api<T>(`/api/dashboard/${part}`, { query: params }),
});

export const useSummary = () => useQuery(dashboardQuery<DashboardSummaryDTO>('summary'));
export const useOverdue = () => useQuery(dashboardQuery<IncidentDTO[]>('overdue'));
export const useResolutionTime = () => useQuery(dashboardQuery<ResolutionTimeDTO[]>('resolution-time'));
export const useTopSpaces = () => useQuery(dashboardQuery<TopSpaceDTO[]>('top-spaces'));
export const useSlaCompliance = () => useQuery(dashboardQuery<SlaComplianceDTO[]>('sla-compliance'));
export const useHeatmap = () => useQuery(dashboardQuery<HeatCellDTO[]>('heatmap'));

/** Historia compacta para la repetición temporal; se reconstruye en el navegador con snapshotAt. */
export const useTimeline = (days = 14, enabled = true) =>
  useQuery({ ...dashboardQuery<TimelineDTO>('timeline', { days }), enabled, staleTime: 60_000 });
