// Tongue and groove (pióro-wpust). A plate has a physical size (e.g. 500 x 125 cm) and a tongue (e.g. 1 cm) on its top long
// edge and its right short edge, a groove on the opposite edges. What it covers on the wall is smaller by the tongue
// (499 x 124). All pieces and grids in the room models are in covering sizes; the physical size only matters for cutting.
import type { Piece, Prof, Tg } from './types';

export type ProfileMode = 'all' | 'long' | 'none';
export interface PlateSpec { L: number; W: number; tongue: number; profile: ProfileMode }

/** The owner's product: 500 x 125 cm, 1 cm tongue on all four edges. */
export const DEFAULT_PLATE: PlateSpec = { L: 500, W: 125, tongue: 1, profile: 'all' };
/** The original artifact: plain plates 499 x 125. */
export const ARTIFACT_PLATE: PlateSpec = { L: 499, W: 125, tongue: 0, profile: 'none' };

export interface PlateCover { L: number; W: number; long: boolean; end: boolean; t: number }

/** What the plate covers on the wall, and which edges are profiled. */
export function plateCover(s: PlateSpec): PlateCover {
  const long = s.profile !== 'none', end = s.profile === 'all', t = long ? Math.max(0, s.tongue) : 0;
  return { L: s.L - (end ? t : 0), W: s.W - (long ? t : 0), long, end, t };
}

/** The same plate with the profile switched off (for "how many plates would plain plates need"): physical size stays. */
export const withoutProfile = (s: PlateSpec): PlateSpec => ({ ...s, profile: 'none' });

/** Typed edges of a piece from what its edges touch: a joint between two plates is a tongue or a groove, everything else is cut plain. */
export function deriveTg(e: { l0: string; l1: string; w0: string; w1: string } | undefined, mode: ProfileMode): Tg | undefined {
  if (!e || mode === 'none') return undefined;
  const tg: Tg = {};
  // On every surface the tongue faces the arrow at the start point (the direction the plates run): l1 is the tongue end, l0 the groove end.
  // Across the plates the tongue sits on the side with the lower field number (w0), the groove on w1: this is how a plate is cut (tongue on top, groove below).
  if (e.w0 === 'joint') tg.w0 = 'T';
  if (e.w1 === 'joint') tg.w1 = 'G';
  if (mode === 'all') {
    if (e.l0 === 'joint') tg.l0 = 'G';
    if (e.l1 === 'joint') tg.l1 = 'T';
  }
  return tg.l0 || tg.l1 || tg.w0 || tg.w1 ? tg : undefined;
}

export const swapTg = (g: Tg | undefined): Tg | undefined => (g ? { l0: g.l1, l1: g.l0, w0: g.w1, w1: g.w0 } : undefined);

/** Profile of the frame sides of an item (as drawn, tongue strips not included). */
export interface Sides { top?: Prof; bottom?: Prof; left?: Prof; right?: Prof; ok: boolean }

const lmaxOf = (p: Piece) => (p.prof && p.prof.length ? Math.max(...p.prof.map((q) => q[1])) : p.l);

/** Frame sides of a piece or nest in its own coordinates (top = y 0 = w0 side, left = x 0 = l0 end). A nest needs every profiled edge of its parts on its frame. */
export function frameSides(p: Piece): Sides {
  if (p.kind !== 'nest' || !p.parts) return { top: p.tg?.w0, bottom: p.tg?.w1, left: p.tg?.l0, right: p.tg?.l1, ok: true };
  const out: Sides = { ok: true };
  const eps = 1e-6;
  const put = (side: 'top' | 'bottom' | 'left' | 'right', v: Prof | undefined, touches: boolean) => {
    if (!v) return;
    if (!touches || (out[side] && out[side] !== v)) { out.ok = false; return; }
    out[side] = v;
  };
  p.parts.forEach((t) => {
    const g = t.p.tg;
    if (!g) return;
    const hh = t.p.w, L = lmaxOf(t.p);
    const rot = !!t.rot;
    put('top', rot ? g.w1 : g.w0, Math.abs(t.oy) < eps);
    put('bottom', rot ? g.w0 : g.w1, Math.abs(t.oy + hh - p.w) < eps);
    put('left', rot ? g.l1 : g.l0, Math.abs(t.ox) < eps);
    put('right', rot ? g.l0 : g.l1, Math.abs(t.ox + L - p.l) < eps);
  });
  return out;
}

