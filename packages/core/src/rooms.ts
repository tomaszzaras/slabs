// Registry of the four preset rooms and the two templates behind them.
import { ATTIC_PRESETS, atticModel, atticPieces, normAttic, type AtticModel, type AtticPresetId } from './attic';
import { flatModel, flatPieces, LAZIENKA2, normFlat, type FlatModel } from './flat';
import type { Lang } from './messages';
import { applyOpenings, type Opening } from './openings';
import { packShelf, type ShelfPlate } from './shelf';
import type { FieldDef, Piece } from './types';
import type { Params } from './util';

export type RoomId = AtticPresetId | 'lazienka-2';
export type TemplateId = 'attic-gable' | 'flat-ceiling';
export type RoomModel = AtticModel | FlatModel;

export interface RoomDef {
  id: RoomId;
  template: TemplateId;
  /** key used in the shared cut (S, Sy, Ł1, Ł2) */
  key: string;
  name: string;
  defaults: Params;
  fields: FieldDef[];
  shiftNames: string[];
}

export const ROOM_IDS: RoomId[] = ['salon', 'sypialnia', 'lazienka-1', 'lazienka-2'];

/**
 * `RoomId` names a room *type* (the model behind it: a preset or template). A project holds room *instances* with ids of their own (a
 * room can exist several times); the four ids above are also the instance ids of the owner's house, so its files keep their keys.
 */
export type RoomType = RoomId;
export const ROOM_TYPES: RoomType[] = ROOM_IDS;
export const isRoomType = (v: unknown): v is RoomType => typeof v === 'string' && (ROOM_IDS as string[]).includes(v);

/** Numeric inputs a room type takes beyond its defaults (the "under the roof" template switches the salon's notches off). */
export const EXTRA_KEYS: Partial<Record<RoomType, string[]>> = { salon: ['cA', 'cB'] };

/** The roof fields that every room under the house roof shares (project default, overridable per room). */
export const ROOF_KEYS = ['W', 'ang', 'HL'] as const;
export type RoofKey = (typeof ROOF_KEYS)[number];
export type RoofSpec = Record<RoofKey, number>;
export const underRoof = (type: RoomType): boolean => ROOMS[type].template === 'attic-gable';

const LEGACY_PALETTE: Record<string, number> = { salon: 0, sypialnia: 1, 'lazienka-1': 2, 'lazienka-2': 3, S: 0, Sy: 1, 'Ł1': 2, 'Ł2': 3 };
/** Which of the four room patterns/colours a room instance uses: the house's own rooms as before, new rooms (r5, r6 ...) in turn. */
export function paletteIndex(instanceId: string): number {
  const l = LEGACY_PALETTE[instanceId];
  if (l !== undefined) return l;
  const m = /^r(\d+)$/.exec(instanceId);
  if (m) return Number(m[1]) % 4;
  let h = 0;
  for (let i = 0; i < instanceId.length; i++) h = (h * 31 + instanceId.charCodeAt(i)) >>> 0;
  return h % 4;
}
export const PALETTE_KEYS = ['S', 'Sy', 'Ł1', 'Ł2'] as const;
export const paletteKey = (instanceId: string): string => PALETTE_KEYS[paletteIndex(instanceId)]!;

export const ROOMS: Record<RoomId, RoomDef> = {
  salon: { id: 'salon', template: 'attic-gable', key: 'S', name: 'Salon', defaults: ATTIC_PRESETS.salon.defaults, fields: ATTIC_PRESETS.salon.fields, shiftNames: ATTIC_PRESETS.salon.shiftNames },
  sypialnia: { id: 'sypialnia', template: 'attic-gable', key: 'Sy', name: 'Sypialnia', defaults: ATTIC_PRESETS.sypialnia.defaults, fields: ATTIC_PRESETS.sypialnia.fields, shiftNames: ATTIC_PRESETS.sypialnia.shiftNames },
  'lazienka-1': { id: 'lazienka-1', template: 'attic-gable', key: 'Ł1', name: 'Łazienka 1', defaults: ATTIC_PRESETS['lazienka-1'].defaults, fields: ATTIC_PRESETS['lazienka-1'].fields, shiftNames: ATTIC_PRESETS['lazienka-1'].shiftNames },
  'lazienka-2': { id: 'lazienka-2', template: 'flat-ceiling', key: 'Ł2', name: 'Łazienka 2', defaults: LAZIENKA2.defaults, fields: LAZIENKA2.fields, shiftNames: LAZIENKA2.shiftNames },
};

export const isAttic = (m: RoomModel): m is AtticModel => 'walls' in m;

export function normalize(id: RoomId, pin: Record<string, unknown> | null | undefined, lang: Lang = 'pl'): { p: Params; w: string[] } {
  return id === 'lazienka-2' ? normFlat(pin, lang) : normAttic(ATTIC_PRESETS[id], pin, lang);
}

