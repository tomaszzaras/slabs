// The "roof sheet": the roof and the knee walls of an attic room unrolled into ONE flat sheet (brief: docs/briefs/unrolled-room-grid.md).
// u = arc length across the room measured from the ridge (negative = left slope), z along the ridge. Strips run across the sheet
// (ridge to floor) at constant z; one start point R and one joint grid for the whole sheet. Where a corner cut-out passes the ridge
// the cross-section has no ridge: it starts at the fold of the cut-out wall, which unrolls as part of the sheet (u = fold - height).
// Pieces = strips x split choices (ridge, folds, cross-cuts). The per-segment model in attic.ts stays as the artifact-parity model.
import { PF_MODE, type AtticModel } from './attic';
import { MSG, type Lang } from './messages';
import { f } from './util';
import { splitPositions } from './nest';
import { deriveTg } from './plate';
import type { Opening } from './openings';
import type { EdgeKind, Piece, Pt } from './types';

export type SplitId = 'ridge' | 'eaveL' | 'eaveR' | 'cap' | 'wallfold';
export const SPLIT_IDS: SplitId[] = ['eaveL', 'cap', 'ridge', 'wallfold', 'eaveR'];

/** What the user chose for one strip: explicit split / join per fold line, and free cross-cuts (u, cm from the ridge, signed). */
export interface StripChoice { s?: Partial<Record<SplitId, boolean>>; c?: number[] }
/** All choices of a room: a choice for a whole line (`line`) and per strip (`strips`, keyed by the strip's index from the start point). */
export interface RoofSplits { line?: Partial<Record<SplitId, boolean>>; strips?: Record<string, StripChoice> }
export interface SheetConfig { splits: RoofSplits; /** project setting "Dziel kawałki na zgięciach" */ splitAtBends: boolean }

/** Where the sheet's folds sit for a range of z with the same cross-section. */
export interface SheetBand {
  z0: number; z1: number;
  uL: number; uR: number;
  /** u of the origin: the ridge, or the fold of the cut-out wall / partition where the cross-section has no ridge */
  origin: number;
  folds: Array<{ id: SplitId; u: number }>;
}

export interface SheetCell {
  band: number;
  z0: number; z1: number;
  uL: number; uR: number;
  /** wall (outline) or joint (next strip) on the z0 / z1 side */
  w0: EdgeKind; w1: EdgeKind;
}

export interface SheetStrip {
  /** index from the start point (0 = the strip starting at R); the stable key of the choices */
  k: number;
  /** field number, in strip order */
  id: number;
  a: number; b: number;
  cells: SheetCell[];
}

/** One clickable split line of one cell of a strip. */
export interface SheetLine { strip: number; id: SplitId; cell: number; u: number; z0: number; z1: number; on: boolean; explicit: boolean }
/** A cross-cut inside a flat part; `auto` = made because the piece would exceed the plate. */
export interface SheetCut { strip: number; cell: number; u: number; z0: number; z1: number; auto: boolean }

export interface SheetNote { strip: number; id: number; kind: 'joined-long'; len: number; max: number }

export interface RoofSheet {
  key: 1;
  ref: string;
  /** usable plate length (covering size less the trim) */
  PL: number;
  /** strip width (covering width less the trim): the pitch of the joint grid */
  BW: number;
  L: number;
  /** start of the joint grid: z of a joint, shifted by the room's input o1 */
  anchor: number;
  /** the joint nearest to the anchor (where R is drawn) */
  zr: number;
  /** u where R is drawn (the origin of the band the start joint lies in) */
  ur: number;
  uMin: number; uMax: number;
  bands: SheetBand[];
  strips: SheetStrip[];
  outline: Pt[];
  lines: SheetLine[];
  cuts: SheetCut[];
  notes: SheetNote[];
  pieces: Piece[];
  /** u of the fold at the cut-out wall (or partition) when the room has one: used to move old openings onto the sheet */
  wallFold: number | null;
  /** which folds exist, with their label key */
  present: SplitId[];
  cap: boolean;
}

