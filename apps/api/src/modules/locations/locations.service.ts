import type { CampusDTO, SpaceRefDTO } from '@campus/shared';
import { prisma } from '../../common/prisma';
import { notFound } from '../../common/errors';

let cache: { at: number; data: CampusDTO[] } | null = null;

export async function getCampusTree(): Promise<CampusDTO[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.data;
  const campuses = await prisma.campus.findMany({
    orderBy: { code: 'desc' },
    include: {
      blocks: {
        orderBy: { code: 'asc' },
        include: { spaces: { orderBy: [{ floor: 'asc' }, { code: 'asc' }] } },
      },
    },
  });
  const data: CampusDTO[] = campuses.map((campus) => ({
    id: campus.id,
    code: campus.code,
    name: campus.name,
    blocks: campus.blocks.map(({ campusId: _campusId, spaces, ...block }) => ({
      ...block,
      spaces: spaces.map(({ blockId: _blockId, ...space }) => space),
    })),
  }));
  cache = { at: Date.now(), data };
  return data;
}

export async function findSpaceByQr(token: string): Promise<SpaceRefDTO> {
  const space = await prisma.space.findUnique({
    where: { qrToken: token.toLowerCase() },
    include: { block: { include: { campus: true } } },
  });
  if (!space) throw notFound('Ese código QR no corresponde a ningún espacio');
  return toSpaceRef(space);
}

export async function getSpaceContext(spaceId: string) {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    include: { block: { include: { campus: true } } },
  });
  if (!space) throw notFound('El espacio no existe');
  return space;
}

export function toSpaceRef(space: Awaited<ReturnType<typeof getSpaceContext>>): SpaceRefDTO {
  return {
    id: space.id,
    code: space.code,
    name: space.name,
    type: space.type,
    floor: space.floor,
    capacity: space.capacity,
    block: { id: space.block.id, code: space.block.code, name: space.block.name },
    campus: { id: space.block.campus.id, code: space.block.campus.code, name: space.block.campus.name },
  };
}
