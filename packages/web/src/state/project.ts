import { ARTIFACT_PLATE, DEFAULT_PLATE, EXTRA_KEYS, ROOMS, ROOM_IDS, ROOF_KEYS, templateById, buildModel, defaultOpenings, isAttic, isRoomType, legacyOpeningToSheet, roofSheet, sanitizeSplits, underRoof, type AddTemplateId, type RoofKey, type RoofSpec, type RoofSplits, type PlateSpec, type ProfileMode, type Allowances, type Opening, type BandSpec, type CutSettings, type RoomType } from '@slabs/core';

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
  /** price of a plate per m², zł (project-wide: one plate for every room) */
  platePrice: number;
  /** cut the pieces of a room at its bends (roof/wall, ceiling/wall) */
  splitAtBends: boolean;
}

/** The band (opaska) around the rooms: an item of the project, listed next to the rooms. One for now, the list is ready for more. */
export interface BandItem {
  id: string;
  /** given name; empty = the generic "Opaska" */
  name?: string;
  /** part of the cut (like a room that is switched on) */
  on: boolean;
  len: number;
  h: number;
  min: number;
  max: number;
  /** cut it from offcuts of the plates first (1) or only from new plates (0) */
  use: number;
}
export const DEFAULT_BAND: Omit<BandItem, 'id'> = { on: true, len: 1648, h: 65, min: 124, max: 124, use: 1 };
import { emptyNames, houseNames, sanitizeNames, type Names } from './names';

/** The id of a room in a project (an instance: the same type can exist several times). The house's own four rooms keep the ids salon, sypialnia, lazienka-1, lazienka-2. */
export type RoomRef = string;
/** Version of the project file (.slabs.json, share link, online copy). 1: four fixed rooms; 2: a list of rooms with ids of their own, the house roof. */
export const FILE_VERSION = 2;
export const MAX_ROOMS = 40;
const ID_OK = (id: string) => /^[A-Za-z0-9_-]{1,20}$/.test(id) && id !== 'przeglad' && !id.startsWith('band-');

export interface RoomState {
  type: RoomType;
  on: boolean;
  /** template the room was made from (the starting values; shown on the overview) */
  tpl?: AddTemplateId;
  params: Record<string, number>;
  /**
   * Roof fields of this room that differ from the house roof (`Project.roof`). The other roof fields of a room under the roof always
   * hold the project's value (kept in step by `syncRoof`), so a model reads its inputs from `params` alone.
   */
  over?: RoofKey[];
}
export interface Project {
  version: typeof FILE_VERSION;
  id: string;
  name: string;
  updatedAt: number;
  settings: ProjectSettings;
  /** "Dach domu": house width, roof angle, knee-wall height (the ridge is in the middle). Project default of the rooms under the roof */
  roof: RoofSpec;
  /** the rooms in the user's order (ids into `rooms`) */
  roomOrder: RoomRef[];
  rooms: Record<RoomRef, RoomState>;
  /** windows, doors and cut-outs per room (cut out of the pieces) */
  openings: Record<RoomRef, Opening[]>;
  /** bands (one for now) */
  bands: BandItem[];
  /** names given to rooms, surfaces and features (generic names are the fallback) */
  names: Names;
  /** where the roof sheet of each attic room is split: choices per fold line / strip, cross-cuts (see core `RoofSplits`) */
  splits: Record<RoomRef, RoofSplits>;
  /** one-time note after an older project was moved to the roof sheet: the start offsets that could not be kept (dismissed by the user) */
  migration?: MigrationNote;
}

export const DEFAULT_ROOF: RoofSpec = { W: ROOMS.salon.defaults.W!, ang: ROOMS.salon.defaults.ang!, HL: ROOMS.salon.defaults.HL! };
/** Limits of the roof fields (the models clamp to the same values). */
export const ROOF_LIMITS: Record<RoofKey, [number, number]> = { W: [200, 1200], ang: [10, 70], HL: [0, 300] };

