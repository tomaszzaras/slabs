// Shared cut: pairing / nesting of trapezoids, MaxRects search (seeded), band filling, kerf, edge trim,
// fitting allowances and an optional guillotine-only mode. Port of the "Wspólny rozkrój" tab.
import { piecePolygons, polyDistance } from './geometry';
import { orientations, plateCover, rotate180, type Orientation, type PlateSpec, type TgCtx } from './plate';
import { pieceArea } from './shelf';
import type { EdgeKind, NestPart, Piece, PieceSplit, Pt } from './types';
import { mulberry32 } from './util';

export interface Rect { x: number; y: number; w: number; h: number }
export interface PlacedItem { p: Piece; x: number; y: number }
export interface GuillotineCut {
  n: number;
  /** 'h' = along the plate length (a horizontal line), 'v' = across it, 'd' = slanted cut that separates nested pieces */
  orient: 'h' | 'v' | 'd';
  /** position of the line (y for 'h', x for 'v') in plate coordinates, cm */
  pos: number;
  /** extent of the cut along its direction */
  from: number;
  to: number;
}
export interface Plate {
  free: Rect[];
  items: PlacedItem[];
  extra?: boolean;
  area: number;
  use: number;
  /** guillotine mode only: cuts in the order they have to be made */
  cuts?: GuillotineCut[];
  /** parts of the plate that are left over and big enough to keep */
  offcuts?: Rect[];
}

export interface BandSpec { len: number; h: number; min: number; max: number; use: boolean | number }

export interface CutSettings {
  /** saw cut thickness, cm */
  kerf: number;
  /** strip cut off every plate edge, cm */
  trim: number;
  /** leftovers smaller than this (in either direction) count as waste, cm */
  minOffcut: number;
  guillotine: boolean;
  /** strips narrower than this are reported as slivers, cm (0 = off) */
  minStrip?: number;
}
export const NO_SETTINGS: CutSettings = { kerf: 0, trim: 0, minOffcut: 0, guillotine: false };

/** Fitting allowance per edge type, cm. Positive makes the piece bigger. */
export interface Allowances {
  enabled: boolean;
  wall: number;
  joint: number;
  bend: number;
  opening: number;
  gap: number;
  /** add width*tan(1°) to slanted ends */
  angleTolerance: boolean;
}
export const NO_ALLOWANCES: Allowances = { enabled: false, wall: 0, joint: 0, bend: 0, opening: 0, gap: 0, angleTolerance: false };
export const DEFAULT_ALLOWANCES: Allowances = { enabled: true, wall: 1, joint: 0, bend: 0.5, opening: -0.3, gap: -0.5, angleTolerance: false };

export interface RoomInput { key: string; name: string; on: boolean; PL: number; PW: number; pieces: Piece[] }

export interface CutRequest {
  rooms: RoomInput[];
  band: BandSpec;
  splitAtBends: boolean;
  seed: number;
  maxIters: number;
  timeMs: number;
  settings: CutSettings;
  allowances: Allowances;
  price: number;
  /** physical plate and its profile; without it plain plates of the rooms' PL x PW are cut (the artifact) */
  plate?: PlateSpec;
}

export interface CutStats {
  plates: number;
  grossM2: number;
  netM2: number;
  utilisation: number;
  cost: number;
  /** area lost in saw cuts (estimate), m² */
  kerfM2: number;
  /** area added by fitting allowances, m² */
  allowanceM2: number;
  /** area of leftovers big enough to keep, m² */
  offcutKeptM2: number;
  /** remaining waste (edge trim, small leftovers), m² */
  wasteM2: number;
  separate: number;
}

export interface CutResult {
  plates: Plate[];
  PL: number;
  PW: number;
  per: Array<{ key: string; name: string; n: number; area: number; alone: number }>;
  warn: string[];
  roomPlates: number;
  extraPlates: number;
  segs: number[];
  fromOff: number;
  bandLen: number;
  bandH: number;
  bandAlone: number;
  tried: number;
  netto: number;
  stats: CutStats;
  /**
   * Pieces that cannot be cut from the usable plate even after splitting. When this list is not empty no plates are
   * drawn and no statistics are shown: the plan would be physically impossible.
   */
  blocking: BlockingIssue[];
  /** language-neutral versions of `warn` (the UI words them itself) */
  notes: CutNote[];
  /** pieces that had to be split because they were longer than the usable plate */
  splitCount: number;
  /** pieces whose fitting allowance had to be reduced because the cut size would not fit on the plate */
  clamped: Array<{ room: string; roomName: string; ids: number[]; seg?: string }>;
  /** strips narrower than `settings.minStrip` that end up as pieces */
  slivers: Sliver[];
  /** plates are tongue-and-groove: PL x PW are the physical size, pieces carry `tg` */
  tongue?: { t: number; long: boolean; end: boolean };
  /** pieces whose tongue/groove could not be kept on any plate edge (their edge is cut plain) */
  tgDropped?: number;
}

export type CutNote =
  | { code: 'plateDiffers'; room: string; roomName: string; PL: number; PW: number }
  | { code: 'bandTooTall' };

/** A piece that cannot be cut; `fields` are the inputs the user can change to fix it (keys resolved by the UI). */
export interface BlockingIssue {
  room: string;
  roomName: string;
  ids: number[];
  seg?: string;
  /** which side is too big */
  dir: 'length' | 'width';
  size: number;
  limit: number;
  fields: string[];
}

export interface Sliver { room: string; roomName: string; ids: number[]; width: number }

/** Default minimum strip width, cm. */
export const MIN_STRIP_DEFAULT = 10;

export const DEFAULT_REQUEST = {
  band: { len: 1648, h: 65, min: 124, max: 124, use: 1 } as BandSpec,
  splitAtBends: true,
  seed: 20260,
  maxIters: 2000,
  timeMs: 1500,
  settings: NO_SETTINGS,
  allowances: NO_ALLOWANCES,
  price: 147.6,
};

// ---------------------------------------------------------------- piece helpers

/** Converts the old trapezoid form (ha/hb/peak) to a height profile. */
export function normPiece(p: Piece & { peak?: { t: number; h: number } | null }): Piece {
  if (p && p.kind === 'trap' && !p.prof && isFinite(p.ha!) && isFinite(p.hb!)) {
    p.prof = p.peak ? [[0, p.ha!], [p.peak.t, p.peak.h], [1, p.hb!]] : [[0, p.ha!], [1, p.hb!]];
  }
  return p;
}