const EPS = 1e-6;

/** The default of a split line: the ridge is always split, the flat/slope fold of a flat ceiling is not, the other folds follow the project setting. */
export const splitDefault = (id: SplitId, splitAtBends: boolean): boolean => (id === 'ridge' ? true : id === 'cap' ? false : splitAtBends);

export function splitChoice(sp: RoofSplits | undefined, k: number, id: SplitId, splitAtBends: boolean): { on: boolean; explicit: boolean } {
  const e = sp?.strips?.[String(k)]?.s?.[id];
  if (typeof e === 'boolean') return { on: e, explicit: true };
  const l = sp?.line?.[id];
  return { on: typeof l === 'boolean' ? l : splitDefault(id, splitAtBends), explicit: false };
}

const ends = (c: { uL: number; uR: number }, u: number) => Math.abs(u - c.uL) < 0.5 || Math.abs(u - c.uR) < 0.5;

interface Geo { rl: (x: number) => number; rr: (x: number) => number }
function geo(m: AtticModel): Geo {
  const { xc, C, cap } = m;
  return { rl: (x) => (x <= xc ? x : xc + (x - xc) / C), rr: (x) => (cap ? x : x / C) };
}

/** The cross-sections of the room along z: every change of the outline starts a new band. */
function makeBands(m: AtticModel): SheetBand[] {
  const { rl, rr } = geo(m);
  const isL1 = m.XT !== undefined, p = m.p;
  const hasA = !isL1 && !!p.cA && m.ZA > 1;
  const hasB = !isL1 && !!p.cB && m.ZB < m.L - 1;
  const zs = [0];
  if (hasA) zs.push(m.ZA);
  if (hasB) zs.push(m.ZB);
  zs.push(m.L);
  const bands: SheetBand[] = [];
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i]!, z1 = zs[i + 1]!, mid = (z0 + z1) / 2;
    let uL: number, uR: number, origin: number;
    const folds: SheetBand['folds'] = [];
    if (isL1) {
      const eave = rr(m.XR - m.XT!);
      uL = -m.TOPH; uR = eave + m.HR; origin = 0;
      folds.push({ id: 'wallfold', u: 0 }, { id: 'eaveR', u: eave });
    } else if (hasB && mid > m.ZB) {
      const F = rl(m.XB), eave = rr(m.XR);
      uL = F - m.y(m.XB); uR = eave + m.HR; origin = F;
      folds.push({ id: 'wallfold', u: F }, { id: 'eaveR', u: eave });
    } else {
      const recess = hasA && mid < m.ZA;
      const eaveL = rl(m.hw), eaveR = recess ? rr(m.XA) : rr(m.XR);
      uL = -(eaveL + m.HL);
      uR = eaveR + (recess ? m.y(m.XA) : m.HR);
      origin = 0;
      folds.push({ id: 'eaveL', u: -eaveL });
      if (m.cap && m.xc > EPS) folds.push({ id: 'cap', u: -m.xc });
      folds.push({ id: 'ridge', u: 0 }, { id: 'eaveR', u: eaveR });
    }
    bands.push({ z0, z1, uL, uR, origin, folds: folds.filter((f) => f.id === 'ridge' || f.id === 'wallfold' || (f.u - uL > 0.5 && uR - f.u > 0.5)) });
  }
  return bands;
}

/** Spans of a cell between the active split positions. */
function spansOf(uL: number, uR: number, cuts: number[]): Array<[number, number]> {
  const b = [uL, ...cuts.filter((c) => c > uL + 0.5 && c < uR - 0.5).sort((x, y) => x - y), uR];
  const out: Array<[number, number]> = [];
  for (let i = 0; i < b.length - 1; i++) out.push([b[i]!, b[i + 1]!]);
  return out;
}

