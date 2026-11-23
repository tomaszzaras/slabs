// The generic room definition (docs/domain/rooms-model.md): footprint (width x length + notches), position under the roof, ceiling,
// and the cladding of every surface (finish, direction, start point). Every room of a project is one of these; the preset models
// (attic.ts / flat.ts) are the engines behind it. `engineInput` turns a spec into the inputs of an engine, `specFromLegacy` turns the
// per-type parameters of the older project files into a spec, so a migrated room gives the same pieces as before.
import { type Dir, type Finish, WOOD } from './face';
import { ROOMS, type RoomType } from './rooms';
import type { Params } from './util';

export type NotchKind = 'corner' | 'recess' | 'offset';
/**
 * A notch of the rectangle. corner: a cut-out of the back-left corner, a wide x b deep; recess: a recess along the front of the right wall,
 * a wide (across) x b long; offset: the right wall set back by a (b unused). The positions are the ones the room drawing has (see STATUS).
 */
export interface Notch { kind: NotchKind; a: number; b: number }
export const NOTCH_KINDS: NotchKind[] = ['corner', 'recess', 'offset'];

/** Where the room sits across the house under the roof: the whole width, from the left wall, from the right wall. */
export type Pos = 'full' | 'left' | 'right';
/** under the house roof (cap: optional flat ceiling at that height, 0 = none) or a flat ceiling at a height */
export type Ceiling = { kind: 'roof'; cap: number } | { kind: 'flat'; h: number };

/** Cladding of one surface. Missing = wood, default direction. */
export interface SurfCfg { dir?: Dir; finish?: Finish }

export interface RoomSpec {
  /** room width (across the house); for "whole width" under the roof the house width is used, this value is kept for when the position changes */
  w: number;
  /** length (along the ridge / the longer side) */
  l: number;
  notches: Notch[];
  pos: Pos;
  ceiling: Ceiling;
  /** flat ceiling: boards continue over the fold onto the wood part of the two walls the boards run toward */
  join: boolean;
  /** cladding per surface key (strings: 1 roof or ceiling, 2..5 walls of a flat room, 6..9 gable walls under the roof) */
  surf: Record<string, SurfCfg>;
  /** start points: ZO / XO (default start of the roof and of the gable walls) and the shifts o1..o9 */
  starts: Record<string, number>;
}

