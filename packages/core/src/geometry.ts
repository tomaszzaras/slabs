// Pieces as polygons. rect and trap are special cases; pair/nest are sets of polygons.
import type { Piece, Pt } from './types';

export function polyArea(pts: Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

/** Outline of a single (non-composite) piece in its own coordinates: x along the plate (l), y across it (w). */
export function pieceOutline(p: Piece): Pt[] {
  if (p.kind === 'poly' && p.outline) return p.outline;
  if (p.kind === 'trap' && p.prof) return [[0, 0], ...p.prof.map((q): Pt => [q[1], p.w * q[0]]), [0, p.w]];
  return [[0, 0], [p.l, 0], [p.l, p.w], [0, p.w]];
}

/** All polygons of a piece, in the piece's own coordinates (pairs and nests have several). */
export function piecePolygons(p: Piece): Pt[][] {
  if (p.kind === 'pair') {
    const g = p.gap ?? 0, w = p.w;
    return [
      [[0, 0], [p.ya!, 0], [p.yb!, w], [0, w]],
      [[p.ya! + g, 0], [p.l, 0], [p.l, w], [p.yb! + g, w]],
    ];
  }
  if (p.kind === 'nest') {
    const out: Pt[][] = [];
    p.parts!.forEach((t) => {
      const q = t.p, hh = q.w, L = Math.max(...q.prof!.map((u) => u[1]));
      if (!t.rot) out.push([[t.ox, t.oy], ...q.prof!.map((u): Pt => [t.ox + u[1], t.oy + hh * u[0]]), [t.ox, t.oy + hh]]);
      else {
        const R = t.ox + L;
        out.push([[R, t.oy + hh], ...q.prof!.map((u): Pt => [R - u[1], t.oy + hh - hh * u[0]]), [R, t.oy]]);
      }
    });
    return out;
  }
  return [pieceOutline(p)];
}

/** Polygons of a piece placed at (x, y) on a plate. */
export function placedPolygons(p: Piece, x: number, y: number): Pt[][] {
  return piecePolygons(p).map((poly) => poly.map((q): Pt => [q[0] + x, q[1] + y]));
}

function segDist(a: Pt, b: Pt, c: Pt, d: Pt): number {
  const ptSeg = (p: Pt, s: Pt, e: Pt) => {
    const dx = e[0] - s[0], dy = e[1] - s[1], l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - s[0]) * dx + (p[1] - s[1]) * dy) / l2));
    return Math.hypot(p[0] - (s[0] + t * dx), p[1] - (s[1] + t * dy));
  };
  const cross = (o: Pt, p: Pt, q: Pt) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(ptSeg(a, c, d), ptSeg(b, c, d), ptSeg(c, a, b), ptSeg(d, a, b));
}

/** Smallest distance between the boundaries of two polygons (0 when they cross). Polygons are assumed not nested in each other. */
export function polyDistance(A: Pt[], B: Pt[]): number {
  let m = Infinity;
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < B.length; j++) m = Math.min(m, segDist(A[i]!, A[(i + 1) % A.length]!, B[j]!, B[(j + 1) % B.length]!));
  }
  return m;
}