/** Active split positions of a cell: the folds that are split plus the user's cross-cuts. */
function activeCuts(band: SheetBand, uL: number, uR: number, strip: StripChoice | undefined, on: (id: SplitId) => boolean): { fold: Array<{ id: SplitId; u: number }>; free: number[] } {
  const fold = band.folds.filter((f) => on(f.id) && f.u - uL > 0.5 && uR - f.u > 0.5);
  const free = (strip?.c ?? []).filter((c) => c - uL > 0.5 && uR - c > 0.5 && !fold.some((f) => Math.abs(f.u - c) < 0.5));
  return { fold, free };
}

/**
 * Builds the sheet of an attic room from its (per-segment) model: strips from one joint grid, bands, outline, split lines and
 * the pieces. `m` must have the same start offset in o1..o5 (the app sets o2..o5 to o1), so the legacy segments share the grid.
 */
export function roofSheet(m: AtticModel, cfg: SheetConfig): RoofSheet {
  const p = m.p;
  const PL = p.PL! - 2 * (p.trimL ?? p.trim!), BW = p.PW! - 2 * p.trim!;
  const mode = PF_MODE[p.pf ?? 0]!;
  const anchor = m.ZO + (p.o1 ?? 0);
  const bands = makeBands(m);
  const sp = cfg.splits;

  // strips: one grid for the whole sheet
  const strips: SheetStrip[] = [];
  let id = 0;
  for (let k = Math.floor((0 - anchor) / BW + 1e-9); anchor + k * BW < m.L - 1e-9; k++) {
    const a = Math.max(0, anchor + k * BW), b = Math.min(m.L, anchor + (k + 1) * BW);
    if (b - a <= 1) continue;
    const cells: SheetCell[] = [];
    bands.forEach((bd, bi) => {
      const z0 = Math.max(a, bd.z0), z1 = Math.min(b, bd.z1);
      if (z1 - z0 <= 0.5) return;
      cells.push({ band: bi, z0, z1, uL: bd.uL, uR: bd.uR, w0: z0 > bd.z0 + 0.5 ? 'joint' : 'wall', w1: z1 < bd.z1 - 0.5 ? 'joint' : 'wall' });
    });
    if (cells.length) strips.push({ k, id: ++id, a, b, cells });
  }

  const lines: SheetLine[] = [], cuts: SheetCut[] = [], notes: SheetNote[] = [], pieces: Piece[] = [];
  const presentSet = new Set<SplitId>();
  strips.forEach((st) => {
    const choice = sp.strips?.[String(st.k)];
    const on = (sid: SplitId) => splitChoice(sp, st.k, sid, cfg.splitAtBends).on;
    const letters: Piece[] = [];
    type Rec = { lo: number; hi: number; l: number; dir: 1 | -1; u0: number; e0: EdgeKind; e1: EdgeKind; bends: number[]; c: SheetCell; w0: EdgeKind; w1: EdgeKind };
    const recs: Rec[] = [];
    st.cells.forEach((c, ci) => {
      const band = bands[c.band]!;
      band.folds.forEach((f) => {
        presentSet.add(f.id);
        const ch = splitChoice(sp, st.k, f.id, cfg.splitAtBends);
        lines.push({ strip: st.k, id: f.id, cell: ci, u: f.u, z0: c.z0, z1: c.z1, on: ch.on, explicit: ch.explicit });
      });
      const act = activeCuts(band, c.uL, c.uR, choice, on);
      const hard = [...act.fold.map((f) => f.u), ...act.free].sort((x, y) => x - y);
      let spans = spansOf(c.uL, c.uR, hard);
      // automatic cross-cuts where a span is longer than a plate: counted from the end nearest the origin
      const autoAt: number[] = [];
      const all: Array<[number, number]> = [];
      spans.forEach(([lo, hi]) => {
        const len = hi - lo;
        if (len <= PL + EPS) { all.push([lo, hi]); return; }
        const fromHi = band.origin >= hi - EPS || Math.abs(hi - band.origin) < Math.abs(lo - band.origin) - EPS;
        const at = splitPositions(len, PL).map((d) => (fromHi ? hi - d : lo + d));
        at.forEach((u) => autoAt.push(u));
        const b = [lo, ...at.slice().sort((x, y) => x - y), hi];
        for (let i = 0; i < b.length - 1; i++) all.push([b[i]!, b[i + 1]!]);
      });
      spans = all;
      autoAt.forEach((u) => cuts.push({ strip: st.k, cell: ci, u, z0: c.z0, z1: c.z1, auto: true }));
      act.free.forEach((u) => cuts.push({ strip: st.k, cell: ci, u, z0: c.z0, z1: c.z1, auto: false }));
      // a joined span that had to be cut anyway (dimensions grew after the join): say so on the strip
      const hardSpans = spansOf(c.uL, c.uR, hard);
      hardSpans.forEach(([lo, hi]) => { if (hi - lo > PL + EPS && !notes.some((n) => n.strip === st.k)) notes.push({ strip: st.k, id: st.id, kind: 'joined-long', len: hi - lo, max: PL }); });

      spans.forEach(([lo, hi]) => {
        const l = hi - lo;
        // l0 = the end nearest the origin of the band (ridge, or the fold of the cut-out wall)
        const dir: 1 | -1 = band.origin >= hi - EPS ? -1 : band.origin <= lo + EPS ? 1 : (Math.abs(hi - band.origin) < Math.abs(lo - band.origin) ? -1 : 1);
        const u0 = dir === 1 ? lo : hi;
        const edgeAt = (u: number): EdgeKind => {
          if (ends(c, u)) return 'wall';
          const f = act.fold.find((q) => Math.abs(q.u - u) < 0.5);
          if (f) return f.id === 'eaveL' || f.id === 'eaveR' || f.id === 'cap' ? 'bend' : 'wall';
          return 'joint';
        };
        const e0 = edgeAt(u0), e1 = edgeAt(dir === 1 ? hi : lo);
        const bends = band.folds.filter((f) => !act.fold.some((q) => q.id === f.id) && f.id !== 'ridge' && f.id !== 'wallfold' && f.u > lo + 0.5 && f.u < hi - 0.5).map((f) => dir * (f.u - u0)).sort((x, y) => x - y);
        // what touches the piece on its z sides: the next strip (joint) or an outline step (wall). The left slope goes on across the
        // steps of the right side (a recess), so a strip boundary that lies on such a step is still a joint there.
        const left = hi <= 0.5 && band.origin === 0;
        const zEdge = (first: boolean): EdgeKind => {
          const atBand = first ? c.z0 <= band.z0 + 0.5 : c.z1 >= band.z1 - 0.5;
          if (!atBand) return 'joint';
          if (first ? c.z0 <= 0.5 : c.z1 >= m.L - 0.5) return 'wall';
          if (!left) return 'wall';
          const nb = bands[c.band + (first ? -1 : 1)];
          return nb && nb.origin === 0 && Math.abs(nb.uL - band.uL) < 0.5 ? 'joint' : 'wall';
        };
        recs.push({ lo, hi, l, dir, u0, e0, e1, bends, c, w0: zEdge(true), w1: zEdge(false) });
      });
    });
    // The left slope does not change where the right side steps at a recess: its neighbouring cells are one piece. The right side is cut
    // there, like the per-segment model does (the recess wall / the cut-out start the right segments).
    const merged: Rec[] = [];
    recs.forEach((r) => {
      const q = r.hi > 0.5 ? undefined : merged.find((x) => Math.abs(x.lo - r.lo) < 0.5 && Math.abs(x.hi - r.hi) < 0.5 && x.e0 === r.e0 && x.e1 === r.e1 && Math.abs(x.c.z1 - r.c.z0) < 1e-6);
      if (q) { q.c = { ...q.c, z1: r.c.z1 }; q.w1 = r.w1; }
      else merged.push({ ...r });
    });
    merged.forEach((r) => {
      const piece: Piece = {
        kind: 'rect', l: r.l, w: r.c.z1 - r.c.z0, ids: [st.id], cut: r.bends[0] ?? null, edges: { l0: r.e0, l1: r.e1, w0: r.w0, w1: r.w1 },
        src: { kind: 'board', surf: 1, u0: r.u0, z0: r.c.z0, dir: r.dir },
        ...(r.bends.length > 1 ? { cuts: r.bends } : {}),
      };
      // joined across a fold on purpose: the nest must not cut it again at the bend
      if (r.bends.length) piece.noSplit = true;
      const g = deriveTg(piece.edges, mode);
      if (g) piece.tg = g;
      letters.push(piece);
    });
    if (letters.length > 1) letters.forEach((q, i) => { q.seg = String.fromCharCode(97 + (i % 26)); });
    pieces.push(...letters);
  });

  // outline of the unrolled sheet (u, z)
  const left: Pt[] = [], right: Pt[] = [];
  bands.forEach((b) => { left.push([b.uL, b.z0], [b.uL, b.z1]); right.push([b.uR, b.z0], [b.uR, b.z1]); });
  const outline: Pt[] = [...left, ...right.reverse()].filter((q, i, a) => i === 0 || Math.abs(q[0] - a[i - 1]![0]) > EPS || Math.abs(q[1] - a[i - 1]![1]) > EPS);

  // the start joint (nearest to the anchor) and where R is drawn
  const cand = [0, m.L];
  strips.forEach((s) => cand.push(s.a, s.b));
  const zr = cand.reduce((b, c) => (Math.abs(c - anchor) < Math.abs(b - anchor) ? c : b), cand[0]!);
  const bandAt = bands.find((b) => zr >= b.z0 - EPS && zr <= b.z1 + EPS && zr < b.z1 - EPS) ?? bands[bands.length - 1]!;
  const wf = bands.find((b) => b.folds.some((f) => f.id === 'wallfold'));
  const wallFold = wf ? wf.folds.find((f) => f.id === 'wallfold')!.u : null;
  return {
    key: 1, ref: 'R1', PL, BW, L: m.L, anchor, zr, ur: bandAt.origin,
    uMin: Math.min(...bands.map((b) => b.uL)), uMax: Math.max(...bands.map((b) => b.uR)),
    bands, strips, outline, lines, cuts, notes, pieces, wallFold,
    present: SPLIT_IDS.filter((x) => presentSet.has(x)), cap: m.cap,
  };
}

