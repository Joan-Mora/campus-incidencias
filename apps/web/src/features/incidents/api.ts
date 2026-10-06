import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type {
  CreateIncidentInput,
  EvidenceDTO,
  IncidentDetailDTO,
  IncidentDTO,
  PreviewIncidentInput,
  PriorityPreviewDTO,
  RiskLevel,
} from '@campus/shared';
import { api } from '../../core/api/client';
import { keys, queryClient } from '../../core/api/queryClient';

export interface IncidentFilters {
  status?: string;
  level?: string;
  blockId?: string;
  spaceId?: string;
  campusId?: string;
  mine?: boolean;
  assignedToMe?: boolean;
  overdue?: boolean;
  q?: string;
  limit?: number;
}

export function useIncidents(filters: IncidentFilters = {}, options: { enabled?: boolean } = {}) {
  const query = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== false && value !== ''));
  return useQuery({
    queryKey: keys.incidents(query),
    queryFn: ({ signal }) => api<IncidentDTO[]>('/api/incidents', { query, signal }),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useIncident(id: string | null | undefined) {
  return useQuery({
    queryKey: keys.incident(id ?? 'none'),
    queryFn: ({ signal }) => api<IncidentDetailDTO>(`/api/incidents/${id}`, { signal }),
    enabled: Boolean(id),
  });
}

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Vista previa de prioridad y posibles duplicados mientras se escribe el reporte. */
export function usePriorityPreview(draft: Partial<PreviewIncidentInput>) {
  const debounced = useDebounced(draft, 350);
  const ready = Boolean(debounced.spaceId && debounced.category && debounced.riskLevel);
  return useQuery({
    queryKey: ['preview', debounced],
    queryFn: ({ signal }) => api<PriorityPreviewDTO>('/api/incidents/preview', { body: { description: '', ...debounced }, signal }),
    enabled: ready,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

const invalidateIncident = (id: string) => {
  queryClient.invalidateQueries({ queryKey: ['incidents'] });
  queryClient.invalidateQueries({ queryKey: keys.incident(id) });
};

export function useCreateIncident() {
  return useMutation({
    mutationFn: (input: CreateIncidentInput) => api<IncidentDTO>('/api/incidents', { body: input }),
    onSuccess: (incident) => invalidateIncident(incident.id),
  });
}

export function uploadEvidence(incidentId: string, file: Blob, stage: 'REPORT' | 'FIX') {
  const form = new FormData();
  form.append('file', file, file instanceof File ? file.name : 'evidencia.jpg');
  return api<EvidenceDTO>(`/api/incidents/${incidentId}/evidence`, { form, query: { stage } });
}

export function useUploadEvidence() {
  return useMutation({
    mutationFn: ({ incidentId, file, stage }: { incidentId: string; file: Blob; stage: 'REPORT' | 'FIX' }) =>
      uploadEvidence(incidentId, file, stage),
    onSuccess: (_, { incidentId }) => invalidateIncident(incidentId),
  });
}

export function useComment() {
  return useMutation({
    mutationFn: ({ incidentId, text }: { incidentId: string; text: string }) =>
      api(`/api/incidents/${incidentId}/comments`, { body: { text } }),
    onSuccess: (_, { incidentId }) => invalidateIncident(incidentId),
  });
}

export function useCorrectRisk() {
  return useMutation({
    mutationFn: ({ incidentId, riskLevel, note }: { incidentId: string; riskLevel: RiskLevel; note?: string }) =>
      api(`/api/incidents/${incidentId}/risk`, { method: 'PATCH', body: { riskLevel, note } }),
    onSuccess: (_, { incidentId }) => invalidateIncident(incidentId),
  });
}