/** Start values of a room: its type's defaults, the template's changes, the house roof. */
export function roomDefaults(type: RoomType, tplParams: Record<string, number> = {}, roof: RoofSpec = DEFAULT_ROOF): Record<string, number> {
  const d = { ...ROOMS[type].defaults, ...tplParams };
  if (underRoof(type)) for (const k of ROOF_KEYS) d[k] = roof[k];
  return d;
}
/** Roof fields of the rooms under the roof follow the house roof unless the room overrides them. */
export function syncRoof(p: Project): Project {
  let changed = false;
  const rooms: Project['rooms'] = {};
  for (const id of p.roomOrder) {
    const r = p.rooms[id]!;
    if (!underRoof(r.type)) { rooms[id] = r; continue; }
    const params = { ...r.params };
    for (const k of ROOF_KEYS) if (!r.over?.includes(k)) params[k] = p.roof[k];
    const same = ROOF_KEYS.every((k) => params[k] === r.params[k]);
    if (!same) changed = true;
    rooms[id] = same ? r : { ...r, params };
  }
  return changed ? { ...p, rooms } : p;
}
/** The id of a new room: r1, r2 ... the first one not taken. */
export function newRoomId(p: Pick<Project, 'rooms'>): RoomRef {
  let n = 1;
  for (const id of Object.keys(p.rooms)) { const m = /^r(\d+)$/.exec(id); if (m) n = Math.max(n, Number(m[1]) + 1); }
  return 'r' + n;
}
export const roomList = (p: Project): Array<RoomState & { id: RoomRef }> => p.roomOrder.map((id) => ({ ...p.rooms[id]!, id }));

export interface MigrationNote { dropped: Array<{ room: RoomRef; name: string; cm: number }>; renamed: number }

export const DEFAULT_SETTINGS: ProjectSettings = {
  kerfMm: 3,
  trimMm: 0,
  minOffcutCm: 10,
  minStripCm: 10,
  guillotine: false,
  allowances: { enabled: false, wall: 10, bend: 5, opening: -3, gap: -5, angleTolerance: false },
  plate: DEFAULT_PLATE,
  platePrice: 147.6,
  splitAtBends: true,
};
/** Settings that reproduce the original spreadsheet-like artifact exactly. */
export const ARTIFACT_SETTINGS: ProjectSettings = {
  kerfMm: 0, trimMm: 0, minOffcutCm: 0, minStripCm: 10, guillotine: false,
  allowances: { enabled: false, wall: 0, bend: 0, opening: 0, gap: 0, angleTolerance: false },
  plate: ARTIFACT_PLATE,
  platePrice: 147.6,
  splitAtBends: true,
};

const freshId = () => Math.random().toString(36).slice(2, 10);

/** A project without rooms and bands: what "Nowy projekt" opens (the overview then shows the three steps). */
export function blankProject(name = 'Okładzina domu'): Project {
  return { version: FILE_VERSION, id: freshId(), name, updatedAt: Date.now(), settings: structuredClone(DEFAULT_SETTINGS), roof: { ...DEFAULT_ROOF }, roomOrder: [], rooms: {}, openings: {}, bands: [], names: emptyNames(), splits: {} };
}

/** The owner's house with its four rooms and the band (the default content of the first versions; `exampleProject` also names them). */
export function newProject(name = 'Okładzina domu'): Project {
  const rooms: Project['rooms'] = {}, openings: Project['openings'] = {};
  for (const id of ROOM_IDS) { rooms[id] = { type: id, on: true, params: roomDefaults(id) }; openings[id] = defaultOpenings(id, rooms[id].params); }
  return { ...blankProject(name), roomOrder: [...ROOM_IDS], rooms, openings, bands: [{ id: 'b1', ...DEFAULT_BAND }], splits: Object.fromEntries(ROOM_IDS.map((id) => [id, {}])) };
}

/** The example project: the owner's house with its own room names (Salon, Sypialnia, Łazienka 1, Łazienka 2). */
export function exampleProject(name: string): Project {
  return { ...newProject(name), names: houseNames() };
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && isFinite(v) ? v : d);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Accepts anything that was parsed from a file or a link and returns a valid project of the current version, or null.
 * Every older file format is moved up here (one place for local storage, files, share links and the online copy):
 *  - version 1: four rooms with fixed keys (salon, sypialnia, lazienka-1, lazienka-2) in `rooms`; they become the first four rooms of the list,
 *    keep their ids, names, settings and results; the house roof is taken from the first room under the roof, rooms that differ override it.
 *    (Version-1 files of even older builds lack openings, names, plate, bands or splits: those fall back as before, see below.)
 *  - version 2: the list (`roomOrder` + `rooms` with a `type` each), `roof`.
 */