function hAt(p: Piece, t: number): number {
  const a = p.prof!;
  if (t <= a[0]![0]) return a[0]![1];
  for (let i = 0; i < a.length - 1; i++) {
    if (t <= a[i + 1]![0] + 1e-12) {
      const d = a[i + 1]![0] - a[i]![0];
      return d < 1e-12 ? a[i + 1]![1] : a[i]![1] + ((a[i + 1]![1] - a[i]![1]) * (t - a[i]![0])) / d;
    }
  }
  return a[a.length - 1]![1];
}
const lmax = (p: Piece) => Math.max(...p.prof!.map((q) => q[1]));

/**
 * Smallest shift d >= 0 (along the plate length) of a polygon so that it keeps at least `kerf` from all `others`.
 * Used for the slanted saw cut between nested trapezoids and pairs (slopes may differ slightly: the artifact accepts 0.5 cm).
 */
function clearShift(others: Pt[][], make: (d: number) => Pt[], kerf: number, scale: number): number {
  if (kerf <= 0) return 0;
  const ok = (d: number) => { const q = make(d); return others.every((o) => polyDistance(o, q) >= kerf - 1e-9); };
  if (ok(0)) return 0;
  let hi = Math.max(kerf, scale), n = 0;
  while (!ok(hi) && n++ < 24) hi *= 2;
  let lo = 0;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
  return hi;
}
const shiftPoly = (poly: Pt[], d: number): Pt[] => poly.map((q): Pt => [q[0] + d, q[1]]);

/** The two polygons of trapezoid A (as is) and trapezoid B (turned 180°) placed head to tail with total length L. */
function pairPolys(A: Piece, B: Piece, L: number, d: number): [Pt[], Pt[]] {
  const nest: Piece = { kind: 'nest', l: L, w: Math.max(A.w, B.w), ids: [], parts: [{ p: A, rot: 0, ox: 0, oy: 0 }, { p: B, rot: 1, ox: L - lmax(B) + d, oy: 0 }] };
  const [pa, pb] = piecePolygons(nest);
  return [pa!, pb!];
}

function pairLen(A: Piece, B: Piece, kerf: number): number | null {
  if (Math.abs(A.w - B.w) > 0.6) return null;
  const ts: number[] = [];
  A.prof!.forEach((q) => ts.push(q[0]));
  B.prof!.forEach((q) => ts.push(1 - q[0]));
  let mn = 1e9, mx = -1e9;
  ts.forEach((t) => {
    const s = hAt(A, t) + hAt(B, 1 - t);
    mn = Math.min(mn, s);
    mx = Math.max(mx, s);
  });
  if (mx - mn > 0.5) return null;
  if (kerf <= 0) return mx;
  const [pa] = pairPolys(A, B, mx, 0);
  return mx + clearShift([pa], (d) => pairPolys(A, B, mx, d)[1], kerf, 2 * kerf * 3);
}

/** Splits rectangular pieces at their bend lines (roof/wall, ceiling/wall). */
export function splitPieces(pcs: Piece[]): Piece[] {
  const out: Piece[] = [];
  pcs.forEach((p) => {
    const cu = p.kind === 'rect' && !p.noSplit ? (p.cuts || (p.cut ? [p.cut] : [])).filter((c) => c > 1 && c < p.l - 1) : [];
    if (!cu.length) { out.push(p); return; }
    const b = [0, ...cu, p.l];
    for (let i = 0; i < b.length - 1; i++) {
      const q: Piece = { ...p };
      q.l = b[i + 1]! - b[i]!;
      q.cut = null;
      q.cuts = [];
      q.seg = String.fromCharCode(97 + i);
      if (p.edges) {
        q.edges = { ...p.edges, l0: i === 0 ? p.edges.l0 : 'bend', l1: i === b.length - 2 ? p.edges.l1 : 'bend' };
      }
      if (p.tg) q.tg = { ...p.tg, l0: i === 0 ? p.tg.l0 : undefined, l1: i === b.length - 2 ? p.tg.l1 : undefined };
      out.push(q);
    }
  });
  return out;
}

/** Pairs trapezoids of equal width head to tail and slides similar slopes into each other. */
/** Tongue-and-groove frame the nests must fit: a nest is only made when it can lie on a plate edge with the right profiles. */
export interface NestFrame { tg: TgCtx; PLe: number; PWe: number }
const fitsFrame = (p: Piece, fr: NestFrame | undefined) => !fr || orientations(p, fr.tg, { L: fr.PLe, W: fr.PWe }).length > 0;

export function pairPieces(pcs: Piece[], PL: number, kerf = 0, fr?: NestFrame): Piece[] {
  const tr: Piece[] = [], out: Piece[] = [];
  const c: Array<{ i: number; j: number; L: number; sv: number }> = [];
  pcs.forEach((p) => { if (p.kind === 'trap' && p.prof) tr.push(p); else out.push(p); });
  for (let i = 0; i < tr.length; i++) {
    for (let j = i + 1; j < tr.length; j++) {
      const L = pairLen(tr[i]!, tr[j]!, kerf);
      if (L !== null && L <= PL + 1e-6) {
        const sv = tr[i]!.l + tr[j]!.l - L;
        if (sv > 1) c.push({ i, j, L, sv });
      }
    }
  }
  c.sort((a, b) => b.sv - a.sv);
  const used: Record<number, number> = {};
  c.forEach((q) => {
    if (used[q.i] || used[q.j]) return;
    const A = tr[q.i]!, B = tr[q.j]!;
    const nest: Piece = { kind: 'nest', parts: [{ p: A, rot: 0, ox: 0, oy: 0 }, { p: B, rot: 1, ox: q.L - lmax(B), oy: 0 }], l: q.L, w: Math.max(A.w, B.w), ids: A.ids.concat(B.ids), room: A.room };
    if (!fitsFrame(nest, fr)) return; // head to tail turns one strip by 180°: its tongue would end up on the wrong plate edge
    used[q.i] = used[q.j] = 1;
    out.push(nest);
  });
  const rest = tr.filter((_p, i) => !used[i]);
  return out.concat(nestGuests(rest, kerf, fr));
}

