import { describe, expect, it } from 'vitest';
import { computePriority, effectiveLevel, levelFromScore, similarReportsValue, spaceImpactValue } from './priority';

describe('fórmula de prioridad', () => {
  it('cable expuesto en laboratorio con un reporte es Crítica (75)', () => {
    const result = computePriority({
      riskLevel: 'HIGH',
      category: 'ELECTRICAL',
      similarCount: 1,
      spaceType: 'LAB',
      capacity: 30,
      slaConsumed: 0,
    });
    expect(result.score).toBe(75);
    expect(result.baseLevel).toBe('CRITICAL');
    expect(result.breakdown.risk.contribution).toBe(35);
  });

  it('silla rayada con tres reportes sigue en Baja', () => {
    const result = computePriority({
      riskLevel: 'NONE',
      category: 'COSMETIC',
      similarCount: 3,
      spaceType: 'CLASSROOM',
      capacity: 0,
      slaConsumed: 0,
    });
    expect(result.score).toBe(22.8);
    expect(result.baseLevel).toBe('LOW');
  });

  it('muchos reportes de un daño menor no superan un riesgo vital', () => {
    const minor = computePriority({
      riskLevel: 'NONE',
      category: 'COSMETIC',
      similarCount: 40,
      spaceType: 'CLASSROOM',
      capacity: 40,
      slaConsumed: 0.5,
    });
    const vital = computePriority({
      riskLevel: 'HIGH',
      category: 'ELECTRICAL',
      similarCount: 1,
      spaceType: 'OFFICE',
      capacity: 5,
      slaConsumed: 0,
    });
    expect(minor.score).toBeLessThan(vital.score);
  });

  it('el valor de reportes similares se satura en 100', () => {
    expect(similarReportsValue(1)).toBe(25);
    expect(similarReportsValue(3)).toBe(50);
    expect(similarReportsValue(7)).toBe(75);
    expect(similarReportsValue(15)).toBe(100);
    expect(similarReportsValue(200)).toBe(100);
  });

  it('la capacidad suma hasta 10 puntos sin pasar de 100', () => {
    expect(spaceImpactValue('CLASSROOM', 100)).toBe(100);
    expect(spaceImpactValue('LAB', 100)).toBe(100);
    expect(spaceImpactValue('OFFICE', 50)).toBe(45);
  });

  it('umbrales de nivel', () => {
    expect(levelFromScore(75)).toBe('CRITICAL');
    expect(levelFromScore(74.9)).toBe('HIGH');
    expect(levelFromScore(50)).toBe('HIGH');
    expect(levelFromScore(25)).toBe('MEDIUM');
    expect(levelFromScore(24.9)).toBe('LOW');
  });

  it('el escalamiento sube niveles con tope en Crítica', () => {
    expect(effectiveLevel('LOW', 1)).toBe('MEDIUM');
    expect(effectiveLevel('MEDIUM', 2)).toBe('CRITICAL');
    expect(effectiveLevel('HIGH', 5)).toBe('CRITICAL');
  });
});
