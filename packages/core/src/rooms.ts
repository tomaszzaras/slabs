// Registry of the four preset rooms and the two templates behind them.
import { ATTIC_PRESETS, atticModel, atticPieces, normAttic, type AtticModel, type AtticPresetId } from './attic';
import { flatModel, flatPieces, LAZIENKA2, normFlat, type FlatModel } from './flat';
import type { Lang } from './messages';
import type { Opening } from './openings';
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
  return isAttic(m) ? atticPieces(m, openings) : flatPieces(m, openings);
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
  m.surfs.forEach((s) => s.cols.forEach((c) => { if (c.b - c.a < min - 1e-6) out.push({ ref: s.ref, id: c.id, width: c.b - c.a, surface: s.title }); }));
  if (isAttic(m)) m.walls.forEach((w) => w.strips.forEach((c) => { if (c.b - c.a < min - 1e-6) out.push({ ref: w.ref, id: c.id, width: c.b - c.a, surface: w.title }); }));
  return out;
}