function nestGuests(tr: Piece[], kerf: number, fr?: NestFrame): Piece[] {
  const out: Piece[] = [];
  const u = tr.map(() => 0);
  const order = tr.map((_p, i) => i).sort((a, b) => tr[b]!.w - tr[a]!.w || tr[b]!.l - tr[a]!.l);
  const sl = (p: Piece): number | null => (p.prof!.length === 2 ? (p.prof![1]![1] - p.prof![0]![1]) / p.w : null);
  order.forEach((i) => {
    if (u[i]) return;
    u[i] = 1;
    const H = tr[i]!, s = sl(H);
    if (s === null || Math.abs(s) < 0.05) { out.push(H); return; }
    const a = H.prof![0]![1], lH = lmax(H);
    const parts: NestPart[] = [{ p: H, rot: 0, ox: 0, oy: 0 }];
    let cur = s < 0 ? H.w : 0, rows = H.w, ext = lH, ids = H.ids.slice();
    // right end of a guest at row offset oy: its slanted edge parallel to the host's, plus the saw cut to everything placed so far
    const guestEnd = (G: Piece, oy: number): number => {
      const E0 = a + s * oy + G.prof![1]![1];
      if (kerf <= 0) return E0;
      const placed = piecePolygons({ kind: 'nest', l: ext, w: H.w, ids: [], parts });
      const mk = (d: number) => piecePolygons({ kind: 'nest', l: 0, w: 0, ids: [], parts: [{ p: G, rot: 1, ox: E0 + d - lmax(G), oy }] })[0]!;
      return E0 + clearShift(placed, mk, kerf, 2 * kerf * 3);
    };
    let again = true;
    while (again) {
      again = false;
      let bj = -1;
      order.forEach((j) => {
        if (u[j]) return;
        const G = tr[j]!, sg = sl(G);
        if (sg === null || Math.abs(sg - s) > 0.03 || G.w > rows + 0.01) return;
        const oy = s < 0 ? cur - G.w : cur, E = guestEnd(G, oy);
        if (E > lH + 0.5) return;
        if (fr && !fitsFrame({ kind: 'nest', parts: [...parts, { p: G, rot: 1, ox: E - lmax(G), oy }], l: Math.max(ext, E), w: H.w, ids: [] }, fr)) return;
        if (bj < 0 || G.w > tr[bj]!.w) bj = j;
      });
      if (bj >= 0) {
        const G = tr[bj]!, oy = s < 0 ? cur - G.w : cur, E = guestEnd(G, oy);
        u[bj] = 1;
        parts.push({ p: G, rot: 1, ox: E - lmax(G), oy });
        ids = ids.concat(G.ids);
        ext = Math.max(ext, E);
        cur = s < 0 ? oy - kerf : cur + G.w + kerf;
        rows -= G.w + kerf;
        again = rows > 1;
      }
    }
    if (parts.length === 1) out.push(H);
    else out.push({ kind: 'nest', parts, l: ext, w: H.w, ids, room: H.room });
  });
  return out;
}

// ---------------------------------------------------------------- allowances

const tan1 = Math.tan(Math.PI / 180);

/** Gives every piece its cut size (fit size + allowances). Pieces without edge information stay unchanged. */
export function applyAllowances(pcs: Piece[], al: Allowances): Piece[] {
  if (!al.enabled && !al.angleTolerance) return pcs;
  const a = (t: EdgeKind | undefined) => (al.enabled && t ? al[t] : 0);
  return pcs.map((p) => {
    if (!p.edges) return p;
    const e = p.edges;
    const dl0 = a(e.l0), dl1 = a(e.l1), dw0 = a(e.w0), dw1 = a(e.w1);
    const tol = al.angleTolerance && (p.kind === 'trap' || p.kind === 'pair') ? p.w * tan1 : 0;
    if (!dl0 && !dl1 && !dw0 && !dw1 && !tol) return p;
    const q: Piece = { ...p, fitL: p.fitL ?? p.l, fitW: p.fitW ?? p.w };
    const W = p.w + dw0 + dw1;
    q.w = W;
    if (p.kind === 'rect') {
      q.l = p.l + dl0 + dl1;
      const shift = (c: number) => c + dl0;
      if (p.cuts) q.cuts = p.cuts.map(shift);
      if (p.cut) q.cut = shift(p.cut);
    } else if (p.kind === 'trap' && p.prof) {
      const d = dl0 + dl1 + tol;
      q.prof = p.prof.map(([t, h]): Pt => [(t * p.w + dw0) / W, h + d]);
      q.ha = q.prof[0]![1];
      q.hb = q.prof[q.prof.length - 1]![1];
      q.l = lmax(q);
    } else if (p.kind === 'pair') {
      const d = dl0 + dl1 + tol;
      q.l = p.l + d;
      q.ya = p.ya! + d / 2; q.yb = p.yb! + d / 2; q.yc = p.yc! + d / 2;
    }
    return q;
  });
}

/** Makes pieces fit the usable plate length: ready-made pairs that are too long become two trapezoids again. */
export function fitToPlate(pcs: Piece[], PLe: number): Piece[] {
  const out: Piece[] = [];
  pcs.forEach((p) => {
    if (p.kind === 'pair' && p.l > PLe + 1e-6) {
      const mk = (id: number, a: number, b: number, e: Piece['edges']): Piece => ({ kind: 'trap', l: Math.max(a, b), w: p.w, ids: [id], room: p.room, ha: a, hb: b, prof: [[0, a], [1, b]], edges: e });
      const e = p.edges;
      out.push(mk(p.ids[0]!, p.ya!, p.yb!, e && { ...e, w1: 'joint' }), mk(p.ids[1]!, p.yb!, p.yc!, e && { ...e, w0: 'joint' }));
    } else out.push(p);
  });
  return out;
}

/** Pairs that come ready-made from the room model get the saw cut width along their slanted joint. */
export function applyPairKerf(pcs: Piece[], kerf: number): Piece[] {
  if (kerf <= 0) return pcs;
  return pcs.map((p) => {
    if (p.kind !== 'pair' || p.gap) return p;
    const first = piecePolygons(p)[0]!, second = piecePolygons(p)[1]!;
    const gap = clearShift([first], (d) => shiftPoly(second, d), kerf, 2 * kerf * 3);
    return { ...p, gap, l: p.l + gap };
  });
}


// ---------------------------------------------------------------- pieces longer than the plate

/** Positions (from the l0 end) of the cuts that bring a length L down to parts of at most `max`; a tiny last part is avoided. */
export function splitPositions(L: number, max: number, minPart = 10): number[] {
  if (L <= max + 1e-6 || max <= 0) return [];
  const n = Math.ceil(L / max - 1e-9);
  const at: number[] = [];
  for (let i = 1; i < n; i++) at.push(i * max);
  if (L - at[at.length - 1]! < minPart && max > 2 * minPart) at[at.length - 1] = L - minPart;
  return at;
}

