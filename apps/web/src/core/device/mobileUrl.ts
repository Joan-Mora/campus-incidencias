import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

/**
 * Dirección que un celular de la misma red puede abrir. Si el escritorio está en localhost
 * se reemplaza por la IP local que reporta el API.
 */
export function useMobileUrl(path = '/') {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<{ lanAddresses?: string[] }>('/api/health'),
    staleTime: 5 * 60_000,
  });
  const { protocol, hostname, port } = window.location;
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  const host = local && health.data?.lanAddresses?.[0] ? health.data.lanAddresses[0] : hostname;
  const url = new URL(`${protocol}//${host}${port ? `:${port}` : ''}${path}`);
  url.searchParams.set('view', 'mobile');
  return url.toString();
}
