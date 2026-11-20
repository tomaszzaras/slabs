import { ARTIFACT_PLATE, DEFAULT_PLATE, ROOMS, ROOM_IDS, defaultOpenings, type PlateSpec, type ProfileMode, type Allowances, type Opening, type BandSpec, type CutSettings, type RoomId } from '@slabs/core';

export interface AllowanceMm { enabled: boolean; wall: number; bend: number; opening: number; gap: number; angleTolerance: boolean }
export interface ProjectSettings {
  kerfMm: number;
  trimMm: number;
  minOffcutCm: number;
  /** strips narrower than this are flagged as slivers, cm */
  minStripCm: number;
  guillotine: boolean;
  allowances: AllowanceMm;
  /** physical plate and its tongue-and-groove profile (the rooms are planned in covering sizes) */
  plate: PlateSpec;
}
import { emptyNames, houseNames, sanitizeNames, type Names } from './names';

export interface RoomState { on: boolean; params: Record<string, number> }
export interface Project {
  version: 1;
  id: string;
  name: string;
  updatedAt: number;
  settings: ProjectSettings;
  rooms: Record<RoomId, RoomState>;
  /** windows, doors and cut-outs per room (cut out of the pieces) */
  openings: Record<RoomId, Opening[]>;
  shared: { band: BandSpec; price: number; split: boolean };
  /** names given to rooms, surfaces and features (generic names are the fallback) */
  names: Names;
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  kerfMm: 3,
  trimMm: 0,
  minOffcutCm: 10,
  minStripCm: 10,
  guillotine: false,
  allowances: { enabled: false, wall: 10, bend: 5, opening: -3, gap: -5, angleTolerance: false },
  plate: DEFAULT_PLATE,
};
/** Settings that reproduce the original spreadsheet-like artifact exactly. */
export const ARTIFACT_SETTINGS: ProjectSettings = {
  kerfMm: 0, trimMm: 0, minOffcutCm: 0, minStripCm: 10, guillotine: false,
  allowances: { enabled: false, wall: 0, bend: 0, opening: 0, gap: 0, angleTolerance: false },
  plate: ARTIFACT_PLATE,
};

export function newProject(name = 'Okładzina domu'): Project {
  const rooms = {} as Record<RoomId, RoomState>;
  const openings = {} as Record<RoomId, Opening[]>;
  for (const id of ROOM_IDS) { rooms[id] = { on: true, params: { ...ROOMS[id].defaults } }; openings[id] = defaultOpenings(id, rooms[id].params); }
  return {
    version: 1, id: Math.random().toString(36).slice(2, 10), name, updatedAt: Date.now(), settings: structuredClone(DEFAULT_SETTINGS), rooms, openings,
    shared: { band: { len: 1648, h: 65, min: 124, max: 124, use: 1 }, price: 147.6, split: true }, names: emptyNames(),
  };
}