/** Height profile of the part of a (concave) profile that lies between heights lo and hi, measured from lo. */
function clipProfile(prof: Pt[], lo: number, hi: number): Pt[] {
  const ts = new Set<number>(prof.map((q) => q[0]));
  for (let i = 0; i < prof.length - 1; i++) {
    const [t0, h0] = prof[i]!, [t1, h1] = prof[i + 1]!;
    for (const lv of [lo, hi]) {
      if ((h0 - lv) * (h1 - lv) < 0) ts.add(t0 + ((lv - h0) / (h1 - h0)) * (t1 - t0));
    }
  }
  const g = (t: number) => hAt({ prof } as Piece, t);
  return [...ts].sort((a, b) => a - b).map((t): Pt => [t, Math.min(Math.max(g(t), lo), hi) - lo]);
}

/**
 * Splits pieces that are longer than the usable plate (gable strips taller than the plate, boards that grew past it)
 * like boards: across their length, so the grain stays along the plate. Each part records where the split line is.
 */
export function splitLong(pcs: Piece[], PLe: number, endTg = false): { pieces: Piece[]; count: number } {
  const out: Piece[] = [];
  let count = 0;
  const label = (p: Piece, i: number, n: number) => (p.seg ? p.seg + String(i + 1) : n > 0 ? String.fromCharCode(97 + i) : '');
  pcs.forEach((p) => {
    if (p.kind !== 'rect' && p.kind !== 'trap') { out.push(p); return; }
    const L = p.kind === 'trap' ? lmax(p) : p.l;
    const at = splitPositions(L, PLe);
    if (!at.length) { out.push(p); return; }
    count++;
    const b = [0, ...at, L];
    for (let i = 0; i < b.length - 1; i++) {
      const lo = b[i]!, hi = b[i + 1]!, first = i === 0, last = i === b.length - 2;
      const q: Piece = { ...p, seg: label(p, i, b.length - 1) };
      if (p.edges) q.edges = { ...p.edges, l0: first ? p.edges.l0 : 'joint', l1: last ? p.edges.l1 : 'joint' };
      // a split made because the strip is longer than a plate is a joint between plates: tongue toward +l, groove at the other end
      if (endTg || p.tg) q.tg = { ...p.tg, l0: first ? p.tg?.l0 : endTg ? 'G' : undefined, l1: last ? p.tg?.l1 : endTg ? 'T' : undefined };
      const marks: PieceSplit[] = [...(p.splits ?? [])];
      if (!first) marks.push({ edge: 'l0', at: lo });
      if (!last) marks.push({ edge: 'l1', at: hi });
      q.splits = marks;
      if (p.kind === 'rect') {
        q.l = hi - lo;
        const cu = (p.cuts || (p.cut ? [p.cut] : [])).filter((c) => c > lo + 1e-6 && c < hi - 1e-6).map((c) => c - lo);
        q.cuts = p.cuts ? cu : undefined;
        q.cut = p.cut != null ? (cu[0] ?? null) : p.cut;
        if (!p.cuts) delete q.cuts;
      } else {
        q.prof = clipProfile(p.prof!, lo, hi);
        q.ha = q.prof[0]![1];
        q.hb = q.prof[q.prof.length - 1]![1];
        q.l = lmax(q);
      }
      out.push(q);
    }
  });
  return { pieces: out, count };
}

/**
 * A piece whose fit size fits the usable plate but whose cut size (fit + allowances) does not gets a smaller allowance:
 * it is cut as big as the plate allows and finished on site.
 */
export function clampAllowances(pcs: Piece[], PLe: number, PWe: number): { pieces: Piece[]; clamped: Piece[] } {
  const clamped: Piece[] = [];
  const pieces = pcs.map((p) => {
    if (p.fitL === undefined && p.fitW === undefined) return p;
    const fl = p.fitL ?? p.l, fw = p.fitW ?? p.w;
    const tooW = p.w > PWe + 1e-6 && fw <= PWe + 1e-6, tooL = p.l > PLe + 1e-6 && fl <= PLe + 1e-6 && (p.kind === 'rect' || p.kind === 'trap');
    if (!tooW && !tooL) return p;
    clamped.push(p);
    const q: Piece = { ...p };
    if (tooW) {
      if (q.kind === 'trap' && q.prof) q.prof = q.prof.map(([t, h]): Pt => [t * (PWe / q.w), h]);
      q.w = PWe;
    }
    if (tooL) {
      if (q.kind === 'rect') {
        q.l = PLe;
        if (q.cuts) q.cuts = q.cuts.map((c) => Math.min(c, PLe));
        if (q.cut) q.cut = Math.min(q.cut, PLe);
      } else if (q.kind === 'trap' && q.prof) {
        q.prof = q.prof.map(([t, h]): Pt => [t, Math.min(h, PLe)]);
        q.ha = q.prof[0]![1];
        q.hb = q.prof[q.prof.length - 1]![1];
        q.l = lmax(q);
      }
    }
    return q;
  });
  return { pieces, clamped };
}

/** Pieces that cannot be cut even when split: wider than the plate, or (pairs, polygons) longer than it. */
export function blockingPieces(pcs: Piece[], PLe: number, PWe: number, roomName: (k: string) => string, tooLongFields: string[], tooWideFields: string[]): BlockingIssue[] {
  const out: BlockingIssue[] = [];
  pcs.forEach((p) => {
    const room = p.room ?? '';
    const base = { room, roomName: roomName(room), ids: p.ids, seg: p.seg };
    if (p.w > PWe + 1e-6) out.push({ ...base, dir: 'width', size: p.w, limit: PWe, fields: tooWideFields });
    else if (p.l > PLe + 1e-6) out.push({ ...base, dir: 'length', size: p.l, limit: PLe, fields: tooLongFields });
  });
  return out;
}

/** Strips (board columns, gable strips) that are narrower than `min` cm, once per strip. */
export function findSliversInPieces(pcs: Piece[], min: number, roomName: (k: string) => string): Sliver[] {
  if (min <= 0) return [];
  const out: Sliver[] = [];
  const seen = new Set<string>();
  const add = (p: Piece) => {
    if (p.band) return;
    const w = p.fitW ?? p.w;
    const key = (p.room ?? '') + ':' + p.ids.join('+');
    if (w >= min - 1e-6 || seen.has(key)) return;
    seen.add(key);
    out.push({ room: p.room ?? '', roomName: roomName(p.room ?? ''), ids: p.ids, width: w });
  };
  pcs.forEach((p) => { if (p.kind === 'nest') p.parts!.forEach((t) => add({ ...t.p, room: t.p.room ?? p.room })); else add(p); });
  return out;
}