export function sanitizeProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const v1 = r.version === 1;
  if ((!v1 && r.version !== FILE_VERSION) || !r.rooms || typeof r.rooms !== 'object') return null;
  const base = blankProject(typeof r.name === 'string' ? r.name.slice(0, 120) : undefined);
  if (typeof r.id === 'string') base.id = r.id.slice(0, 40);
  base.updatedAt = num(r.updatedAt, Date.now());
  const rooms = r.rooms as Record<string, { type?: unknown; on?: unknown; params?: Record<string, unknown>; over?: unknown; tpl?: unknown }>;

  // ---- the room list
  let ids: string[];
  if (v1) ids = [...ROOM_IDS];
  else {
    const listed = Array.isArray(r.roomOrder) ? (r.roomOrder as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    ids = [...new Set([...listed, ...Object.keys(rooms)])].filter((id) => ID_OK(id) && rooms[id] && typeof rooms[id] === 'object' && isRoomType(rooms[id]!.type)).slice(0, MAX_ROOMS);
  }
  const rawRoof = r.roof as Partial<Record<RoofKey, unknown>> | undefined;
  for (const id of ids) {
    const src = rooms[id];
    const type = (v1 ? id : src?.type) as RoomType;
    const room: RoomState = { type, on: src ? src.on !== false : true, params: { ...ROOMS[type].defaults } };
    for (const k of [...Object.keys(ROOMS[type].defaults), ...(EXTRA_KEYS[type] ?? [])]) {
      const v = src?.params?.[k];
      if (typeof v === 'number' && isFinite(v)) room.params[k] = v;
    }
    if (!v1 && typeof src?.tpl === 'string' && ['under-roof', 'sloped', 'flat'].includes(src.tpl)) room.tpl = src.tpl as AddTemplateId;
    if (!v1 && Array.isArray(src?.over) && underRoof(type)) { const o = ROOF_KEYS.filter((k) => (src!.over as unknown[]).includes(k)); if (o.length) room.over = o; }
    base.rooms[id] = room;
    base.roomOrder.push(id);
  }
  // the house roof: stored (v2) or taken from the first room under the roof (v1); in v1 a room whose roof fields differ overrides them
  const firstRoof = base.roomOrder.map((id) => base.rooms[id]!).find((x) => underRoof(x.type));
  for (const k of ROOF_KEYS) base.roof[k] = num(rawRoof?.[k], firstRoof ? firstRoof.params[k]! : DEFAULT_ROOF[k]); // not clamped: the models clamp and report it, as for any typed value
  if (v1) for (const id of base.roomOrder) {
    const room = base.rooms[id]!;
    if (!underRoof(room.type)) continue;
    const o = ROOF_KEYS.filter((k) => room.params[k] !== base.roof[k]);
    if (o.length) room.over = o;
  }
  const synced = syncRoof(base);
  base.rooms = synced.rooms;

  // ---- openings: an older file has none, then a room starts with its default window (the one the old window fields described)
  const ro = r.openings as Record<string, unknown> | undefined;
  for (const id of base.roomOrder) {
    const list = ro && Array.isArray(ro[id]) ? (ro[id] as unknown[]) : null;
    base.openings[id] = list ? list.flatMap((o): Opening[] => {
      const q = o as Partial<Opening>;
      const ok = q && typeof q.id === 'string' && (q.kind === 'window' || q.kind === 'door' || q.kind === 'cutout') && typeof q.surface === 'number' && Array.isArray(q.pts) && q.pts.length >= 3 && q.pts.length <= 40 && q.pts.every((v) => Array.isArray(v) && isFinite(v[0]) && isFinite(v[1]));
      return ok ? [{ id: q.id!.slice(0, 20), kind: q.kind!, surface: q.surface!, pts: q.pts!.map((v): [number, number] => [v[0], v[1]]), ...(typeof q.name === 'string' && q.name.trim() ? { name: q.name.trim().slice(0, 60) } : {}) }] : [];
    }).slice(0, 6) : v1 ? defaultOpenings(base.rooms[id]!.type, base.rooms[id]!.params) : [];
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
  // price and "split at bends" were project-wide values stored beside the band; now they are project settings
  const sh = r.shared as { band?: Partial<BandSpec>; price?: unknown; split?: unknown } | undefined;
  base.settings.platePrice = Math.max(0, num(st?.platePrice, num(sh?.price, base.settings.platePrice)));
  base.settings.splitAtBends = typeof st?.splitAtBends === 'boolean' ? st.splitAtBends : sh?.split !== false;
  // the band was part of `shared` (one per project, no name, on whenever it had a length); now an item of the project
  const rawBands: unknown[] | null = Array.isArray(r.bands) ? r.bands : sh?.band ? [{ ...sh.band, id: 'b1', on: true }] : null;
  if (rawBands) {
    const seen = new Set<string>();
    base.bands = rawBands.slice(0, 8).flatMap((x, i): BandItem[] => {
      if (!x || typeof x !== 'object') return [];
      const b = x as Partial<BandItem>;
      let id = typeof b.id === 'string' && b.id ? b.id.slice(0, 20) : 'b' + (i + 1);
      while (seen.has(id)) id += 'x';
      seen.add(id);
      return [{ id, on: b.on !== false, len: Math.max(0, num(b.len, 0)), h: num(b.h, 65), min: num(b.min, 124), max: num(b.max, 124), use: b.use ? 1 : 0, ...(typeof b.name === 'string' && b.name.trim() ? { name: b.name.trim().slice(0, 60) } : {}) }];
    });
  } else if (v1) base.bands = [{ id: 'b1', ...DEFAULT_BAND }]; // a version-1 file without a band had the default one
  // a project saved before names existed was the owner's house: it keeps the names it showed; a new project is generic
  base.names = sanitizeNames(r.names, base.roomOrder) ?? (v1 ? houseNames() : emptyNames());
  // roof sheet: a project saved before it has no `splits`. Its rooms had one start offset per roof segment (o1..o5); the sheet has one
  // (o1, the default start ZO + o1), the others are dropped and listed once. Openings drawn on a roof segment move onto the sheet.
  const rs = r.splits as Record<string, unknown> | undefined;
  if (rs && typeof rs === 'object') {
    for (const id of base.roomOrder) base.splits[id] = sanitizeSplits(rs[id]);
    const mg = r.migration as { dropped?: unknown; renamed?: unknown } | undefined;
    if (mg && typeof mg === 'object' && Array.isArray(mg.dropped)) {
      const dropped = mg.dropped.flatMap((d): MigrationNote['dropped'] => {
        const q = d as Partial<MigrationNote['dropped'][number]>;
        return q && typeof q.room === 'string' && base.rooms[q.room] && typeof q.name === 'string' && typeof q.cm === 'number' && isFinite(q.cm) ? [{ room: q.room, name: q.name.slice(0, 80), cm: q.cm }] : [];
      }).slice(0, 20);
      const renamed = typeof mg.renamed === 'number' && isFinite(mg.renamed) ? Math.max(0, Math.min(20, Math.round(mg.renamed))) : 0;
      if (dropped.length || renamed) base.migration = { dropped, renamed };
    }
  } else {
    const dropped: NonNullable<Project['migration']>['dropped'] = [];
    let renamed = 0;
    for (const id of base.roomOrder) {
      base.splits[id] = {};
      const room = base.rooms[id]!;
      if (ROOMS[room.type].template !== 'attic-gable') continue;
      const params = room.params;
      for (let i = 2; i <= 5; i++) {
        const v = params['o' + i] ?? 0;
        if (v) dropped.push({ room: id, name: ROOMS[room.type].shiftNames[i - 1] ?? 'R' + i, cm: v });
        params['o' + i] = 0;
      }
      if (base.names.surfaces[id]) { for (const k of ['1', '2', '3', '4', '5']) if (base.names.surfaces[id]![k]) { delete base.names.surfaces[id]![k]; renamed++; } }
      if (base.openings[id]!.some((o) => o.surface >= 1 && o.surface <= 5)) {
        const m = buildModel(room.type, { ...params, o2: params.o1 ?? 0, o3: params.o1 ?? 0, o4: params.o1 ?? 0, o5: params.o1 ?? 0 });
        if (isAttic(m)) {
          const sheet = roofSheet(m, { splits: {}, splitAtBends: base.settings.splitAtBends });
          base.openings[id] = base.openings[id]!.map((o) => legacyOpeningToSheet(sheet, o));
        }
      }
    }
    if (dropped.length || renamed) base.migration = { dropped, renamed };
  }
  return base;
}

export const cutSettings = (s: ProjectSettings): CutSettings => ({ kerf: s.kerfMm / 10, trim: s.trimMm / 10, minOffcut: s.minOffcutCm, guillotine: s.guillotine, minStrip: s.minStripCm });
export const allowancesCm = (s: ProjectSettings): Allowances => ({
  enabled: s.allowances.enabled, wall: s.allowances.wall / 10, joint: 0, bend: s.allowances.bend / 10, opening: s.allowances.opening / 10, gap: s.allowances.gap / 10,
  angleTolerance: s.allowances.angleTolerance,
});

/** Has the user entered anything in this room beyond its start values (dimensions, openings, splits, names of surfaces)? Decides whether deleting asks first. */
export function roomHasData(p: Project, id: RoomRef): boolean {
  const r = p.rooms[id];
  if (!r) return false;
  const base = roomDefaults(r.type, r.tpl ? templateById(r.tpl).params : {}, p.roof);
  if (Object.keys({ ...base, ...r.params }).some((k) => (r.params[k] ?? base[k]) !== base[k])) return true;
  const initial = r.tpl ? [] : defaultOpenings(r.type, base);
  if (JSON.stringify(p.openings[id] ?? []) !== JSON.stringify(initial)) return true;
  if (Object.keys(p.splits[id] ?? {}).length > 0) return true;
  return Object.keys(p.names.surfaces[id] ?? {}).length > 0 || Object.keys(p.names.features[id] ?? {}).length > 0;
}