export function buildModel(id: RoomId, pin: Record<string, unknown> | null | undefined, lang: Lang = 'pl'): RoomModel {
  return id === 'lazienka-2' ? flatModel(pin, lang) : atticModel(ATTIC_PRESETS[id], pin, lang);
}

export function roomPieces(m: RoomModel, openings: Opening[] = []): Piece[] {
  const legacy = isAttic(m) ? atticPieces(m, openings) : flatPieces(m, openings);
  if (!m.faces?.length) return legacy;
  // surfaces drawn as faces replace the preset's own pieces; the faces' boards get the openings cut out like the others
  const off = new Set(m.legacyOff ?? []);
  return [...legacy.filter((p) => !(p.src && off.has(p.src.surf))), ...applyOpenings(m.faces.flatMap((f) => f.plan.pieces), openings)];
}

/** The openings a room starts with: the artifact's fixed window of the salon (same polygon), nothing elsewhere. */
export function defaultOpenings(id: RoomId, params: Record<string, number>): Opening[] {
  if (id !== 'salon') return [];
  const m = buildModel(id, params);
  if (!isAttic(m) || !m.win) return [];
  const wall = m.walls.find((w) => w.z === 0);
  return wall ? [{ id: 'window', kind: 'window', surface: wall.rid, pts: m.win.map((q): [number, number] => [q[0], q[1]]) }] : [];
}

/** The artifact's per-room shelf packer (parity only). */
export function shelfPlan(m: RoomModel): ShelfPlate[] {
  return packShelf(roomPieces(m), m.p.PL!, m.p.PW!);
}

/** One input that the model had to correct: the value as typed, the nearest allowed value, and which side it broke. */
export interface FieldIssue {
  key: string; kind: 'min' | 'max'; value: number; bound: number;
  /** other inputs this bound depends on (e.g. the recess width is limited by the interior width), empty for a fixed limit */
  because: string[];
}

/** Which other inputs move the allowed bound of `key`? Found by perturbing each one and normalising again. */
function boundDependsOn(id: RoomId, pin: Record<string, unknown>, key: string, bound: number): string[] {
  const out: string[] = [];
  for (const j of Object.keys(ROOMS[id].defaults)) {
    if (j === key || /^o\d$/.test(j)) continue;
    const base = Number(pin[j]);
    if (!isFinite(base) || pin[j] === '' || pin[j] === null) continue;
    for (const d of [-37, 37]) {
      const nb = normalize(id, { ...pin, [j]: base + d }).p[key];
      if (nb !== undefined && Math.abs(nb - bound) > 1e-9) { out.push(j); break; }
    }
  }
  return out.slice(0, 2);
}

/** Compares the typed values with the normalised ones. Messages are built by the UI from the field's real name. */
export function fieldIssues(id: RoomId, pin: Record<string, unknown>): FieldIssue[] {
  const n = normalize(id, pin).p;
  const out: FieldIssue[] = [];
  for (const key of Object.keys(ROOMS[id].defaults)) {
    const raw = Number(pin[key]);
    const to = n[key];
    if (to === undefined || !isFinite(raw) || pin[key] === '' || pin[key] === null || pin[key] === undefined) continue;
    if (Math.abs(raw - to) > 1e-9) out.push({ key, kind: raw < to ? 'min' : 'max', value: raw, bound: to, because: boundDependsOn(id, pin, key, to) });
  }
  return out;
}

/** A strip (board column or gable strip) narrower than the set minimum. */
export interface RoomSliver { ref: string; id: number; width: number; surface: string }

export function roomSlivers(m: RoomModel, min: number): RoomSliver[] {
  if (min <= 0) return [];
  const out: RoomSliver[] = [];
  if (isAttic(m) && m.sheet) {
    // one entry per strip: its narrowest piece
    const w = new Map<number, number>();
    m.sheet.pieces.forEach((p) => { const id = p.ids[0]!; w.set(id, Math.min(w.get(id) ?? Infinity, p.w)); });
    w.forEach((width, id) => { if (width < min - 1e-6) out.push({ ref: m.sheet!.ref, id, width, surface: m.refs[0]!.name }); });
  } else m.surfs.forEach((s) => s.cols.forEach((c) => { if (c.b - c.a < min - 1e-6) out.push({ ref: s.ref, id: c.id, width: c.b - c.a, surface: s.title }); }));
  if (isAttic(m)) m.walls.forEach((w) => w.strips.forEach((c) => { if (c.b - c.a < min - 1e-6) out.push({ ref: w.ref, id: c.id, width: c.b - c.a, surface: w.title }); }));
  return out;
}