// ---------------------------------------------------------------- MaxRects / guillotine

interface Ctx {
  /** physical plate */
  PL: number; PW: number; kerf: number;
  /** edge trim along the length (left/right) and across (top/bottom): profiled edges are not trimmed */
  tx: number; ty: number; guillotine: boolean;
  /** tongue and groove: tongue size and which edges are profiled */
  tg: TgCtx | null;
}
interface Cfg { key: number; hr: number; bf: number; eps: number; rnd: () => number; sp: number }
/** where a box goes: top-left of the box in the (kerf-inflated) plate frame, inside free rectangle f */
interface Found { f: Rect; x: number; y: number; s1: number; s2: number }
interface Anch { aL: boolean; aR: boolean; aT: boolean; aB: boolean }

function mrFind(pl: Plate, w: number, h: number, hr: number, an?: Anch, frame?: { w: number; h: number }): Found | null {
  let best: Found | null = null;
  for (let i = 0; i < pl.free.length; i++) {
    const f = pl.free[i]!;
    if (f.w >= w - 1e-6 && f.h >= h - 1e-6) {
      let x = f.x, y = f.y;
      if (an && frame) {
        // an edge with a profile has to lie on the plate edge with the same profile
        if (an.aR) x = frame.w - w; else if (an.aL) x = 0;
        if (an.aB) y = frame.h - h; else if (an.aT) y = 0;
        if (an.aL && an.aR && Math.abs(x) > 1e-6) continue;
        if (an.aT && an.aB && Math.abs(y) > 1e-6) continue;
        if (x < f.x - 1e-6 || y < f.y - 1e-6 || x + w > f.x + f.w + 1e-6 || y + h > f.y + f.h + 1e-6) continue;
      }
      let s1: number, s2: number;
      if (hr === 0) { s1 = Math.min(f.w - w, f.h - h); s2 = Math.max(f.w - w, f.h - h); }
      else if (hr === 1) { s1 = y + h; s2 = x; }
      else { s1 = f.w * f.h - w * h; s2 = Math.min(f.w - w, f.h - h); }
      if (!best || s1 < best.s1 - 1e-9 || (Math.abs(s1 - best.s1) <= 1e-9 && s2 < best.s2)) best = { f, x, y, s1, s2 };
    }
  }
  return best;
}

function mrPlace(pl: Plate, x: number, y: number, w: number, h: number, p: Piece, dx = 0, dy = 0): void {
  let nf: Rect[] = [];
  pl.free.forEach((f) => {
    if (x >= f.x + f.w - 1e-9 || x + w <= f.x + 1e-9 || y >= f.y + f.h - 1e-9 || y + h <= f.y + 1e-9) { nf.push(f); return; }
    if (x > f.x + 1e-9) nf.push({ x: f.x, y: f.y, w: x - f.x, h: f.h });
    if (x + w < f.x + f.w - 1e-9) nf.push({ x: x + w, y: f.y, w: f.x + f.w - (x + w), h: f.h });
    if (y > f.y + 1e-9) nf.push({ x: f.x, y: f.y, w: f.w, h: y - f.y });
    if (y + h < f.y + f.h - 1e-9) nf.push({ x: f.x, y: y + h, w: f.w, h: f.y + f.h - (y + h) });
  });
  nf = nf.filter((a) => a.w > 1 && a.h > 1);
  pl.free = nf.filter((a, i) => !nf.some((b, j) => j !== i && b.x <= a.x + 1e-9 && b.y <= a.y + 1e-9 && b.x + b.w >= a.x + a.w - 1e-9 && b.y + b.h >= a.y + a.h - 1e-9 && (j < i || !(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9 && Math.abs(a.w - b.w) < 1e-9 && Math.abs(a.h - b.h) < 1e-9))));
  pl.items.push({ p, x: x + dx, y: y + dy });
}

/**
 * Guillotine placement in real coordinates: the free rectangle F is split by two straight through-cuts and the box sits in one
 * corner of it (top-left unless it has to touch the right / bottom plate edge). Each cut band is `kerf` wide and starts at the
 * cut's `pos`; the material left over is cut[pos .. pos+kerf] away. sp 0 cuts across the shorter leftover first, sp 1 the longer one.
 */
function gPlace(pl: Plate, F: Rect, x: number, y: number, l: number, w: number, p: Piece, sp: number, kerf: number, dx = 0, dy = 0): void {
  if (F.w <= 0 && F.h <= 0) { pl.items.push({ p, x: 0, y: 0 }); return; } // piece larger than the plate
  pl.free = pl.free.filter((r) => r !== F);
  const cuts = (pl.cuts ??= []);
  const rw = F.w - l, rh = F.h - w, e = 1e-9;
  const cx = x > F.x + 1e-6, cy = y > F.y + 1e-6; // the box sits at the right / bottom of F
  const horizFirst = sp === 0 ? rw < rh : rw >= rh;
  const add = (r: Rect) => { if (r.w > 1 && r.h > 1) pl.free.push(r); };
  const n = () => cuts.length + 1;
  // positions of the leftover bands and cut lines for a box at the left/top (local), mirrored when the box is at the right/bottom
  const lx = (off: number, len: number) => (cx ? F.x + F.w - off - len : F.x + off);
  const ly = (off: number, len: number) => (cy ? F.y + F.h - off - len : F.y + off);
  const hPos = cy ? F.y + F.h - w - kerf : F.y + w;
  const vPos = cx ? F.x + F.w - l - kerf : F.x + l;
  const cutH = (x0: number, x1: number) => cuts.push({ n: n(), orient: 'h', pos: hPos, from: x0, to: x1 });
  const cutV = (y0: number, y1: number) => cuts.push({ n: n(), orient: 'v', pos: vPos, from: y0, to: y1 });
  const bx = cx ? F.x + F.w - l : F.x, by = cy ? F.y + F.h - w : F.y;
  if (horizFirst) {
    if (rh > e) { cutH(F.x, F.x + F.w); add({ x: F.x, y: ly(w + kerf, rh - kerf), w: F.w, h: rh - kerf }); }
    if (rw > e) { cutV(by, by + w); add({ x: lx(l + kerf, rw - kerf), y: by, w: rw - kerf, h: w }); }
  } else {
    if (rw > e) { cutV(F.y, F.y + F.h); add({ x: lx(l + kerf, rw - kerf), y: F.y, w: rw - kerf, h: F.h }); }
    if (rh > e) { cutH(bx, bx + l); add({ x: bx, y: ly(w + kerf, rh - kerf), w: l, h: rh - kerf }); }
  }
  pl.items.push({ p, x: bx + dx, y: by + dy });
}