// ------------------------------------------------------------------ editing the choices (pure)

const clean = (sp: RoofSplits): RoofSplits => {
  const strips: Record<string, StripChoice> = {};
  for (const [k, v] of Object.entries(sp.strips ?? {})) {
    const s = v.s && Object.keys(v.s).length ? v.s : undefined, c = v.c && v.c.length ? v.c : undefined;
    if (s || c) strips[k] = { ...(s ? { s } : {}), ...(c ? { c } : {}) };
  }
  const line = sp.line && Object.keys(sp.line).length ? sp.line : undefined;
  return { ...(line ? { line } : {}), ...(Object.keys(strips).length ? { strips } : {}) };
};

/** Sets one fold of one strip. A choice equal to what the line / default gives is not stored. */
export function setStripSplit(sp: RoofSplits, k: number, id: SplitId, on: boolean, splitAtBends: boolean): RoofSplits {
  const cur = sp.strips?.[String(k)] ?? {};
  const s = { ...(cur.s ?? {}) };
  const base = typeof sp.line?.[id] === 'boolean' ? sp.line[id]! : splitDefault(id, splitAtBends);
  if (on === base) delete s[id]; else s[id] = on;
  return clean({ ...sp, strips: { ...(sp.strips ?? {}), [String(k)]: { ...cur, s } } });
}

