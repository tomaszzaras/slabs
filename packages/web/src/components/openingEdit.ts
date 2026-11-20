import { asRect, type Opening } from '@slabs/core';
import type { SurfaceMap } from '@slabs/render';

type Pt = [number, number];
const bbox = (pts: Pt[]) => ({ a0: Math.min(...pts.map((q) => q[0])), b0: Math.min(...pts.map((q) => q[1])), a1: Math.max(...pts.map((q) => q[0])), b1: Math.max(...pts.map((q) => q[1])) });
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Edge positions an opening edge is attracted to: the surface edges, joint lines, edges of the other openings. */
function targets(map: SurfaceMap, others: Opening[]) {
  const a = [map.bounds.a0, map.bounds.a1, ...map.guides.a], b = [map.bounds.b0, map.bounds.b1, ...map.guides.b];
  others.forEach((o) => { const q = bbox(o.pts as Pt[]); a.push(q.a0, q.a1); b.push(q.b0, q.b1); });
  return { a, b };
}

/** Moves a set of points by (da, db), snapping an edge to a target within 6 px (Shift = no snapping, whole cm otherwise), staying on the surface. */
export function moveSnapped(pts0: Pt[], da: number, db: number, map: SurfaceMap, others: Opening[], free: boolean): Pt[] {
  const q = bbox(pts0);
  let ra = da, rb = db;
  if (!free) {
    const t = targets(map, others), tol = 6 / map.perCm;
    const near = (edges: number[], cand: number[]) => { let best: number | null = null; for (const e of edges) for (const c of cand) { const d = c - e; if (Math.abs(d) <= tol && (best === null || Math.abs(d) < Math.abs(best))) best = d; } return best; };
    const na = near([q.a0 + da, q.a1 + da], t.a), nb = near([q.b0 + db, q.b1 + db], t.b);
    ra = na !== null ? da + na : Math.round(q.a0 + da) - q.a0;
    rb = nb !== null ? db + nb : Math.round(q.b0 + db) - q.b0;
  }
  const { a0, a1, b0, b1 } = map.bounds;
  ra = Math.max(a0 - q.a0, Math.min(a1 - q.a1, ra));
  rb = Math.max(b0 - q.b0, Math.min(b1 - q.b1, rb));
  return pts0.map((p): Pt => [r1(p[0] + ra), r1(p[1] + rb)]);
}

/** Drags corner `i` of a rectangle (the opposite corner stays) or vertex `i` of a polygon to (a, b). */
export function dragVertex(pts0: Pt[], i: number, a: number, b: number, map: SurfaceMap, free: boolean, min = 5): Pt[] {
  const { a0, a1, b0, b1 } = map.bounds;
  let x = Math.max(a0, Math.min(a1, free ? a : Math.round(a))), y = Math.max(b0, Math.min(b1, free ? b : Math.round(b)));
  if (!free) {
    const tol = 6 / map.perCm;
    for (const g of [map.bounds.a0, map.bounds.a1, ...map.guides.a]) if (Math.abs(g - a) <= tol) x = g;
    for (const g of [map.bounds.b0, map.bounds.b1, ...map.guides.b]) if (Math.abs(g - b) <= tol) y = g;
  }
  const rect = asRect(pts0);
  if (rect) {
    const opp = pts0[(i + 2) % 4]!;
    const ox = opp[0], oy = opp[1];
    if (Math.abs(x - ox) < min) x = ox + (x >= ox ? min : -min);
    if (Math.abs(y - oy) < min) y = oy + (y >= oy ? min : -min);
    x = Math.max(a0, Math.min(a1, x)); y = Math.max(b0, Math.min(b1, y));
    const l = Math.min(x, ox), r = Math.max(x, ox), lo = Math.min(y, oy), hi = Math.max(y, oy);
    return [[l, lo], [r, lo], [r, hi], [l, hi]].map((p): Pt => [r1(p[0]!), r1(p[1]!)]);
  }
  return pts0.map((p, k): Pt => (k === i ? [r1(x), r1(y)] : p));
}

/** A new vertex in the middle of the longest edge. */
export function addVertex(pts: Pt[]): Pt[] {
  let best = 0, len = -1;
  pts.forEach((p, i) => { const n = pts[(i + 1) % pts.length]!; const l = Math.hypot(n[0] - p[0], n[1] - p[1]); if (l > len) { len = l; best = i; } });
  const p = pts[best]!, n = pts[(best + 1) % pts.length]!;
  const out = pts.slice();
  out.splice(best + 1, 0, [r1((p[0] + n[0]) / 2), r1((p[1] + n[1]) / 2)]);
  return out;
}

/** Where a new opening goes: the middle of the surface, 40 % of its size at most, never off the surface. */
export function newOpeningPts(kind: 'window' | 'door' | 'cutout' | 'polygon', map: SurfaceMap): Pt[] {
  const { a0, a1, b0, b1 } = map.bounds;
  const W = a1 - a0, H = b1 - b0;
  const size = kind === 'door' ? [Math.min(90, W * 0.4), Math.min(200, H * 0.8)] : kind === 'window' ? [Math.min(120, W * 0.4), Math.min(100, H * 0.4)] : [Math.min(60, W * 0.3), Math.min(40, H * 0.3)];
  const w = Math.max(10, Math.round(size[0]!)), h = Math.max(10, Math.round(size[1]!));
  const ca = Math.round(a0 + W / 2 - w / 2), cb = kind === 'door' ? Math.round(b0 + (map.guides.b.length && map.bounds.b1 > 0 && b0 === 0 ? 0 : 0)) : Math.round(b0 + H / 2 - h / 2);
  const a = Math.max(a0, Math.min(a1 - w, ca)), b = Math.max(b0, Math.min(b1 - h, kind === 'door' ? b0 : cb));
  if (kind === 'polygon') return [[a, b], [a + w, b], [a + w, b + h * 0.6], [a + w * 0.5, b + h], [a, b + h * 0.6]];
  return [[a, b], [a + w, b], [a + w, b + h], [a, b + h]];
}