/** Width/height added to a piece when packing: MaxRects packs kerf-inflated boxes, the guillotine works in real sizes. */
const inflation = (c: Ctx) => (c.guillotine ? 0 : c.kerf);
const place = (pl: Plate, fd: { f: Rect; x: number; y: number }, w: number, h: number, p: Piece, cfg: { sp: number }, c: Ctx, dx = 0, dy = 0) => {
  if (c.guillotine) gPlace(pl, fd.f, fd.x, fd.y, w, h, p, cfg.sp, c.kerf, dx, dy);
  else mrPlace(pl, fd.x, fd.y, w, h, p, dx, dy);
};

interface LayoutResult { plates: Plate[]; segs: number[]; fromOff: number; extra: number; total: number; sq: number }
interface BandCtx { hb: number; mn: number; mx: number; len: number; use: boolean | number; perPlate: number }

const SORT_KEYS: Array<(p: Piece) => number> = [
  (p) => p.l * p.w,
  (p) => p.w * 1000 + p.l,
  (p) => p.l * 1000 + p.w,
  (p) => Math.max(p.l, p.w) * 1000 + Math.min(p.l, p.w),
];

const PLe = (c: Ctx) => c.PL - 2 * c.tx;
const PWe = (c: Ctx) => c.PW - 2 * c.ty;

function newPlate(c: Ctx): Plate {
  const k = inflation(c);
  return { free: [{ x: 0, y: 0, w: PLe(c) + k, h: PWe(c) + k }], items: [], area: 0, use: 0 };
}

function layout(items: Piece[], cfg: Cfg, c: Ctx, bd: BandCtx | null): LayoutResult {
  const { kerf } = c;
  const k = inflation(c);
  const plates: Plate[] = [];
  const keys = SORT_KEYS[cfg.key]!;
  const ord = items.map((p) => ({ p, k: keys(p) * (1 + cfg.eps * cfg.rnd()) })).sort((a, b) => b.k - a.k);
  const frame = { w: PLe(c) + k, h: PWe(c) + k };
  ord.forEach((o) => {
    // every way the piece may lie on a plate (0°, 180°): the box has the piece's covering size plus the tongues it keeps
    const cands = orientations(o.p, c.tg, c.tg ? { L: PLe(c), W: PWe(c) } : undefined).map((q) => ({ q, p: q.rot ? rotate180(o.p) : o.p, pw: q.bw + k, ph: q.bh + k }));
    const an = (q: Orientation): Anch => ({ aL: q.aL, aR: q.aR, aT: q.aT, aB: q.aB });
    const anchored = !!c.tg;
    let best: Found | null = null, bp: Plate | null = null, bc = cands[0]!;
    for (let i = 0; i < plates.length; i++) {
      for (const cd of cands) {
        const b = mrFind(plates[i]!, cd.pw, cd.ph, cfg.hr, anchored ? an(cd.q) : undefined, anchored ? frame : undefined);
        if (b) {
          if (!cfg.bf) { if (!best) { best = b; bp = plates[i]!; bc = cd; } continue; }
          if (!best || b.s1 < best.s1 - 1e-9 || (Math.abs(b.s1 - best.s1) <= 1e-9 && b.s2 < best.s2)) { best = b; bp = plates[i]!; bc = cd; }
        }
      }
      if (!cfg.bf && best) break;
    }
    if (!best || !bp) {
      bp = newPlate(c);
      plates.push(bp);
      for (const cd of cands) {
        const b = mrFind(bp, cd.pw, cd.ph, cfg.hr, anchored ? an(cd.q) : undefined, anchored ? frame : undefined);
        if (b && (!best || b.s1 < best.s1)) { best = b; bc = cd; }
      }
      if (!best) { // cannot happen for pieces that passed the size checks; placed unconstrained rather than lost
        const q0 = { rot: false, bw: o.p.l, bh: o.p.w, dx: 0, dy: 0, aL: false, aR: false, aT: false, aB: false };
        bc = { q: q0, p: o.p, pw: o.p.l + k, ph: o.p.w + k };
        best = mrFind(bp, bc.pw, bc.ph, cfg.hr) || { f: { x: 0, y: 0, w: 0, h: 0 }, x: 0, y: 0, s1: 0, s2: 0 };
      }
    }
    place(bp, best, bc.pw, bc.ph, bc.p, cfg, c, bc.q.dx, bc.q.dy);
  });
  const res: LayoutResult = { plates, segs: [], fromOff: 0, extra: 0, total: 0, sq: 0 };
  if (bd && bd.hb > 0 && bd.perPlate > 0 && bd.len > 0) {
    const { hb, mn, mx } = bd;
    let rest = bd.len;
    const nextK = (h: number) => {
      let kk = Math.min(h, mx, rest);
      if (rest - kk > 1e-6 && rest - kk < mn && rest - mn >= mn - 1e-6) kk = rest - mn;
      return kk;
    };
    const bandPiece = (kk: number): Piece => ({ kind: 'rect', l: hb, w: kk, ids: [], room: 'B', band: true });
    if (bd.use) {
      while (rest > 1e-6) {
        let bc: { pl: Plate; f: Rect; k: number; s: number } | null = null;
        plates.forEach((pl) => {
          pl.free.forEach((f) => {
            if (f.w < hb + k - 1e-6) return;
            const kk = nextK(f.h - k);
            if (kk <= 0 || kk > f.h - k + 1e-6 || (kk < mn - 1e-6 && kk < rest - 1e-6)) return;
            const s = kk * 1e6 - f.w * f.h;
            if (!bc || s > bc.s) bc = { pl, f, k: kk, s };
          });
        });
        if (!bc) break;
        const b = bc as { pl: Plate; f: Rect; k: number };
        place(b.pl, { f: b.f, x: b.f.x, y: b.f.y }, hb + k, b.k + k, bandPiece(b.k), { sp: cfg.sp }, c);
        res.segs.push(b.k);
        rest -= b.k;
        res.fromOff += b.k;
      }
    }
    while (rest > 1e-6) {
      const pl2: Plate = { free: [], items: [], extra: true, area: 0, use: 0 };
      for (let c2 = 0; c2 < bd.perPlate && rest > 1e-6; c2++) {
        const k2 = nextK(Math.min(mx, PWe(c)));
        pl2.items.push({ p: bandPiece(k2), x: c2 * (hb + kerf), y: 0 });
        res.segs.push(k2);
        rest -= k2;
      }
      plates.push(pl2);
      res.extra++;
    }
  }
  // move from the kerf-inflated frame to plate coordinates
  plates.forEach((pl) => {
    pl.items.forEach((it) => { it.x += c.tx; it.y += c.ty; });
    if (pl.cuts) pl.cuts.forEach((q) => { const dp = q.orient === 'h' ? c.ty : c.tx, dq = q.orient === 'h' ? c.tx : c.ty; q.pos += dp; q.from += dq; q.to += dq; });
    let a = 0;
    pl.items.forEach((it) => { a += pieceArea(it.p); });
    pl.area = a;
    pl.use = a / (c.PL * c.PW);
    res.sq += pl.use * pl.use;
  });
  res.total = plates.length;
  return res;
}