export const START_KEYS = ['ZO', 'XO', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9'] as const;

export const underRoofSpec = (s: RoomSpec): boolean => s.ceiling.kind === 'roof';
/** The engine behind a spec. */
export function typeOf(s: RoomSpec): RoomType {
  if (s.ceiling.kind === 'flat') return 'lazienka-2';
  return s.pos === 'left' ? 'sypialnia' : s.pos === 'right' ? 'lazienka-1' : 'salon';
}
export const notch = (s: RoomSpec, k: NotchKind): Notch | undefined => s.notches.find((n) => n.kind === k);
/** Which notches a room can have: only the rectangle that spans the whole house width (the model draws them on that plan). */
export const notchesAllowed = (s: RoomSpec): boolean => s.ceiling.kind === 'roof' && s.pos === 'full';

export const finishOf = (s: RoomSpec, key: number): Finish => s.surf[String(key)]?.finish ?? WOOD;
export const dirOf = (s: RoomSpec, key: number): Dir | undefined => s.surf[String(key)]?.dir;

/** Surface keys of a room: roof / ceiling, then its walls. */
export function surfaceKeys(s: RoomSpec): number[] {
  if (s.ceiling.kind === 'flat') return s.join ? [1, 2, 3] : [1, 2, 3, 4, 5];
  const keys = [1, 6];
  if (notch(s, 'recess') && notchesAllowed(s)) keys.push(7);
  if (notch(s, 'corner') && notchesAllowed(s)) keys.push(8);
  keys.push(9);
  return keys;
}

/** The default direction of a surface: boards run down the slope / up the wall / across the ceiling. */
export const defaultDir = (key: number, s: RoomSpec): Dir => (key === 1 ? 'slope' : s.ceiling.kind === 'flat' ? 'vertical' : 'vertical');
export const isWall = (key: number): boolean => key >= 2;

const base = (): RoomSpec => ({ w: 548, l: 400, notches: [], pos: 'full', ceiling: { kind: 'roof', cap: 0 }, join: false, surf: {}, starts: { ZO: 0, XO: 0 } });
const startsOf = (p: Params, zo = 0): Record<string, number> => {
  const o: Record<string, number> = { ZO: p.ZO ?? zo, XO: p.XO ?? 0 };
  for (let i = 1; i <= 9; i++) if (p['o' + i]) o['o' + i] = p['o' + i]!;
  return o;
};

/** A room with nothing set yet (the "Pusty" template): a plain rectangle under the roof. */
export const emptySpec = (): RoomSpec => base();

/** The four presets of the owner's house as specs (the start values of their types). */
export function presetSpec(type: RoomType): RoomSpec {
  return specFromLegacy(type, ROOMS[type].defaults);
}

/** The spec a version-1 / version-2 room (type + per-type parameters) stands for. Missing parameters take the type's defaults. */
export function specFromLegacy(type: RoomType, params: Record<string, number>): RoomSpec {
  const d = ROOMS[type].defaults;
  const p: Params = { ...d, ...params };
  const s = base();
  s.l = p.L ?? p.bz ?? 400;
  s.starts = startsOf(p, d.ZO ?? 0);
  if (type === 'lazienka-2') {
    // the same clamps as the preset model, so a value out of range gives the room the model would have made
    const H = Math.min(500, Math.max(100, p.H!));
    const hb = Math.min(Math.max(10, H - 10), Math.min(200, Math.max(10, p.hb!)));
    s.w = p.bx!; s.l = p.bz!;
    s.ceiling = { kind: 'flat', h: H };
    s.join = true;
    s.pos = 'full';
    const at = Math.max(0, H - hb);
    const fin: Finish = { kind: 'split', at, wood: 'above' };
    s.surf = { ...(p.dz ? { '1': { dir: 'ridge' as const } } : {}), '2': { finish: fin }, '3': { finish: fin }, '4': { finish: fin }, '5': { finish: fin } };
    return s;
  }
  if (type === 'salon') {
    s.pos = 'full'; s.w = p.W!;
    if ((params.cA ?? 1) && p.dA !== undefined) s.notches.push({ kind: 'recess', a: p.dA!, b: p.ZA! });
    if ((params.cB ?? 1) && p.wB !== undefined) s.notches.push({ kind: 'corner', a: p.wB!, b: p.dB! });
    if ((p.niche ?? 0) > 0) s.notches.push({ kind: 'offset', a: p.niche!, b: 0 });
    // "wycięcie w ścianie z końca" (the end wall is wood only above cutH) is a finish of the end wall, effective with the corner cut-out
    if (p.cutOn && (params.cB ?? 1)) s.surf['9'] = { finish: { kind: 'split', at: p.cutH!, wood: 'above' } };
    s.starts.ZO = params.ZO ?? d.ZO ?? 415;
    return s;
  }
  if (type === 'sypialnia') {
    s.pos = 'left'; s.w = p.Wb!;
    s.ceiling = { kind: 'roof', cap: p.capOn ? p.capH! : 0 };
    return s;
  }
  s.pos = 'right'; s.w = p.bw!;
  return s;
}

/** The salon's end-wall cut-out as the preset model takes it: a split "wood above h" of the end wall, only with the corner cut-out. */
export function endCutOf(s: RoomSpec): number | null {
  const f = s.surf['9']?.finish;
  return f && f.kind === 'split' && f.wood === 'above' && notch(s, 'corner') ? f.at : null;
}

/** The inputs of the engine behind a spec (the house roof comes from the project: `roof` = project roof with the room's overrides). */
export function engineInput(s: RoomSpec, roof: { W: number; ang: number; HL: number }): { type: RoomType; params: Params } {
  const type = typeOf(s);
  const p: Params = { ...ROOMS[type].defaults };
  for (const k of Object.keys(s.starts)) p[k] = s.starts[k]!;
  if (type === 'lazienka-2') {
    const c = s.ceiling.kind === 'flat' ? s.ceiling.h : 250;
    p.bx = s.w; p.bz = s.l; p.H = c;
    p.dz = s.surf['1']?.dir === 'ridge' ? 1 : 0;
    p.hb = flatBand(s) ?? 66;
    return { type, params: p };
  }
  p.W = roof.W; p.ang = roof.ang; p.HL = roof.HL; p.L = s.l;
  if (type === 'salon') {
    const r = notch(s, 'recess'), c = notch(s, 'corner'), o = notch(s, 'offset');
    p.niche = o ? o.a : 0;
    p.cA = r ? 1 : 0; p.cB = c ? 1 : 0;
    if (r) { p.dA = r.a; p.ZA = r.b; }
    if (c) { p.wB = c.a; p.dB = c.b; }
    const cut = endCutOf(s);
    p.cutOn = cut !== null ? 1 : 0;
    if (cut !== null) p.cutH = cut;
  } else if (type === 'sypialnia') {
    p.Wb = s.w;
    const cap = s.ceiling.kind === 'roof' ? s.ceiling.cap : 0;
    p.capOn = cap > 0 ? 1 : 0;
    if (cap > 0) p.capH = cap;
  } else p.bw = s.w;
  return { type, params: p };
}

/**
 * The height of the wood on the two walls a flat ceiling is joined to (the preset's "opaska"), or null when the join is not possible: the
 * two walls must have the same wood zone at their top, vertical boards, and the ceiling must run toward them.
 */
export function flatBand(s: RoomSpec): number | null {
  if (s.ceiling.kind !== 'flat') return null;
  const H = s.ceiling.h;
  const keys = flatJoinKeys(s);
  const hs = keys.map((k) => {
    const f = finishOf(s, k);
    if (dirOf(s, k) === 'horizontal') return null;
    if (f.kind === 'wood') return H;
    return f.kind === 'split' && f.wood === 'above' ? H - f.at : null;
  });
  return hs[0] !== null && hs[0] === hs[1] && hs[0]! >= 10 ? hs[0]! : null;
}
/** Walls the flat ceiling's boards run toward (keys 4 and 5). */
export const flatJoinKeys = (_s: RoomSpec): [number, number] => [4, 5];

/** Is every flat-room surface expressible in the preset flat model (Łazienka 2's)? Then that model gives the pieces (parity). */
export function flatIsPreset(s: RoomSpec): boolean {
  if (s.ceiling.kind !== 'flat' || !s.join || s.notches.length) return false;
  const hb = flatBand(s);
  if (hb === null || hb > 200 || hb > s.ceiling.h - 10) return false;
  const fs = [2, 3, 4, 5].map((k) => finishOf(s, k));
  if (!fs.every((f) => f.kind === 'split' && f.wood === 'above' && f.at === (fs[0] as { at: number }).at)) return false;
  return [2, 3, 4, 5].every((k) => (dirOf(s, k) ?? 'vertical') === 'vertical');
}

/** Roof-model walls (6..9) the preset model draws with its own code: default direction and the finishes the model has (wood; the end wall's cut-out). */
export function wallIsPreset(s: RoomSpec, key: number): boolean {
  if ((dirOf(s, key) ?? 'vertical') !== 'vertical') return false;
  const f = finishOf(s, key);
  if (f.kind === 'wood') return true;
  return key === 9 && endCutOf(s) !== null && f.kind === 'split';
}
export const roofIsPreset = (s: RoomSpec): boolean => (dirOf(s, 1) ?? 'slope') === 'slope' && finishOf(s, 1).kind === 'wood';

// ------------------------------------------------------------------ reading a spec from a file

const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const num = (v: unknown, d: number, lo = -1e5, hi = 1e5): number => (fin(v) ? Math.min(hi, Math.max(lo, v)) : d);
const DIRS: Dir[] = ['vertical', 'horizontal', 'slope', 'ridge'];

function sanitizeFinish(raw: unknown): Finish | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const label = typeof r.label === 'string' && r.label.trim() ? { label: r.label.trim().slice(0, 40) } : {};
  if (r.kind === 'wood') return { kind: 'wood' };
  if (r.kind === 'other') return { kind: 'other', ...label };
  if (r.kind === 'split' && fin(r.at)) return { kind: 'split', at: num(r.at, 0, 0, 2000), wood: r.wood === 'below' ? 'below' : 'above', ...label };
  return undefined;
}