/** Sets a fold for the whole line, across all strips (the strips' own choices for that fold are dropped). */
export function setLineSplit(sp: RoofSplits, id: SplitId, on: boolean, splitAtBends: boolean): RoofSplits {
  const strips: Record<string, StripChoice> = {};
  for (const [k, v] of Object.entries(sp.strips ?? {})) {
    const s = { ...(v.s ?? {}) };
    delete s[id];
    strips[k] = { ...v, s };
  }
  const line = { ...(sp.line ?? {}) };
  if (on === splitDefault(id, splitAtBends)) delete line[id]; else line[id] = on;
  return clean({ line, strips });
}

const round1 = (v: number) => Math.round(v * 10) / 10;
export function addStripCut(sp: RoofSplits, k: number, u: number): RoofSplits {
  const cur = sp.strips?.[String(k)] ?? {};
  const c = [...(cur.c ?? []).filter((x) => Math.abs(x - u) > 0.5), round1(u)].sort((a, b) => a - b);
  return clean({ ...sp, strips: { ...(sp.strips ?? {}), [String(k)]: { ...cur, c } } });
}
export function removeStripCut(sp: RoofSplits, k: number, u: number): RoofSplits {
  const cur = sp.strips?.[String(k)] ?? {};
  return clean({ ...sp, strips: { ...(sp.strips ?? {}), [String(k)]: { ...cur, c: (cur.c ?? []).filter((x) => Math.abs(x - u) > 0.25) } } });
}
export function moveStripCut(sp: RoofSplits, k: number, from: number, to: number): RoofSplits {
  return addStripCut(removeStripCut(sp, k, from), k, to);
}

