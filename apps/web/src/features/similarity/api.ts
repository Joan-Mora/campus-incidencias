import { useMutation, useQuery } from '@tanstack/react-query';
import type { GroupSuggestionDTO } from '@campus/shared';
import { api } from '../../core/api/client';
import { keys, queryClient } from '../../core/api/queryClient';

export function useSuggestions(enabled = true) {
  return useQuery({
    queryKey: keys.suggestions,
    queryFn: () => api<GroupSuggestionDTO[]>('/api/similarity/suggestions'),
    enabled,
  });
}

const refreshAll = () => {
  queryClient.invalidateQueries({ queryKey: keys.suggestions });
  queryClient.invalidateQueries({ queryKey: ['incidents'] });
  queryClient.invalidateQueries({ queryKey: ['incident'] });
};

export function useDecideSuggestion() {
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'accept' | 'reject' }) =>
      api(`/api/similarity/suggestions/${id}`, { body: { decision } }),
    onSuccess: refreshAll,
  });
}

export function useMerge() {
  return useMutation({
    mutationFn: ({ incidentId, targetIncidentId }: { incidentId: string; targetIncidentId: string }) =>
      api(`/api/similarity/incidents/${incidentId}/merge`, { body: { targetIncidentId } }),
    onSuccess: refreshAll,
  });
}

export function useUngroup() {
  return useMutation({
    mutationFn: (incidentId: string) => api(`/api/similarity/incidents/${incidentId}/ungroup`, { method: 'POST' }),
    onSuccess: refreshAll,
  });
}
