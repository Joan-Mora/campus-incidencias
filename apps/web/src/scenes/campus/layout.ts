import { FLOOR_HEIGHT, type BlockDTO, type CampusDTO, type SpaceDTO } from '@campus/shared';

export type Vec3 = [number, number, number];

/** Convierte un punto local del bloque (centrado, sin rotar) a coordenadas del mundo. */
export function blockToWorld(block: Pick<BlockDTO, 'posX' | 'posZ' | 'rotation'>, x: number, y: number, z: number): Vec3 {
  const cos = Math.cos(block.rotation);
  const sin = Math.sin(block.rotation);
  return [block.posX + x * cos + z * sin, y, block.posZ - x * sin + z * cos];
}

export const floorCenterY = (floor: number) => (floor - 1) * FLOOR_HEIGHT + FLOOR_HEIGHT / 2;

/** Punto en la fachada frontal del piso del espacio, ligeramente hacia afuera. */
export function spaceAnchor(block: BlockDTO, space: SpaceDTO, spread = 0): Vec3 {
  return blockToWorld(block, space.localX + spread, floorCenterY(space.floor), block.depth / 2 + 0.7);
}

/** Punto sobre el techo, encima del espacio, para las columnas de calor. */
export function roofAnchor(block: BlockDTO, space: SpaceDTO): Vec3 {
  return blockToWorld(block, space.localX, block.floors * FLOOR_HEIGHT, 0);
}

export function blockCenter(block: BlockDTO): Vec3 {
  return [block.posX, (block.floors * FLOOR_HEIGHT) / 2, block.posZ];
}

/** Desplazamiento lateral para que varias balizas del mismo espacio no se tapen. */
export function spreadOffset(index: number, total: number, step = 0.75) {
  return (index - (total - 1) / 2) * step;
}

export function campusBounds(campus: CampusDTO) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const block of campus.blocks) {
    const reach = Math.hypot(block.width, block.depth) / 2;
    minX = Math.min(minX, block.posX - reach);
    maxX = Math.max(maxX, block.posX + reach);
    minZ = Math.min(minZ, block.posZ - reach);
    maxZ = Math.max(maxZ, block.posZ + reach);
  }
  if (!Number.isFinite(minX)) return { center: [0, 0, 0] as Vec3, radius: 30 };
  const center: Vec3 = [(minX + maxX) / 2, 0, (minZ + maxZ) / 2];
  return { center, radius: Math.max(maxX - minX, maxZ - minZ) / 2 };
}

/** Indica si un punto del suelo cae dentro (o cerca) de la huella de algún bloque. */
export function insideAnyBlock(campus: CampusDTO, x: number, z: number, margin = 2.5) {
  return campus.blocks.some((block) => {
    const dx = x - block.posX;
    const dz = z - block.posZ;
    const cos = Math.cos(-block.rotation);
    const sin = Math.sin(-block.rotation);
    const lx = dx * cos + dz * sin;
    const lz = -dx * sin + dz * cos;
    return Math.abs(lx) < block.width / 2 + margin && Math.abs(lz) < block.depth / 2 + margin;
  });
}

/** Generador determinista para que la vegetación no cambie entre renders. */
export function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Luz del día de 0 (noche) a 1 (mediodía) según la hora local. */
export function daylight(date: Date) {
  const hour = date.getHours() + date.getMinutes() / 60;
  return Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
}
