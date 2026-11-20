import { ROOMS, ROOM_IDS, type Allowances, type BandSpec, type CutSettings, type RoomId } from '@slabs/core';

export interface AllowanceMm { enabled: boolean; wall: number; bend: number; opening: number; gap: number; angleTolerance: boolean }
export interface ProjectSettings {
  kerfMm: number;
  trimMm: number;
  minOffcutCm: number;
  /** strips narrower than this are flagged as slivers, cm */
  minStripCm: number;
  guillotine: boolean;
  allowances: AllowanceMm;
}
export interface RoomState { on: boolean; params: Record<string, number> }
export interface Project {
  version: 1;
  id: string;
  name: string;
  updatedAt: number;
  settings: ProjectSettings;
  rooms: Record<RoomId, RoomState>;
  shared: { band: BandSpec; price: number; split: boolean };
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  kerfMm: 3,
  trimMm: 0,
  minOffcutCm: 10,
  minStripCm: 10,
  guillotine: false,
  allowances: { enabled: false, wall: 10, bend: 5, opening: -3, gap: -5, angleTolerance: false },
};
/** Settings that reproduce the original spreadsheet-like artifact exactly. */
export const ARTIFACT_SETTINGS: ProjectSettings = {
  kerfMm: 0, trimMm: 0, minOffcutCm: 0, minStripCm: 10, guillotine: false,
  allowances: { enabled: false, wall: 0, bend: 0, opening: 0, gap: 0, angleTolerance: false },
};

export function newProject(name = 'Okładzina domu'): Project {
  const rooms = {} as Record<RoomId, RoomState>;
  for (const id of ROOM_IDS) rooms[id] = { on: true, params: { ...ROOMS[id].defaults } };
  return {
    version: 1, id: Math.random().toString(36).slice(2, 10), name, updatedAt: Date.now(), settings: structuredClone(DEFAULT_SETTINGS), rooms,
    shared: { band: { len: 1648, h: 65, min: 124, max: 124, use: 1 }, price: 147.6, split: true },
  };
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && isFinite(v) ? v : d);

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
  const st = r.settings as Partial<ProjectSettings> | undefined;
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
  return base;
}

export const cutSettings = (s: ProjectSettings): CutSettings => ({ kerf: s.kerfMm / 10, trim: s.trimMm / 10, minOffcut: s.minOffcutCm, guillotine: s.guillotine, minStrip: s.minStripCm });
export const allowancesCm = (s: ProjectSettings): Allowances => ({
  enabled: s.allowances.enabled, wall: s.allowances.wall / 10, joint: 0, bend: s.allowances.bend / 10, opening: s.allowances.opening / 10, gap: s.allowances.gap / 10,
  angleTolerance: s.allowances.angleTolerance,
});