export interface TgCtx { t: number; long: boolean; end: boolean }

/** One way to put an item on a plate: which copy (0° or turned 180°), its box (covering size + tongues) and where it has to touch the plate edge. */
export interface Orientation {
  rot: boolean;
  /** box size on the plate (covering size plus the tongue strips the piece keeps) */
  bw: number; bh: number;
  /** offset of the covering part inside the box */
  dx: number; dy: number;
  /** the box must touch this plate edge: left (groove end), right (tongue end), top (tongue side), bottom (groove side) */
  aL: boolean; aR: boolean; aT: boolean; aB: boolean;
}

/**
 * Orientations (0° and 180° only, the face is never flipped) in which every profiled edge of the item lies on the plate edge with the
 * same profile. Plate frame: tongue on the top long edge and the right short edge, groove on the bottom and left. 180° swaps the sides.
 */
export function orientations(p: Piece, g: TgCtx | null, fr?: { L: number; W: number }): Orientation[] {
  const plain: Orientation = { rot: false, bw: p.l, bh: p.w, dx: 0, dy: 0, aL: false, aR: false, aT: false, aB: false };
  if (!g) return [plain];
  const s = frameSides(p);
  if (!s.ok) return [];
  const has = s.top || s.bottom || s.left || s.right;
  if (!has) return [plain];
  const out: Orientation[] = [];
  for (const rot of [false, true]) {
    const q = rot ? { top: s.bottom, bottom: s.top, left: s.right, right: s.left } : s;
    if (q.top === 'G' || q.bottom === 'T' || q.left === 'T' || q.right === 'G') continue;
    if ((q.left || q.right) && !g.end) continue;
    if ((q.top || q.bottom) && !g.long) continue;
    const o: Orientation = {
      rot, bw: p.l + (q.right ? g.t : 0), bh: p.w + (q.top ? g.t : 0), dx: 0, dy: q.top ? g.t : 0,
      aL: q.left === 'G', aR: q.right === 'T', aT: q.top === 'T', aB: q.bottom === 'G',
    };
    if (fr) {
      const e = 1e-4;
      if (o.bw > fr.L + e || o.bh > fr.W + e) continue;
      if (o.aL && o.aR && Math.abs(o.bw - fr.L) > e) continue; // groove and tongue end both on the plate: only a piece as long as the plate
      if (o.aT && o.aB && Math.abs(o.bh - fr.W) > e) continue;
    }
    out.push(o);
  }
  return out;
}

const rotPt = (l: number, w: number) => (q: [number, number]): [number, number] => [l - q[0], w - q[1]];

/** The piece turned by 180° in its own box (so that it can be placed unrotated): edges, bend lines, holes and outline are turned with it. */
export function rotate180(p: Piece): Piece {
  const r = rotPt(p.l, p.w);
  if (p.kind === 'nest' && p.parts) {
    const L = p.l, W = p.w;
    return {
      ...p, tg: swapTg(p.tg),
      parts: p.parts.map((t) => {
        const Lp = lmaxOf(t.p), hh = t.p.w;
        return { p: t.p, rot: (t.rot ? 0 : 1) as 0 | 1, ox: L - (t.ox + Lp), oy: W - (t.oy + hh) };
      }),
    };
  }
  if (p.kind === 'trap' && p.prof) {
    const L = lmaxOf(p);
    return { kind: 'nest', l: L, w: p.w, ids: p.ids, room: p.room, parts: [{ p, rot: 1, ox: 0, oy: 0 }], tg: swapTg(p.tg) };
  }
  const q: Piece = { ...p, tg: swapTg(p.tg) };
  if (p.edges) q.edges = { l0: p.edges.l1, l1: p.edges.l0, w0: p.edges.w1, w1: p.edges.w0 };
  if (p.cuts) q.cuts = p.cuts.map((c) => p.l - c);
  if (p.cut) q.cut = p.l - p.cut;
  if (p.splits) q.splits = p.splits.map((s) => ({ ...s, edge: s.edge === 'l0' ? 'l1' : 'l0' }));
  if (p.kind === 'poly' && p.outline) q.outline = p.outline.map(r).reverse();
  if (p.holes) q.holes = p.holes.map((h) => h.map(r).reverse());
  return q;
}
