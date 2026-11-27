// Generic boards on a flat surface: any outline (a polygon in the surface's own coordinates a, b), boards running along `a` or along `b`,
// one joint grid with a start point, pieces cut to the outline. Used for the surfaces that the preset models do not draw: horizontal boards on
// walls, boards along the ridge on the roof, boards of a flat ceiling that is not joined to the walls, and every wall with a finish zone.
// Default-direction surfaces of the preset rooms keep their own (artifact-parity) code; this module never changes their pieces.
import polygonClipping from 'polygon-clipping';
import { polyArea } from './geometry';
import { splitPositions } from './nest';
import { deriveTg, type ProfileMode } from './plate';
import type { EdgeKind, Piece, Pt } from './types';

export type Ring = Pt[];

/** What a surface is covered with: wood boards, another finish (tiles ...), or split by a height line (wood above / below it). */
export type Finish =
  | { kind: 'wood' }
  | { kind: 'other'; label?: string }
  | { kind: 'split'; at: number; wood: 'above' | 'below'; label?: string };
export const WOOD: Finish = { kind: 'wood' };

export type Dir = 'vertical' | 'horizontal' | 'slope' | 'ridge';

const EPS = 1e-6;
type R = Array<[number, number]>;
const open = (r: R): Ring => { const q = r.slice(); const a = q[0]!, b = q[q.length - 1]!; if (a[0] === b[0] && a[1] === b[1]) q.pop(); return q as Ring; };
const rect = (a0: number, b0: number, a1: number, b1: number): Ring => [[a0, b0], [a1, b0], [a1, b1], [a0, b1]];
const bbox = (r: Ring) => ({ a0: Math.min(...r.map((q) => q[0])), a1: Math.max(...r.map((q) => q[0])), b0: Math.min(...r.map((q) => q[1])), b1: Math.max(...r.map((q) => q[1])) });

/** Intersection of polygons with a rectangle (outer rings only: the regions here have no holes). */
export function clipToRect(region: Ring[], a0: number, b0: number, a1: number, b1: number): Ring[] {
  if (!region.length) return [];
  const res = polygonClipping.intersection(region.map((r) => [r as R]), [rect(a0, b0, a1, b1) as R]);
  return res.flatMap((poly) => { const o = open(poly[0]!); return polyArea(o) > 0.5 ? [o] : []; });
}

export const ringArea = (rs: Ring[]): number => rs.reduce((a, r) => a + polyArea(r), 0);

export interface BoardRow { id: number; lo: number; hi: number }
/** The placed boards of one surface, in the surface's coordinates (for drawing) next to the pieces to cut. */
export interface BoardPlan {
  rows: BoardRow[];
  pieces: Piece[];
  /** one polygon per cut piece (a piece that was split to plate length is several), with its row */
  shapes: Array<{ id: number; ring: Ring; seg?: string }>;
  /** the joint nearest to the start: where the start mark is drawn */
  startAt: number;
}

export interface BoardOptions {
  region: Ring[];
  /** the plate runs along this axis of the surface: 'b' = up the wall / along the ridge, 'a' = along the wall / across the room */
  along: 'a' | 'b';
  /** joint pitch (covering width less trim) */
  pitch: number;
  /** across-axis position of one joint of the grid (the start point) */
  anchor: number;
  /** usable plate length */
  PL: number;
  mode: ProfileMode;
  /** surface key, written to the piece's `src` */
  surf: number;
  /** first field number */
  firstId: number;
  /** across-axis positions where the surface folds (a board edge there is a bend, not a joint) */
  folds?: number[];
}

const same = (x: number, y: number) => Math.abs(x - y) < 0.5;

/** Joint positions of the grid inside [c0, c1] (first and last are the surface's edges). */
export function gridRows(c0: number, c1: number, pitch: number, anchor: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let k = Math.floor((c0 - anchor) / pitch + 1e-9); anchor + k * pitch < c1 - 1e-9; k++) {
    const lo = Math.max(c0, anchor + k * pitch), hi = Math.min(c1, anchor + (k + 1) * pitch);
    if (hi - lo > 1) out.push([lo, hi]);
  }
  return out;
}