/** Would joining this fold of this strip give a piece longer than a plate? (`null` = fine, else the length of the joined piece). */
export function joinTooLong(sheet: RoofSheet, sp: RoofSplits, k: number, id: SplitId, splitAtBends: boolean): number | null {
  const st = sheet.strips.find((q) => q.k === k);
  if (!st) return null;
  let worst = 0;
  st.cells.forEach((c) => {
    const band = sheet.bands[c.band]!;
    if (!band.folds.some((f) => f.id === id)) return;
    const on = (sid: SplitId) => (sid === id ? false : splitChoice(sp, k, sid, splitAtBends).on);
    const act = activeCuts(band, c.uL, c.uR, sp.strips?.[String(k)], on);
    spansOf(c.uL, c.uR, [...act.fold.map((f) => f.u), ...act.free]).forEach(([lo, hi]) => { worst = Math.max(worst, hi - lo); });
  });
  return worst > sheet.PL + EPS ? worst : null;
}

/** Would adding / removing nothing keep every joined span within a plate? Used to refuse a join with a message. */
export function pieceLengthsOk(sheet: RoofSheet): boolean { return sheet.notes.length === 0; }

export function sanitizeSplits(raw: unknown): RoofSplits {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as { line?: unknown; strips?: unknown };
  const ids = new Set<string>(SPLIT_IDS);
  const out: RoofSplits = {};
  if (r.line && typeof r.line === 'object') {
    const line: Partial<Record<SplitId, boolean>> = {};
    for (const [k, v] of Object.entries(r.line as Record<string, unknown>)) if (ids.has(k) && typeof v === 'boolean') line[k as SplitId] = v;
    if (Object.keys(line).length) out.line = line;
  }
  if (r.strips && typeof r.strips === 'object') {
    const strips: Record<string, StripChoice> = {};
    for (const [k, v] of Object.entries(r.strips as Record<string, unknown>).slice(0, 200)) {
      if (!/^-?\d{1,4}$/.test(k) || !v || typeof v !== 'object') continue;
      const q = v as { s?: unknown; c?: unknown };
      const s: Partial<Record<SplitId, boolean>> = {};
      if (q.s && typeof q.s === 'object') for (const [a, b] of Object.entries(q.s as Record<string, unknown>)) if (ids.has(a) && typeof b === 'boolean') s[a as SplitId] = b;
      const c = Array.isArray(q.c) ? q.c.filter((x): x is number => typeof x === 'number' && isFinite(x) && Math.abs(x) < 5000).slice(0, 20).map(round1) : [];
      if (Object.keys(s).length || c.length) strips[k] = { ...(Object.keys(s).length ? { s } : {}), ...(c.length ? { c } : {}) };
    }
    if (Object.keys(strips).length) out.strips = strips;
  }
  return out;
}

