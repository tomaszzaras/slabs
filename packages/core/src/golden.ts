// Test helpers: loading the golden files and comparing values with a tolerance.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const GOLDEN_DIR = path.join(here, '..', '..', '..', 'fixtures', 'golden');

export function loadGolden<T = any>(name: string): T { // eslint-disable-line @typescript-eslint/no-explicit-any
  return JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, name + '.json'), 'utf8')) as T;
}

/**
 * Every key of `expected` has to be present in `actual` with an (almost) equal value;
 * `actual` may have additional keys. Returns the first difference or null.
 */
export function subsetDiff(expected: unknown, actual: unknown, path = '$', tol = 1e-7): string | null {
  if (expected === null || expected === undefined) return actual === null || actual === undefined ? null : `${path}: expected null, got ${JSON.stringify(actual)}`;
  if (typeof expected === 'number') {
    if (typeof actual !== 'number') return `${path}: expected number ${expected}, got ${JSON.stringify(actual)}`;
    return Math.abs(expected - actual) <= tol * Math.max(1, Math.abs(expected)) ? null : `${path}: expected ${expected}, got ${actual}`;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return `${path}: expected array`;
    if (expected.length !== actual.length) return `${path}: length ${expected.length} vs ${actual.length}`;
    for (let i = 0; i < expected.length; i++) {
      const d = subsetDiff(expected[i], actual[i], `${path}[${i}]`, tol);
      if (d) return d;
    }
    return null;
  }
  if (typeof expected === 'object') {
    if (typeof actual !== 'object' || actual === null) return `${path}: expected object`;
    for (const k of Object.keys(expected as object)) {
      const d = subsetDiff((expected as Record<string, unknown>)[k], (actual as Record<string, unknown>)[k], `${path}.${k}`, tol);
      if (d) return d;
    }
    return null;
  }
  return expected === actual ? null : `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
}

/**
 * Golden cases in which the ARTIFACT is wrong: a gable strip is taller than the plate, and the artifact places
 * a piece that sticks out of it (and counts a plate whose use is over 100%). The app splits such strips like boards.
 * For these cases the tests assert the corrected behaviour (same area, nothing larger than the plate, never over
 * 100%) instead of equality with the artifact. Every other case, and every other assertion, is exact.
 */
export const KNOWN_ARTIFACT_BUG: Record<string, string[]> = {
  salon: ['rand13', 'rand17', 'rand20', 'clamp3'],
  sypialnia: ['rand2', 'rand6'],
};
export const KNOWN_SHARED_BUG = ['random5', 'random7']; // Sypialnia switched on with strips taller than the plate
export const REASON = 'known artifact bug: gable strip taller than the plate overflows it';

