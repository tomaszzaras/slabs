// The floor plan of a room as a rectilinear polygon (all angles 90 degrees): drawn as cells on a grid, then every wall gets its own length.
// Vertices in cm, x across, y along the room (the z of the models), counter-clockwise (y up); edge i runs from pts[i] to pts[i+1].
import type { Pt } from './types';

export type Outline = Pt[];
export interface OutlineEdge { i: number; a: Pt; b: Pt; len: number; /** unit direction */ d: Pt }

const EPS = 1e-6;
export const MIN_WALL = 10;

/** Cells (rows from the top, columns from the left; true = floor) -> the outline of one hole-free region, or an error key. */
export function cellsToOutline(cells: boolean[][], cell = 100): { outline: Outline } | { error: 'empty' | 'disconnected' | 'hole' | 'pinch' } {
  const R = cells.length, C = R ? cells[0]!.length : 0;
  const on = (r: number, c: number) => r >= 0 && r < R && c >= 0 && c < C && cells[r]![c]!;
  let n = 0;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (on(r, c)) n++;
  if (!n) return { error: 'empty' };
  // one connected region (4-neighbours)
  const seen = new Set<string>();
  const first = (() => { for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (on(r, c)) return [r, c] as const; return [0, 0] as const; })();
  const stack: Array<readonly [number, number]> = [first];
  while (stack.length) {
    const [r, c] = stack.pop()!;
    const k = r + ',' + c;
    if (seen.has(k) || !on(r, c)) continue;
    seen.add(k);
    stack.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
  }
  if (seen.size !== n) return { error: 'disconnected' };
  // boundary segments with the floor on the left (counter-clockwise), y up: grid vertex (c, R - r)
  const next = new Map<string, Array<[number, number]>>();
  const seg = (x0: number, y0: number, x1: number, y1: number) => { const k = x0 + ',' + y0; (next.get(k) ?? next.set(k, []).get(k)!).push([x1, y1]); };
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (!on(r, c)) continue;
    const x = c, y = R - r - 1; // lower-left corner of the cell
    if (!on(r + 1, c)) seg(x, y, x + 1, y); // bottom
    if (!on(r, c + 1)) seg(x + 1, y, x + 1, y + 1); // right
    if (!on(r - 1, c)) seg(x + 1, y + 1, x, y + 1); // top
    if (!on(r, c - 1)) seg(x, y + 1, x, y); // left
  }
  for (const v of next.values()) if (v.length > 1) return { error: 'pinch' }; // two cells touching at a corner only
  const start = [...next.keys()][0]!;
  const loop: Array<[number, number]> = [];
  let cur = start;
  do {
    const [x, y] = cur.split(',').map(Number) as [number, number];
    loop.push([x, y]);
    cur = next.get(cur)![0]!.join(',');
  } while (cur !== start && loop.length < 1000);
  if (loop.length < [...next.values()].length) return { error: 'hole' }; // a second loop: the region has a hole
  // merge collinear vertices
  const pts = loop.filter((p, i) => {
    const a = loop[(i + loop.length - 1) % loop.length]!, b = loop[(i + 1) % loop.length]!;
    return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
  });
  return { outline: normalise(pts.map((p): Pt => [p[0] * cell, p[1] * cell])) };
}

export const rectOutline = (w: number, l: number): Outline => [[0, 0], [w, 0], [w, l], [0, l]];

export function edgesOf(o: Outline): OutlineEdge[] {
  return o.map((a, i) => {
    const b = o[(i + 1) % o.length]!;
    const len = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
    return { i, a, b, len, d: [len ? (b[0] - a[0]) / len : 0, len ? (b[1] - a[1]) / len : 0] as Pt };
  });
}

export function bbox(o: Outline): { x0: number; y0: number; x1: number; y1: number; w: number; l: number } {
  const xs = o.map((p) => p[0]), ys = o.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { x0, y0, x1, y1, w: x1 - x0, l: y1 - y0 };
}

export function area(o: Outline): number {
  let s = 0;
  o.forEach((a, i) => { const b = o[(i + 1) % o.length]!; s += a[0] * b[1] - b[0] * a[1]; });
  return s / 2;
}

const cross = (o: Pt, p: Pt, q: Pt) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
function segsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  return d1 * d2 < -EPS && d3 * d4 < -EPS;
}
const onSeg = (p: Pt, a: Pt, b: Pt) => Math.abs(cross(a, b, p)) < EPS && p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS && p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS;

/** A simple (non self-touching) rectilinear polygon with every wall at least MIN_WALL long. */
export function validOutline(o: Outline): boolean {
  if (o.length < 4) return false;
  const es = edgesOf(o);
  if (es.some((e) => e.len < MIN_WALL - EPS || (Math.abs(e.d[0]) > EPS && Math.abs(e.d[1]) > EPS))) return false;
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
    const adjacent = j === i + 1 || (i === 0 && j === es.length - 1);
    const A = es[i]!, B = es[j]!;
    if (segsCross(A.a, A.b, B.a, B.b)) return false;
    if (!adjacent && (onSeg(A.a, B.a, B.b) || onSeg(A.b, B.a, B.b) || onSeg(B.a, A.a, A.b) || onSeg(B.b, A.a, A.b))) return false;
  }
  return area(o) > 0;
}

/**
 * Sets the length of wall i. The wall that follows it moves (so the angles stay 90 degrees); the wall after that gets longer or shorter by the
 * same amount. Null when the result would not be a valid room (a wall under MIN_WALL, walls crossing).
 */
export function setWallLength(o: Outline, i: number, len: number): Outline | null {
  const es = edgesOf(o), e = es[i];
  if (!e || !isFinite(len) || len < MIN_WALL) return null;
  const delta = len - e.len;
  if (Math.abs(delta) < EPS) return o;
  const n = o.length, j = (i + 1) % n, k = (i + 2) % n;
  const out = o.map((p, q): Pt => (q === j || q === k ? [p[0] + e.d[0] * delta, p[1] + e.d[1] * delta] : [p[0], p[1]]));
  return validOutline(out) ? out : null;
}

/** Walls as the room sees them: a counter-clockwise polygon from the lower-left vertex of the first wall; the plan is moved to the origin. */
export function normalise(o: Outline): Outline {
  const b = bbox(o);
  const moved = o.map((p): Pt => [p[0] - b.x0, p[1] - b.y0]);
  const a = area(moved) < 0 ? moved.slice().reverse() : moved;
  // start at the lowest, leftmost vertex: for a counter-clockwise polygon its first wall runs east along the bottom
  let best = 0;
  a.forEach((p, i) => { const q = a[best]!; if (p[1] < q[1] - EPS || (Math.abs(p[1] - q[1]) < EPS && p[0] < q[0])) best = i; });
  return a.map((_p, i) => a[(i + best) % a.length]!);
}
