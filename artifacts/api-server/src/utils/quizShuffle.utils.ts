import { randomInt } from 'node:crypto';

/**
 * Generates a cryptographically strong 31-bit positive integer seed.
 * Safely fits in signed 32-bit PostgreSQL INTEGER.
 */
export function generateShuffleSeed(): number {
  return randomInt(1, 2147483647);
}

/**
 * Deterministic Mulberry32 32-bit PRNG generator.
 */
export function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a 32-bit hash combining seed, examId, and questionId into a PRNG seed.
 */
export function hashSeed(seed: number, examId: number, questionId: number = 0): number {
  let h = 2166136261 >>> 0;
  const parts = [seed, examId, questionId];
  for (const part of parts) {
    let p = part | 0;
    for (let i = 0; i < 4; i++) {
      h ^= p & 0xff;
      h = Math.imul(h, 16777619) >>> 0;
      p >>>= 8;
    }
  }
  return h;
}

/**
 * Deterministically permutes exam questions based on (seed, examId).
 * Preserves original order if seed is null/undefined or question list <= 1.
 */
export function permuteExamQuestions<T>(
  questions: T[],
  seed: number | null | undefined,
  examId: number,
): T[] {
  if (seed === null || seed === undefined || questions.length <= 1) {
    return [...questions];
  }
  const rng = createSeededRng(hashSeed(seed, examId, 0));
  const result = [...questions];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Deterministically permutes original MCQ option keys based on (seed, examId, questionId).
 * Preserves canonical order if seed is null/undefined or keys <= 1.
 */
export function permuteOptionOrder(
  availableKeys: string[],
  seed: number | null | undefined,
  examId: number,
  questionId: number,
): string[] {
  if (seed === null || seed === undefined || availableKeys.length <= 1) {
    return [...availableKeys];
  }
  const rng = createSeededRng(hashSeed(seed, examId, questionId));
  const result = [...availableKeys];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
