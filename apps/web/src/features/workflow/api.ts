import { useMutation, useQuery } from '@tanstack/react-query';
import {
  availableTransitions,
  type IncidentDTO,
  type IncidentStatus,
  type TransitionInput,
  type TransitionRule,
  type UserDTO,
} from '@campus/shared';
import { api } from '../../core/api/client';
import { keys, queryClient } from '../../core/api/queryClient';

export function useTransition() {
  return useMutation({
    mutationFn: ({ incidentId, ...input }: TransitionInput & { incidentId: string }) =>
      api<{ incidentId: string; from: IncidentStatus; to: IncidentStatus }>(`/api/incidents/${incidentId}/transition`, { body: input }),
    onSuccess: ({ incidentId }) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: keys.incident(incidentId) });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useTechnicians(enabled = true) {
  return useQuery({
    queryKey: keys.technicians,
    queryFn: () => api<(UserDTO & { openAssigned: number })[]>('/api/auth/technicians'),
    enabled,
    staleTime: 60_000,
  });
}

/** Misma política que aplica el API, evaluada en el navegador para mostrar solo acciones válidas. */
export function transitionsFor(user: UserDTO | null, incident: IncidentDTO): TransitionRule[] {
  if (!user || !incident.isClusterPrimary) return [];
  return availableTransitions(
    { id: user.id, role: user.role },
    { status: incident.status, reporterId: incident.reporter.id, assigneeId: incident.assignee?.id ?? null },
  );
}