/** A spec from anything that was parsed from a file: values are checked, not clamped to the models' ranges (the engines clamp and report). */
export function sanitizeSpec(raw: unknown): RoomSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const s = emptySpec();
  s.w = num(r.w, s.w, 0, 5000); s.l = num(r.l, s.l, 0, 5000);
  s.pos = r.pos === 'left' || r.pos === 'right' ? r.pos : 'full';
  const c = r.ceiling as Record<string, unknown> | undefined;
  s.ceiling = c && c.kind === 'flat' ? { kind: 'flat', h: num(c.h, 250, 0, 2000) } : { kind: 'roof', cap: c ? num(c.cap, 0, 0, 3000) : 0 };
  s.join = !!r.join && s.ceiling.kind === 'flat';
  if (Array.isArray(r.notches)) {
    for (const n of r.notches.slice(0, 6)) {
      const q = n as Record<string, unknown>;
      if (!q || !NOTCH_KINDS.includes(q.kind as NotchKind) || s.notches.some((x) => x.kind === q.kind)) continue;
      s.notches.push({ kind: q.kind as NotchKind, a: num(q.a, 0, 0, 5000), b: num(q.b, 0, 0, 5000) });
    }
  }
  if (r.surf && typeof r.surf === 'object') {
    for (const [k, v] of Object.entries(r.surf as Record<string, unknown>).slice(0, 12)) {
      if (!/^[1-9]$/.test(k) || !v || typeof v !== 'object') continue;
      const q = v as Record<string, unknown>;
      const cfg: SurfCfg = {};
      if (DIRS.includes(q.dir as Dir)) cfg.dir = q.dir as Dir;
      const f = sanitizeFinish(q.finish);
      if (f) cfg.finish = f;
      if (cfg.dir || cfg.finish) s.surf[k] = cfg;
    }
  }
  if (r.starts && typeof r.starts === 'object') {
    for (const k of START_KEYS) { const v = (r.starts as Record<string, unknown>)[k]; if (fin(v)) s.starts[k] = Math.min(5000, Math.max(-5000, v)); }
  }
  return s;
}

/** Which kind of room this is, for words: under the roof (whole width / from the left / from the right wall) or flat ceiling. */
export const roomKind = (s: RoomSpec): 'full' | 'left' | 'right' | 'flat' => (s.ceiling.kind === 'flat' ? 'flat' : s.pos);
