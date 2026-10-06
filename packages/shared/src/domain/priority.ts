import { PRIORITY_LEVELS, type Category, type PriorityLevel, type RiskLevel, type SpaceType } from '../enums';

export const PRIORITY_WEIGHTS = {
  risk: 0.35,
  damageType: 0.25,
  similar: 0.2,
  space: 0.1,
  age: 0.1,
} as const;

export type PriorityFactor = keyof typeof PRIORITY_WEIGHTS;

export const RISK_VALUES: Record<RiskLevel, number> = { NONE: 0, LOW: 30, MEDIUM: 60, HIGH: 100 };

export const DAMAGE_TYPE_VALUES: Record<Category, number> = {
  ELECTRICAL: 100,
  WATER_LEAK: 80,
  STRUCTURAL: 70,
  SANITARY: 60,
  LIGHTING: 50,
  FURNITURE: 40,
  COSMETIC: 15,
};

export const SPACE_IMPACT_VALUES: Record<SpaceType, number> = {
  LAB: 100,
  CLASSROOM: 90,
  BATHROOM: 80,
  COMMON: 60,
  OFFICE: 40,
};

/** Riesgo sugerido al elegir la categoría; quien reporta puede cambiarlo. */
export const SUGGESTED_RISK: Record<Category, RiskLevel> = {
  ELECTRICAL: 'HIGH',
  WATER_LEAK: 'MEDIUM',
  STRUCTURAL: 'MEDIUM',
  SANITARY: 'LOW',
  LIGHTING: 'LOW',
  FURNITURE: 'LOW',
  COSMETIC: 'NONE',
};

export const LEVEL_THRESHOLDS: { level: PriorityLevel; min: number }[] = [
  { level: 'CRITICAL', min: 75 },
  { level: 'HIGH', min: 50 },
  { level: 'MEDIUM', min: 25 },
  { level: 'LOW', min: 0 },
];

export interface PriorityInput {
  riskLevel: RiskLevel;
  category: Category;
  /** Reportes del grupo, incluido el propio (1 si está solo). */
  similarCount: number;
  spaceType: SpaceType;
  capacity: number;
  /** Fracción del SLA de resolución consumida (0 a 1 o más). */
  slaConsumed: number;
}

export interface FactorBreakdown {
  value: number;
  weight: number;
  contribution: number;
}

export type PriorityBreakdown = Record<PriorityFactor, FactorBreakdown>;

export interface PriorityResult {
  score: number;
  baseLevel: PriorityLevel;
  breakdown: PriorityBreakdown;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

/** Crece rápido con los primeros reportes y se satura en 100 a partir de 15. */
export function similarReportsValue(count: number): number {
  return clamp(25 * Math.log2(Math.max(1, count) + 1));
}

/** El tipo de espacio fija la base; la capacidad suma hasta 10 puntos. */
export function spaceImpactValue(type: SpaceType, capacity: number): number {
  return clamp(SPACE_IMPACT_VALUES[type] + 10 * Math.min(1, Math.max(0, capacity) / 100));
}

export function computePriority(input: PriorityInput): PriorityResult {
  const values: Record<PriorityFactor, number> = {
    risk: RISK_VALUES[input.riskLevel],
    damageType: DAMAGE_TYPE_VALUES[input.category],
    similar: similarReportsValue(input.similarCount),
    space: spaceImpactValue(input.spaceType, input.capacity),
    age: clamp(input.slaConsumed * 100),
  };

  const breakdown = {} as PriorityBreakdown;
  let score = 0;
  for (const factor of Object.keys(PRIORITY_WEIGHTS) as PriorityFactor[]) {
    const weight = PRIORITY_WEIGHTS[factor];
    const contribution = values[factor] * weight;
    breakdown[factor] = { value: round1(values[factor]), weight, contribution: round1(contribution) };
    score += contribution;
  }

  const rounded = round1(score);
  return { score: rounded, baseLevel: levelFromScore(rounded), breakdown };
}

export function levelFromScore(score: number): PriorityLevel {
  return LEVEL_THRESHOLDS.find((threshold) => score >= threshold.min)?.level ?? 'LOW';
}

/** La fórmula mide gravedad; cada escalamiento por demora sube un nivel, con tope en Crítica. */
export function effectiveLevel(baseLevel: PriorityLevel, escalationSteps: number): PriorityLevel {
  const index = PRIORITY_LEVELS.indexOf(baseLevel) + Math.max(0, escalationSteps);
  return PRIORITY_LEVELS[Math.min(index, PRIORITY_LEVELS.length - 1)];
}

export function levelRank(level: PriorityLevel): number {
  return PRIORITY_LEVELS.indexOf(level);
}

export const FACTOR_LABELS: Record<PriorityFactor, string> = {
  risk: 'Riesgo para las personas',
  damageType: 'Tipo de daño',
  similar: 'Reportes similares',
  space: 'Impacto del espacio',
  age: 'Antigüedad (SLA consumido)',
};
