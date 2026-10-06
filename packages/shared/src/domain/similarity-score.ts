import type { Category } from '../enums';

export const SIMILARITY_WEIGHTS = { location: 0.35, category: 0.15, text: 0.4, time: 0.1 } as const;
export const AUTO_GROUP_THRESHOLD = 0.75;
export const SUGGEST_THRESHOLD = 0.55;
export const HOTSPOT_NEAR_METERS = 2;
export const TIME_DECAY_HOURS = 72;

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface LocationRef {
  campusId: string;
  blockId: string;
  floor: number;
  spaceId: string;
  hotspot: Point3 | null;
}

export interface SimilarityBreakdown {
  location: number;
  category: number;
  text: number;
  time: number;
  score: number;
  /** Distancia entre hotspots en metros cuando ambos existen en el mismo espacio. */
  hotspotDistance: number | null;
  textSource: 'tfidf' | 'embedding';
}

export type SimilarityDecision = 'group' | 'suggest' | 'none';

export function distance3(a: Point3, b: Point3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function locationScore(a: LocationRef, b: LocationRef): { score: number; hotspotDistance: number | null } {
  if (a.spaceId === b.spaceId) {
    if (a.hotspot && b.hotspot) {
      const distance = distance3(a.hotspot, b.hotspot);
      return { score: distance < HOTSPOT_NEAR_METERS ? 1 : 0.8, hotspotDistance: distance };
    }
    return { score: 0.8, hotspotDistance: null };
  }
  if (a.blockId === b.blockId) return { score: a.floor === b.floor ? 0.5 : 0.3, hotspotDistance: null };
  if (a.campusId === b.campusId) return { score: 0.1, hotspotDistance: null };
  return { score: 0, hotspotDistance: null };
}

const RELATED_CATEGORIES: [Category, Category][] = [
  ['ELECTRICAL', 'LIGHTING'],
  ['WATER_LEAK', 'SANITARY'],
  ['STRUCTURAL', 'WATER_LEAK'],
];

export function categoryScore(a: Category, b: Category): number {
  if (a === b) return 1;
  const related = RELATED_CATEGORIES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return related ? 0.5 : 0;
}

export function timeScore(a: Date, b: Date): number {
  const hours = Math.abs(a.getTime() - b.getTime()) / 3_600_000;
  return Math.exp(-hours / TIME_DECAY_HOURS);
}

/**
 * Similitud coseno TF-IDF entre un documento y cada candidato.
 * El IDF se calcula sobre el corpus local (documento + candidatos), con suavizado.
 */
export function tfidfCosine(target: string[], candidates: string[][]): number[] {
  const corpus = [target, ...candidates];
  const documentFrequency = new Map<string, number>();
  for (const doc of corpus) {
    for (const term of new Set(doc)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }
  const n = corpus.length;
  const idf = (term: string) => Math.log((n + 1) / ((documentFrequency.get(term) ?? 0) + 1)) + 1;

  const vectorize = (doc: string[]) => {
    const counts = new Map<string, number>();
    for (const term of doc) counts.set(term, (counts.get(term) ?? 0) + 1);
    const vector = new Map<string, number>();
    for (const [term, count] of counts) vector.set(term, (count / doc.length) * idf(term));
    return vector;
  };

  const norm = (vector: Map<string, number>) => Math.sqrt([...vector.values()].reduce((sum, v) => sum + v * v, 0));
  const targetVector = vectorize(target);
  const targetNorm = norm(targetVector);

  return candidates.map((doc) => {
    if (doc.length === 0 || target.length === 0) return 0;
    const vector = vectorize(doc);
    let dot = 0;
    for (const [term, weight] of vector) dot += weight * (targetVector.get(term) ?? 0);
    const denominator = norm(vector) * targetNorm;
    return denominator === 0 ? 0 : dot / denominator;
  });
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

export interface SimilarityInput {
  location: { a: LocationRef; b: LocationRef };
  category: { a: Category; b: Category };
  createdAt: { a: Date; b: Date };
  tfidf: number;
  embedding?: number | null;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

export function combineSimilarity(input: SimilarityInput): SimilarityBreakdown {
  const location = locationScore(input.location.a, input.location.b);
  const category = categoryScore(input.category.a, input.category.b);
  const useEmbedding = input.embedding != null && input.embedding > input.tfidf;
  const text = Math.max(0, Math.min(1, useEmbedding ? (input.embedding as number) : input.tfidf));
  const time = timeScore(input.createdAt.a, input.createdAt.b);
  const score =
    SIMILARITY_WEIGHTS.location * location.score +
    SIMILARITY_WEIGHTS.category * category +
    SIMILARITY_WEIGHTS.text * text +
    SIMILARITY_WEIGHTS.time * time;
  return {
    location: round3(location.score),
    category: round3(category),
    text: round3(text),
    time: round3(time),
    score: round3(score),
    hotspotDistance: location.hotspotDistance == null ? null : round3(location.hotspotDistance),
    textSource: useEmbedding ? 'embedding' : 'tfidf',
  };
}

export function decideSimilarity(score: number): SimilarityDecision {
  if (score >= AUTO_GROUP_THRESHOLD) return 'group';
  if (score >= SUGGEST_THRESHOLD) return 'suggest';
  return 'none';
}

/** Frase corta para la interfaz: "mismo salón, a 0,8 m del mismo punto, texto 82 % similar". */
export function explainSimilarity(breakdown: SimilarityBreakdown): string {
  const parts: string[] = [];
  if (breakdown.location >= 0.8) {
    parts.push(
      breakdown.hotspotDistance != null
        ? `mismo salón, a ${breakdown.hotspotDistance.toFixed(1).replace('.', ',')} m del mismo punto`
        : 'mismo salón',
    );
  } else if (breakdown.location >= 0.5) parts.push('mismo bloque y piso');
  else if (breakdown.location >= 0.3) parts.push('mismo bloque');
  if (breakdown.category === 1) parts.push('misma categoría');
  else if (breakdown.category > 0) parts.push('categoría relacionada');
  parts.push(`texto ${Math.round(breakdown.text * 100)} % similar${breakdown.textSource === 'embedding' ? ' (IA)' : ''}`);
  return parts.join(', ');
}