/** The example project: the owner's house with its own room names (Salon, Sypialnia, Łazienka 1, Łazienka 2). */
export function exampleProject(name: string): Project {
  return { ...newProject(name), names: houseNames() };
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && isFinite(v) ? v : d);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Accepts anything that was parsed from a file or a link and returns a valid project, or null. */
export function sanitizeProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== 1 || !r.rooms || typeof r.rooms !== 'object') return null;
  const base = newProject(typeof r.name === 'string' ? r.name.slice(0, 120) : undefined);
  if (typeof r.id === 'string') base.id = r.id.slice(0, 40);
  base.updatedAt = num(r.updatedAt, Date.now());
  const rooms = r.rooms as Record<string, { on?: unknown; params?: Record<string, unknown> }>;
  for (const id of ROOM_IDS) {
    const src = rooms[id];
    if (!src) continue;
    base.rooms[id].on = src.on !== false;
    for (const k of Object.keys(ROOMS[id].defaults)) {
      const v = src.params?.[k];
      if (typeof v === 'number' && isFinite(v)) base.rooms[id].params[k] = v;
    }
  }
  // openings: an older file has none, then the room starts with its default window (the one the old window fields described)
  const ro = r.openings as Record<string, unknown> | undefined;
  for (const id of ROOM_IDS) {
    const list = ro && Array.isArray(ro[id]) ? (ro[id] as unknown[]) : null;
    base.openings[id] = list ? list.flatMap((o): Opening[] => {
      const q = o as Partial<Opening>;
      const ok = q && typeof q.id === 'string' && (q.kind === 'window' || q.kind === 'door' || q.kind === 'cutout') && typeof q.surface === 'number' && Array.isArray(q.pts) && q.pts.length >= 3 && q.pts.length <= 40 && q.pts.every((v) => Array.isArray(v) && isFinite(v[0]) && isFinite(v[1]));
      return ok ? [{ id: q.id!.slice(0, 20), kind: q.kind!, surface: q.surface!, pts: q.pts!.map((v): [number, number] => [v[0], v[1]]), ...(typeof q.name === 'string' && q.name.trim() ? { name: q.name.trim().slice(0, 60) } : {}) }] : [];
    }).slice(0, 6) : defaultOpenings(id, base.rooms[id].params);
  }
  const st = r.settings as Partial<ProjectSettings> | undefined;
  // an older project has no plate model: its rooms hold the plate size. 499 x 125 is the owner's 500 x 125 plate with tongue and groove
  // (covering 499 x 124); any other size is kept as a plain plate, so what the project cut before is what it cuts now.
  const oldPl = Object.values(rooms).map((q) => q.params?.PL).find((v) => typeof v === 'number'), oldPw = Object.values(rooms).map((q) => q.params?.PW).find((v) => typeof v === 'number');
  if (typeof oldPl === 'number' && typeof oldPw === 'number' && !(oldPl === 499 && oldPw === 125)) base.settings.plate = { L: oldPl, W: oldPw, tongue: 0, profile: 'none' };
  const pl = st?.plate as Partial<PlateSpec> | undefined;
  if (pl && typeof pl === 'object') {
    const mode: ProfileMode = pl.profile === 'long' || pl.profile === 'none' ? pl.profile : 'all';
    base.settings.plate = { L: clamp(num(pl.L, 500), 100, 1000), W: clamp(num(pl.W, 125), 20, 300), tongue: clamp(num(pl.tongue, 1), 0, 5), profile: mode };
  }
  if (st) {
    base.settings.kerfMm = Math.max(0, num(st.kerfMm, base.settings.kerfMm));
    base.settings.trimMm = Math.max(0, num(st.trimMm, base.settings.trimMm));
    base.settings.minOffcutCm = Math.max(0, num(st.minOffcutCm, base.settings.minOffcutCm));
    base.settings.minStripCm = Math.max(0, num(st.minStripCm, base.settings.minStripCm));
    base.settings.guillotine = !!st.guillotine;
    const a = st.allowances;
    if (a) base.settings.allowances = { enabled: !!a.enabled, wall: num(a.wall, 0), bend: num(a.bend, 0), opening: num(a.opening, 0), gap: num(a.gap, 0), angleTolerance: !!a.angleTolerance };
  }
  const sh = r.shared as Partial<Project['shared']> | undefined;
  if (sh) {
    const b = sh.band;
    if (b) base.shared.band = { len: num(b.len, 0), h: num(b.h, 65), min: num(b.min, 124), max: num(b.max, 124), use: b.use ? 1 : 0 };
    base.shared.price = num(sh.price, 147.6);
    base.shared.split = sh.split !== false;
  }
  // a project saved before names existed was the owner's house: it keeps the names it showed; a new project is generic
  base.names = sanitizeNames(r.names) ?? houseNames();
  return base;
}

export const cutSettings = (s: ProjectSettings): CutSettings => ({ kerf: s.kerfMm / 10, trim: s.trimMm / 10, minOffcut: s.minOffcutCm, guillotine: s.guillotine, minStrip: s.minStripCm });
export const allowancesCm = (s: ProjectSettings): Allowances => ({
  enabled: s.allowances.enabled, wall: s.allowances.wall / 10, joint: 0, bend: s.allowances.bend / 10, opening: s.allowances.opening / 10, gap: s.allowances.gap / 10,
  angleTolerance: s.allowances.angleTolerance,
});
