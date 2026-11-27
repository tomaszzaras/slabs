// Where the wall-length inputs of the room outline editor sit on its drawing. Every input belongs to one wall; it is put in free space
// next to that wall (on the outside of the room, never on the floor and never on another input). When the wall is too short or boxed in
// to have its input right at it, the input goes to the nearest free place and a leader line joins the two. Pure geometry in pixels
// (y grows downward), so it is unit-tested without a browser.
import { bbox, type Outline } from '@slabs/core';

export type V = [number, number];
export interface Box { w: number; h: number }
export interface Wall { mid: V; /** unit vector pointing away from the room */ n: V }

/** Even-odd test: is the point inside the polygon. */
export function inside(p: V, poly: V[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

const orient = (a: V, b: V, c: V) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function segCross(a: V, b: V, c: V, d: V): boolean {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  return ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0));
}

/** Does the axis-aligned rectangle (centre, size, extra margin) touch the polygon: overlap its floor or cross its outline. */
export function rectHitsPolygon(c: V, box: Box, poly: V[], margin = 0): boolean {
  const x0 = c[0] - box.w / 2 - margin, x1 = c[0] + box.w / 2 + margin, y0 = c[1] - box.h / 2 - margin, y1 = c[1] + box.h / 2 + margin;
  const corners: V[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  if (corners.some((q) => inside(q, poly)) || inside(c, poly)) return true;
  if (poly.some((q) => q[0] > x0 && q[0] < x1 && q[1] > y0 && q[1] < y1)) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    for (let k = 0; k < 4; k++) if (segCross(a, b, corners[k]!, corners[(k + 1) % 4]!)) return true;
  }
  return false;
}

/** The unit normal of edge a -> b that points out of the room (tested on the real outline, so a notch's walls point into the notch). */
export function outwardNormal(a: V, b: V, poly: V[]): V {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const n: V = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len];
  const mid: V = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return inside([mid[0] + n[0] * 2, mid[1] + n[1] * 2], poly) ? [-n[0], -n[1]] : n;
}

/** The point of the box (centre c) that is nearest to p: where a leader line from p ends. */
export function nearestOnBox(p: V, c: V, box: Box): V {
  return [Math.min(Math.max(p[0], c[0] - box.w / 2), c[0] + box.w / 2), Math.min(Math.max(p[1], c[1] - box.h / 2), c[1] + box.h / 2)];
}

const gapTo = (p: V, c: V, box: Box) => Math.hypot(Math.max(Math.abs(p[0] - c[0]) - box.w / 2, 0), Math.max(Math.abs(p[1] - c[1]) - box.h / 2, 0));

/**
 * Greedy placement on a grid of candidate positions: a candidate must lie inside the area, off the polygon and off the boxes placed so far.
 * Walls with the least free space nearby choose first. The cost prefers boxes close to their wall, on its outer side.
 */
export function placeBoxes(walls: Wall[], poly: V[], box: Box, area: Box, margin = 6, step = 6): V[] {
  const free: V[] = [];
  for (let y = box.h / 2 + 2; y <= area.h - box.h / 2 - 2; y += step) {
    for (let x = box.w / 2 + 2; x <= area.w - box.w / 2 - 2; x += step) if (!rectHitsPolygon([x, y], box, poly, 4)) free.push([x, y]);
  }
  const cost = (c: V, w: Wall) => gapTo(w.mid, c, box) * 2 + Math.hypot(c[0] - w.mid[0], c[1] - w.mid[1]) * 0.2 + ((c[0] - w.mid[0]) * w.n[0] + (c[1] - w.mid[1]) * w.n[1] < 0 ? 80 : 0);
  const ideal = (w: Wall): V => [
    Math.min(Math.max(w.mid[0] + w.n[0] * (box.w / 2 + 10), box.w / 2), area.w - box.w / 2),
    Math.min(Math.max(w.mid[1] + w.n[1] * (box.h / 2 + 10), box.h / 2), area.h - box.h / 2),
  ];
  const best0 = walls.map((w) => free.reduce((m, c) => Math.min(m, cost(c, w)), Infinity));
  const order = walls.map((_w, i) => i).sort((p, q) => best0[q]! - best0[p]! || p - q); // the most boxed-in walls first
  const placed: V[] = [];
  const out: V[] = new Array(walls.length);
  for (const i of order) {
    const w = walls[i]!;
    let pick: V | null = null, pc = Infinity;
    for (const c of free) {
      if (placed.some((p) => Math.abs(c[0] - p[0]) < box.w + margin && Math.abs(c[1] - p[1]) < box.h + margin)) continue;
      const k = cost(c, w);
      if (k < pc) { pc = k; pick = c; }
    }
    out[i] = pick ?? ideal(w);
    placed.push(out[i]!);
  }
  return out;
}

/**
 * The whole drawing of an outline on a canvas of W x H px: the polygon in pixels (centred, with room around it for the inputs), each wall's
 * midpoint and outward normal, and where each wall's input box (bw x bh) sits.
 */
export function layoutOutline(shown: Outline, W: number, H: number, bw: number, bh: number): { poly: V[]; walls: Wall[]; boxes: V[] } {
  const b = bbox(shown);
  const padX = bw + 16, padY = bh + 12;
  const k = Math.min((W - 2 * padX) / Math.max(b.w, 1), (H - 2 * padY) / Math.max(b.l, 1));
  const ox = (W - b.w * k) / 2, oy = (H - b.l * k) / 2;
  const poly = shown.map((q): V => [ox + (q[0] - b.x0) * k, H - oy - (q[1] - b.y0) * k]);
  const walls = poly.map((a, i): Wall => { const e = poly[(i + 1) % poly.length]!; return { mid: [(a[0] + e[0]) / 2, (a[1] + e[1]) / 2], n: outwardNormal(a, e, poly) }; });
  return { poly, walls, boxes: placeBoxes(walls, poly, { w: bw, h: bh }, { w: W, h: H }) };
}