function search(items: Piece[], c: Ctx, bd: BandCtx | null, iters: number, ms: number, seed: number): LayoutResult & { tried: number } {
  const rnd = mulberry32(seed);
  const t0 = Date.now();
  let best: LayoutResult | null = null, n = 0;
  const cfgs: Cfg[] = [];
  for (let key = 0; key < 4; key++) for (let hr = 0; hr < 3; hr++) for (let bf = 0; bf < 2; bf++) cfgs.push({ key, hr, bf, eps: 0, rnd, sp: 0 });
  if (c.guillotine) { const n0 = cfgs.length; for (let i = 0; i < n0; i++) cfgs.push({ ...cfgs[i]!, sp: 1 }); }
  while (n < iters && (n < cfgs.length || Date.now() - t0 < ms)) {
    const cfg: Cfg = n < cfgs.length ? cfgs[n]! : { key: Math.floor(rnd() * 4), hr: Math.floor(rnd() * 3), bf: rnd() < 0.5 ? 1 : 0, eps: 0.05 + rnd() * 0.5, rnd, sp: 0 };
    if (n >= cfgs.length && c.guillotine) cfg.sp = rnd() < 0.5 ? 1 : 0;
    const r = layout(items, cfg, c, bd);
    if (!best || r.total < best.total || (r.total === best.total && r.sq > best.sq + 1e-9)) best = r;
    n++;
  }
  return { ...best!, tried: n };
}

// ---------------------------------------------------------------- offcuts and verification

/** Greedy disjoint set of free rectangles that are at least `min` cm in both directions. */
export function findOffcuts(pl: Plate, min: number, kerf: number): Rect[] {
  if (pl.extra) return [];
  const cand = pl.free.map((r) => ({ x: r.x, y: r.y, w: r.w - kerf, h: r.h - kerf })).filter((r) => r.w >= min - 1e-9 && r.h >= min - 1e-9 && r.w > 1 && r.h > 1);
  cand.sort((a, b) => b.w * b.h - a.w * a.h);
  const out: Rect[] = [];
  cand.forEach((r) => {
    const ov = out.some((o) => r.x < o.x + o.w - 1e-9 && r.x + r.w > o.x + 1e-9 && r.y < o.y + o.h - 1e-9 && r.y + r.h > o.y + 1e-9);
    if (!ov) out.push(r);
  });
  return out;
}

/**
 * Checks that a plate layout can be cut with straight through-cuts in the order listed in `plate.cuts`:
 * every cut has to run across one current part completely, and every piece has to end up inside a part of its own.
 */
export function verifyGuillotine(pl: Plate, PL: number, PW: number, kerf: number, trim: number, trimY = trim): string | null {
  interface R { x: number; y: number; w: number; h: number }
  let parts: R[] = [{ x: trim, y: trimY, w: PL - 2 * trim, h: PW - 2 * trimY }];
  const e = 1e-6;
  for (const c of pl.cuts ?? []) {
    const idx = parts.findIndex((r) =>
      c.orient === 'h'
        ? c.pos >= r.y - e && c.pos <= r.y + r.h + e && Math.abs(c.from - r.x) < 1e-4 && c.to >= r.x + r.w - 1e-4
        : c.pos >= r.x - e && c.pos <= r.x + r.w + e && Math.abs(c.from - r.y) < 1e-4 && c.to >= r.y + r.h - 1e-4);
    if (idx < 0) return `cut ${c.n} (${c.orient} at ${c.pos.toFixed(2)}) does not run across a whole part`;
    const r = parts[idx]!;
    parts.splice(idx, 1);
    if (c.orient === 'h') parts.push({ x: r.x, y: r.y, w: r.w, h: c.pos - r.y }, { x: r.x, y: c.pos + kerf, w: r.w, h: r.y + r.h - c.pos - kerf });
    else parts.push({ x: r.x, y: r.y, w: c.pos - r.x, h: r.h }, { x: c.pos + kerf, y: r.y, w: r.x + r.w - c.pos - kerf, h: r.h });
    parts = parts.filter((q) => q.w > e && q.h > e);
  }
  for (const it of pl.items) {
    const ok = parts.some((r) => it.x >= r.x - 1e-4 && it.y >= r.y - 1e-4 && it.x + it.p.l <= r.x + r.w + 1e-4 && it.y + it.p.w <= r.y + r.h + 1e-4);
    if (!ok) return `piece ${it.p.ids.join('+')} at ${it.x.toFixed(2)},${it.y.toFixed(2)} is not inside a part of its own`;
  }
  return null;
}

// ---------------------------------------------------------------- compute

const plateName = (r: RoomInput, d: RoomInput, ref: RoomInput | undefined) =>
  ref && (Math.abs(d.PL - ref.PL) > 0.5 || Math.abs(d.PW - ref.PW) > 0.5) ? `${r.name} ma płytę ${d.PL}×${d.PW}, inną niż salon` : null;

