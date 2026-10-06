import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
    mutations: { retry: false },
  },
});

/** Claves de consulta centralizadas para que el tiempo real invalide con precisión. */
export const keys = {
  incidents: (filters?: object) => ['incidents', filters ?? {}] as const,
  incident: (id: string) => ['incident', id] as const,
  campus: ['campus'] as const,
  dashboard: (part: string, params?: object) => ['dashboard', part, params ?? {}] as const,
  suggestions: ['suggestions'] as const,
  technicians: ['technicians'] as const,
  devUsers: ['dev-users'] as const,
};
