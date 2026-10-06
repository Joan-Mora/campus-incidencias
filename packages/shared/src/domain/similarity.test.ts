import { describe, expect, it } from 'vitest';
import { combineSimilarity, decideSimilarity, explainSimilarity, locationScore, tfidfCosine } from './similarity-score';
import { tokenize } from './text-normalize';

const base = { campusId: 'c1', blockId: 'b1', floor: 2, spaceId: 's204', hotspot: null };
const now = new Date('2026-10-06T10:00:00Z');

describe('normalización de texto', () => {
  it('lleva redacciones distintas a los mismos términos', () => {
    const a = tokenize('El bombillo del salón 204 está fundido');
    const b = tokenize('No prende la luz en el 204');
    expect(a).toContain('luminari');
    expect(b).toContain('luminari');
    expect(b).toContain('fund');
    expect(a).toContain('fund');
  });
});

describe('TF-IDF', () => {
  it('textos equivalentes puntúan más alto que textos distintos', () => {
    const target = tokenize('El bombillo del salón está fundido');
    const [same, different] = tfidfCosine(target, [
      tokenize('No prende la luz, la lámpara está quemada'),
      tokenize('La silla tiene la pata rota'),
    ]);
    expect(same).toBeGreaterThan(0.4);
    expect(different).toBe(0);
  });
});

describe('ubicación', () => {
  it('hotspots cercanos en el mismo espacio dan 1.0', () => {
    const a = { ...base, hotspot: { x: 1, y: 2.8, z: 0 } };
    const b = { ...base, hotspot: { x: 1.5, y: 2.8, z: 0.6 } };
    expect(locationScore(a, b).score).toBe(1);
  });
  it('mismo espacio sin hotspots da 0.8; mismo bloque y piso 0.5; mismo bloque 0.3', () => {
    expect(locationScore(base, base).score).toBe(0.8);
    expect(locationScore(base, { ...base, spaceId: 'x' }).score).toBe(0.5);
    expect(locationScore(base, { ...base, spaceId: 'x', floor: 3 }).score).toBe(0.3);
    expect(locationScore(base, { ...base, spaceId: 'x', blockId: 'b2' }).score).toBe(0.1);
  });
});

describe('puntaje combinado', () => {
  it('ejemplo del plan: mismo salón con punto cercano se agrupa', () => {
    const result = combineSimilarity({
      location: { a: { ...base, hotspot: { x: 0, y: 2.8, z: 0 } }, b: { ...base, hotspot: { x: 0.8, y: 2.8, z: 0 } } },
      category: { a: 'LIGHTING', b: 'LIGHTING' },
      createdAt: { a: now, b: now },
      tfidf: 0.5,
    });
    expect(result.score).toBeCloseTo(0.8, 2);
    expect(decideSimilarity(result.score)).toBe('group');
    expect(explainSimilarity(result)).toContain('a 0,8 m del mismo punto');
  });

  it('mismo salón sin punto queda como sugerencia', () => {
    const result = combineSimilarity({
      location: { a: base, b: base },
      category: { a: 'LIGHTING', b: 'LIGHTING' },
      createdAt: { a: now, b: now },
      tfidf: 0.5,
    });
    expect(decideSimilarity(result.score)).toBe('suggest');
  });

  it('el embedding solo reemplaza al TF-IDF si es mayor', () => {
    const result = combineSimilarity({
      location: { a: base, b: base },
      category: { a: 'LIGHTING', b: 'LIGHTING' },
      createdAt: { a: now, b: now },
      tfidf: 0.2,
      embedding: 0.9,
    });
    expect(result.textSource).toBe('embedding');
    expect(result.text).toBe(0.9);
  });
});