export function computeCut(req: CutRequest): CutResult {
  const warn: string[] = [];
  const notes: CutNote[] = [];
  let PL = 0, PW = 0, all: Piece[] = [];
  const per: CutResult['per'] = [];
  const on = req.rooms.filter((r) => r.on);
  const ref = req.rooms.find((r) => r.key === 'S') ?? req.rooms[0];
  on.forEach((r) => {
    PL = Math.max(PL, r.PL);
    PW = Math.max(PW, r.PW);
    const w = plateName(r, r, ref);
    if (w) { warn.push(w); notes.push({ code: 'plateDiffers', room: r.key, roomName: r.name, PL: r.PL, PW: r.PW }); }
  });
  if (!PL && ref) { PL = ref.PL; PW = ref.PW; }
  const { settings: st } = req;
  const kerf = Math.max(0, st.kerf), trim = Math.max(0, st.trim);
  // tongue and groove: the plate is its physical size, pieces are covering sizes; profiled edges are not trimmed
  const cover = req.plate && req.plate.profile !== 'none' ? plateCover(req.plate) : null;
  if (req.plate) { PL = req.plate.L; PW = req.plate.W; }
  const tgc: TgCtx | null = cover ? { t: cover.t, long: cover.long, end: cover.end } : null;
  const tx = cover?.end ? 0 : trim, ty = cover ? 0 : trim;
  const ctx: Ctx = { PL, PW, kerf, tx, ty, guillotine: st.guillotine, tg: tgc };
  const PLe = PL - 2 * tx, PWe = PW - 2 * ty;
  /** longest / widest piece (covering size): the tongue of a piece sticks out of its box */
  const maxL = PLe - (cover?.end ? cover.t : 0), maxW = PWe - (cover ? cover.t : 0);
  const frame: NestFrame | undefined = tgc ? { tg: tgc, PLe, PWe } : undefined;
  let tgDropped = 0;
  const b = req.band;
  const hb = Number(b.h) || 0, len = Number(b.len) || 0;
  const mn0 = Math.max(1, Number(b.min) || 1);
  const mx = Math.min(Number(b.max) || PWe, PWe);
  const mn = Math.min(mn0, mx);
  const perPlate = hb > 0 ? Math.floor((PLe + kerf) / (hb + kerf) + 1e-9) : 0;
  const bandAlone = hb > 0 && perPlate > 0 && mx > 0 ? Math.ceil(Math.ceil(len / mx - 1e-9) / perPlate) + 0 : 0; // + 0 turns -0 into 0
  if (hb > PLe || !perPlate) { warn.push('Opaska jest wyższa od długości płyty, pominięto.'); notes.push({ code: 'bandTooTall' }); }
  let allowanceArea = 0, splitCount = 0;
  const clamped: Piece[] = [];
  on.forEach((r) => {
    let pcs: Piece[] = r.pieces.map((p) => ({ ...p, room: r.key }));
    if (req.splitAtBends) pcs = splitPieces(pcs);
    const fit = pcs.reduce((a, p) => a + pieceArea(p), 0);
    pcs = fitToPlate(applyPairKerf(applyAllowances(pcs, req.allowances), kerf), maxL);
    const cl = clampAllowances(pcs, maxL, maxW);
    pcs = cl.pieces;
    clamped.push(...cl.clamped);
    const sp = splitLong(pcs, maxL, !!cover?.end);
    pcs = sp.pieces;
    splitCount += sp.count;
    const na = pcs.reduce((a, p) => a + pieceArea(p), 0);
    allowanceArea += na - fit;
    if (tgc) pcs = pcs.map((p) => { if (p.tg && !orientations(p, tgc, { L: PLe, W: PWe }).length) { tgDropped++; return { ...p, tg: undefined }; } return p; });
    const alone = search(pairPieces(pcs, maxL, kerf, frame), ctx, null, 60, 250, req.seed).total;
    per.push({ key: r.key, name: r.name, n: pcs.length, area: na, alone });
    all = all.concat(pcs);
  });
  const nameOf = (k: string) => req.rooms.find((r) => r.key === k)?.name ?? k;
  const blocking = blockingPieces(all, maxL, maxW, nameOf, ['PL', 'trim'], ['PW', 'trim', 'allowances']);
  const clampedList = clamped.map((p) => ({ room: p.room ?? '', roomName: nameOf(p.room ?? ''), ids: p.ids, seg: p.seg }));
  const slivers = findSliversInPieces(all, st.minStrip ?? 0, nameOf);
  if (blocking.length) {
    const stats0: CutStats = { plates: 0, grossM2: 0, netM2: 0, utilisation: 0, cost: 0, kerfM2: 0, allowanceM2: allowanceArea / 1e4, offcutKeptM2: 0, wasteM2: 0, separate: 0 };
    return { plates: [], PL, PW, per, warn, roomPlates: 0, extraPlates: 0, segs: [], fromOff: 0, bandLen: len, bandH: hb, bandAlone, tried: 0, netto: 0, stats: stats0, blocking, notes, splitCount, clamped: clampedList, slivers, tongue: cover ? { t: cover.t, long: cover.long, end: cover.end } : undefined, tgDropped };
  }
  const bd: BandCtx | null = hb > 0 && perPlate > 0 && len > 0 ? { hb, mn, mx, len, use: b.use ? 1 : 0, perPlate } : null;
  const R0 = search(pairPieces(all, maxL, kerf, frame), ctx, bd, req.maxIters, req.timeMs, req.seed);
  const plates = R0.plates;
  plates.forEach((pl) => {
    if (st.minOffcut > 0 || st.guillotine) pl.offcuts = findOffcuts(pl, Math.max(st.minOffcut, 0), st.guillotine ? 0 : kerf);
  });
  const roomPlates = plates.filter((p) => !p.extra).length;
  const netto = per.reduce((a, p) => a + p.area, 0) + hb * len;
  const gross = plates.length * PL * PW;
  let kerfArea = 0, keptArea = 0;
  plates.forEach((pl) => {
    pl.items.forEach((it) => { kerfArea += (it.p.l + kerf) * (it.p.w + kerf) - it.p.l * it.p.w; });
    (pl.offcuts ?? []).forEach((o) => { keptArea += o.w * o.h; });
  });
  const sep = per.reduce((a, p) => a + p.alone, 0) + bandAlone;
  const stats: CutStats = {
    plates: plates.length, grossM2: gross / 1e4, netM2: netto / 1e4, utilisation: gross ? netto / gross : 0, cost: (gross / 1e4) * req.price,
    kerfM2: kerf > 0 ? kerfArea / 1e4 : 0, allowanceM2: allowanceArea / 1e4, offcutKeptM2: keptArea / 1e4,
    wasteM2: Math.max(0, gross - netto - (kerf > 0 ? kerfArea : 0) - keptArea) / 1e4, separate: sep,
  };
  return { plates, PL, PW, per, warn, roomPlates, extraPlates: plates.length - roomPlates, segs: R0.segs, fromOff: R0.fromOff, bandLen: len, bandH: hb, bandAlone, tried: R0.tried, netto, stats, blocking, notes, splitCount, clamped: clampedList, slivers, tongue: cover ? { t: cover.t, long: cover.long, end: cover.end } : undefined, tgDropped };
}
