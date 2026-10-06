import type { Category, SpaceType } from '../enums';

/** Dimensiones en metros del modelo 3D de cada tipo de espacio, centrado en el origen. */
export const ROOM_DIMENSIONS: Record<SpaceType, { width: number; depth: number; height: number }> = {
  CLASSROOM: { width: 9, depth: 7, height: 3 },
  LAB: { width: 10, depth: 7, height: 3 },
  BATHROOM: { width: 5, depth: 4, height: 2.8 },
  COMMON: { width: 12, depth: 9, height: 3.4 },
  OFFICE: { width: 5, depth: 4, height: 2.8 },
};

export const FLOOR_HEIGHT = 3.4;

/** Categorías que tienen sentido en cada tipo de espacio (para el seed y el simulador). */
export const CATEGORIES_BY_SPACE: Record<SpaceType, Category[]> = {
  CLASSROOM: ['LIGHTING', 'ELECTRICAL', 'FURNITURE', 'STRUCTURAL', 'COSMETIC', 'WATER_LEAK'],
  LAB: ['ELECTRICAL', 'LIGHTING', 'FURNITURE', 'WATER_LEAK', 'STRUCTURAL'],
  BATHROOM: ['SANITARY', 'WATER_LEAK', 'LIGHTING', 'STRUCTURAL'],
  COMMON: ['LIGHTING', 'STRUCTURAL', 'COSMETIC', 'WATER_LEAK', 'FURNITURE'],
  OFFICE: ['ELECTRICAL', 'FURNITURE', 'LIGHTING', 'COSMETIC'],
};