export function boardsOf(o: BoardOptions): BoardPlan {
  const alongB = o.along === 'b';
  // work in (across, along) = (c, t) so the code has one orientation
  const toCT = (r: Ring): Ring => r.map((q) => (alongB ? [q[0], q[1]] : [q[1], q[0]]) as Pt);
  const region = o.region.map(toCT);
  const plan: BoardPlan = { rows: [], pieces: [], shapes: [], startAt: o.anchor };
  if (!region.length) return plan;
  const all = region.map(bbox);
  const c0 = Math.min(...all.map((b) => b.a0)), c1 = Math.max(...all.map((b) => b.a1)), t0 = Math.min(...all.map((b) => b.b0)), t1 = Math.max(...all.map((b) => b.b1));
  const rows = gridRows(c0, c1, o.pitch, o.anchor);
  const cand = [c0, c1, ...rows.flatMap((r) => r)];
  plan.startAt = cand.reduce((b, c) => (Math.abs(c - o.anchor) < Math.abs(b - o.anchor) ? c : b), cand[0]!);
  let id = o.firstId - 1;
  const endTg = o.mode === 'all';
  rows.forEach(([lo, hi]) => {
    const parts = clipToRect(region, lo, t0 - 1, hi, t1 + 1).sort((p, q) => bbox(p).b0 - bbox(q).b0);
    if (!parts.length) return;
    id++;
    plan.rows.push({ id, lo, hi });
    parts.forEach((part) => {
      const bb = bbox(part);
      const len = bb.b1 - bb.b0;
      const cuts = splitPositions(len, o.PL).map((d) => bb.b0 + d);
      const bounds = [bb.b0, ...cuts, bb.b1];
      const letters = parts.length > 1 || cuts.length > 0;
      for (let i = 0; i < bounds.length - 1; i++) {
        const q0 = bounds[i]!, q1 = bounds[i + 1]!;
        const chunk = cuts.length ? clipToRect([part], bb.a0 - 1, q0, bb.a1 + 1, q1)[0] : part;
        if (!chunk) continue;
        const cb = bbox(chunk);
        const first = i === 0, last = i === bounds.length - 2;
        const w0: EdgeKind = same(cb.a0, c0) ? 'wall' : (o.folds ?? []).some((x) => same(x, cb.a0)) ? 'bend' : 'joint';
        const w1: EdgeKind = same(cb.a1, c1) ? 'wall' : (o.folds ?? []).some((x) => same(x, cb.a1)) ? 'bend' : 'joint';
        const edges = { l0: (first ? 'wall' : 'joint') as EdgeKind, l1: (last ? 'wall' : 'joint') as EdgeKind, w0, w1 };
        const l = cb.b1 - cb.b0, w = cb.a1 - cb.a0;
        const isRect = chunk.length === 4 && Math.abs(polyArea(chunk) - l * w) < 1e-6;
        const local = chunk.map((q): Pt => [q[1] - cb.b0, q[0] - cb.a0]);
        const seg = letters ? '\0' : undefined; // letters are given per row below
        const piece: Piece = {
          kind: isRect ? 'rect' : 'poly', l, w, ids: [id], edges,
          // the surface's (a, b) → piece coordinates: along 'b' = the gable mapping (b along the plate), along 'a' = the board mapping
          src: alongB ? { kind: 'gable', surf: o.surf, u0: cb.b0, z0: cb.a0 } : { kind: 'board', surf: o.surf, u0: cb.b0, z0: cb.a0 },
          ...(isRect ? {} : { outline: local }),
          ...(seg ? { seg } : {}),
        };
        const g = deriveTg(edges, o.mode);
        if (g) piece.tg = { ...g };
        if (endTg && !last) piece.tg = { ...(piece.tg ?? {}), l1: 'T' };
        if (endTg && !first) piece.tg = { ...(piece.tg ?? {}), l0: 'G' };
        if (!first || !last) piece.splits = [...(!first ? [{ edge: 'l0' as const, at: q0 - bb.b0 }] : []), ...(!last ? [{ edge: 'l1' as const, at: q1 - bb.b0 }] : [])];
        plan.pieces.push(piece);
        plan.shapes.push({ id, ring: (alongB ? chunk : chunk.map((q): Pt => [q[1], q[0]])) as Ring, ...(seg ? { seg } : {}) });
      }
    });
  });
  // several pieces in one field: a, b, c ... in the order they were made
  const seen = new Map<number, number>();
  plan.pieces.forEach((p, i) => {
    if (p.seg !== '\0') return;
    const n = seen.get(p.ids[0]!) ?? 0;
    seen.set(p.ids[0]!, n + 1);
    const letter = String.fromCharCode(97 + (n % 26));
    p.seg = letter;
    plan.shapes[i]!.seg = letter;
  });
  return plan;
}

