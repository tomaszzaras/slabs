export const f = (v: number): number => Math.round(v);

/** mulberry32 PRNG, exactly as in the artifact. */
export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Params = Record<string, number>;

/** Strips decimals in numbers inside warning messages ("12.5" -> "12"), as the artifact does for some rooms. */
export const stripDecimals = (t: string): string => t.replace(/(\d+)\.\d+/g, '$1');