/** An opening drawn on one of the old per-segment surfaces (1-5), in the coordinates of the sheet. */
export function legacyOpeningToSheet(sheet: RoofSheet, o: Opening): Opening {
  if (o.surface < 1 || o.surface > 5) return o;
  const F = sheet.wallFold;
  const map = (q: Pt): Pt => (o.surface === 1 ? [-q[0], q[1]] : o.surface === 5 && F !== null ? [F - q[0], q[1]] : q);
  return { ...o, surface: 1, pts: o.pts.map(map) };
}

// ------------------------------------------------------------------ the room model with its sheet

/**
 * The model the app works with: the per-segment model (kept for the joint lines in 3D and the plan) plus the roof sheet. The
 * start points are one for the roof sheet (R1) and one per gable wall (R2...), field numbers run over the sheet's strips first.
 */
export function withSheet(m: AtticModel, cfg: SheetConfig, lang: Lang = 'pl'): AtticModel {
  const msg = MSG[lang];
  const sheet = roofSheet(m, cfg);
  const isL1 = m.XT !== undefined;
  const roofFields = m.surfs.reduce((a, s) => a + s.cols.length, 0);
  const shift = sheet.strips.length - roofFields;
  const walls = m.walls.map((w, i) => ({ ...w, ref: 'R' + (i + 2), strips: w.strips.map((q) => ({ ...q, id: q.id + shift })) }));
  const first = sheet.strips[0], last = sheet.strips[sheet.strips.length - 1];
  const roofRef = {
    id: 'R1', name: msg.lblRoof, fields: first && last ? (first.id === last.id ? String(first.id) : first.id + '–' + last.id) : '',
    where: isL1 ? msg.refWherePartition(f(sheet.zr)) : msg.refWhereRidge(f(sheet.zr)),
    coord: isL1 ? msg.coordTop(f(m.XT!), f(m.TOPH), f(sheet.zr)) : msg.coordRidge(f(m.TOPH), f(sheet.zr)),
  };
  const refs = [roofRef, ...walls.map((w, i) => ({ ...m.refs.find((r) => r.id === m.walls[i]!.ref)!, id: w.ref, name: msg.gableTitle(w.title), fields: w.strips.length ? `${w.strips[0]!.id}–${w.strips[w.strips.length - 1]!.id}` : '' }))];
  const present: Record<number, number> = { 1: 1 };
  walls.forEach((w) => { present[w.rid] = 1; });
  return { ...m, sheet, walls, refs, present, fields: sheet.strips.length + walls.reduce((a, w) => a + w.strips.length, 0) };
}

/** Where a keyboard user's cross-cut goes: the middle of the longest piece of the strip (cm from the ridge, signed). */
export function suggestCut(sheet: RoofSheet, sp: RoofSplits, k: number, splitAtBends: boolean): number | null {
  const st = sheet.strips.find((q) => q.k === k);
  if (!st) return null;
  let best: [number, number] | null = null;
  st.cells.forEach((c) => {
    const band = sheet.bands[c.band]!;
    const on = (sid: SplitId) => splitChoice(sp, k, sid, splitAtBends).on;
    const act = activeCuts(band, c.uL, c.uR, sp.strips?.[String(k)], on);
    spansOf(c.uL, c.uR, [...act.fold.map((f) => f.u), ...act.free]).forEach(([lo, hi]) => { if (!best || hi - lo > best[1] - best[0]) best = [lo, hi]; });
  });
  const b = best as [number, number] | null;
  return b ? Math.round((b[0] + b[1]) / 2) : null;
}
