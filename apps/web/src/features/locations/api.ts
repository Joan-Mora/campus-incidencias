import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BlockDTO, CampusDTO, SpaceDTO, SpaceRefDTO } from '@campus/shared';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/queryClient';

export function useCampusTree() {
  return useQuery({
    queryKey: keys.campus,
    queryFn: () => api<CampusDTO[]>('/api/locations'),
    staleTime: 5 * 60_000,
  });
}

export interface SpaceIndexEntry {
  space: SpaceDTO;
  block: BlockDTO;
  campus: CampusDTO;
}

/** Índice de espacios por id para ubicar incidencias en el gemelo 3D. */
export function useSpaceIndex() {
  const { data } = useCampusTree();
  return useMemo(() => {
    const index = new Map<string, SpaceIndexEntry>();
    for (const campus of data ?? []) {
      for (const block of campus.blocks) {
        for (const space of block.spaces) index.set(space.id, { space, block, campus });
      }
    }
    return index;
  }, [data]);
}

export function fetchSpaceByQr(token: string) {
  return api<SpaceRefDTO>(`/api/locations/qr/${encodeURIComponent(token)}`);
}

/** Acepta el token crudo o una URL con ?qr= o /qr/<token>. */
export function parseQrPayload(raw: string): string | null {
  const text = raw.trim();
  try {
    const url = new URL(text);
    const fromQuery = url.searchParams.get('qr');
    if (fromQuery) return fromQuery;
    const match = url.pathname.match(/\/qr\/([^/]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {
    // No es una URL: se toma como token.
  }
  return /^[a-z0-9-]{3,40}$/i.test(text) ? text.toLowerCase() : null;
}

export function toSpaceRef(entry: SpaceIndexEntry): SpaceRefDTO {
  return {
    id: entry.space.id,
    code: entry.space.code,
    name: entry.space.name,
    type: entry.space.type,
    floor: entry.space.floor,
    capacity: entry.space.capacity,
    block: { id: entry.block.id, code: entry.block.code, name: entry.block.name },
    campus: { id: entry.campus.id, code: entry.campus.code, name: entry.campus.name },
  };
}