// ------------------------------------------------------------------ wall faces

/** Wood zone of a wall as a height range [lo, hi] (hi = Infinity: up to the profile). */
export interface WoodZone { lo: number; hi: number }

export function woodZone(f: Finish): WoodZone | null {
  if (f.kind === 'wood') return { lo: 0, hi: Infinity };
  if (f.kind === 'other') return null;
  return f.wood === 'above' ? { lo: f.at, hi: Infinity } : { lo: 0, hi: f.at };
}

export interface FaceZone { ring: Ring; area: number }
export interface Face {
  key: number;
  /** extent along the wall and the profile of its top edge, (a, height) */
  a0: number; a1: number;
  top: Pt[];
  hmax: number;
  dir: 'vertical' | 'horizontal';
  finish: Finish;
  /** where the boards are */
  wood: Ring[];
  /** the rest (hatched in the drawing): other finish, with its area in cm² */
  other: FaceZone[];
  woodArea: number;
  otherArea: number;
  /** joint of the grid (a for vertical boards, height for horizontal) and its default */
  anchor: number;
  plan: BoardPlan;
}

export interface FaceInput {
  key: number;
  a0: number; a1: number;
  /** top edge (a, height), from a0 to a1 */
  top: Pt[];
  dir: 'vertical' | 'horizontal';
  finish: Finish;
  /** start: the joint of the grid; for vertical boards a position along the wall, for horizontal boards a height above the floor */
  anchor: number;
  pitch: number; PL: number; mode: ProfileMode;
  firstId: number;
  /** a hole in the wall that is not wood (the end-wall cut-out) is handled by the caller as an opening */
}

/** The polygon of a wall: the floor line and the top profile. */
export const wallRing = (a0: number, a1: number, top: Pt[]): Ring => [[a0, 0], [a1, 0], ...top.slice().reverse().map((q): Pt => [q[0], q[1]])];

export function buildFace(i: FaceInput): Face {
  const hmax = Math.max(...i.top.map((q) => q[1]));
  const ring = wallRing(i.a0, i.a1, i.top);
  const zone = woodZone(i.finish);
  const BIG = hmax + 10;
  const wood = zone ? clipToRect([ring], i.a0 - 1, zone.lo, i.a1 + 1, Math.min(zone.hi, BIG)) : [];
  const otherRings = (() => {
    if (!zone) return [ring];
    const out: Ring[] = [];
    if (zone.lo > EPS) out.push(...clipToRect([ring], i.a0 - 1, 0, i.a1 + 1, zone.lo));
    if (zone.hi < BIG) out.push(...clipToRect([ring], i.a0 - 1, zone.hi, i.a1 + 1, BIG));
    return out;
  })();
  const other = otherRings.map((r) => ({ ring: r, area: polyArea(r) }));
  const plan = boardsOf({ region: wood, along: i.dir === 'vertical' ? 'b' : 'a', pitch: i.pitch, anchor: i.anchor, PL: i.PL, mode: i.mode, surf: i.key, firstId: i.firstId });
  return { key: i.key, a0: i.a0, a1: i.a1, top: i.top, hmax, dir: i.dir, finish: i.finish, wood, other, woodArea: ringArea(wood), otherArea: ringArea(otherRings), anchor: i.anchor, plan };
}

/** A surface of a room model that is drawn with the generic boards (see cladding.ts). */
export interface RoomFace extends Face {
  ref: string;
  label: string;
  detail: string;
  kind: 'wall' | 'roof' | 'ceiling';
  /** the whole surface (a, b), for the drawing */
  outline: Ring;
  /** b runs up (walls: height) or down (roof / ceiling: along z) in the drawing */
  up: boolean;
  /** across positions of the grid segments' edges (roof: folds), drawn dashed */
  folds: number[];
  /** the shift parameter of the start point (o1..o9) */
  param: string;
}
