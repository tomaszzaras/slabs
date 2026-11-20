// Registry of the four preset rooms and the two templates behind them.
import { ATTIC_PRESETS, atticModel, atticPieces, normAttic, type AtticModel, type AtticPresetId } from './attic';
import { flatModel, flatPieces, LAZIENKA2, normFlat, type FlatModel } from './flat';
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

export function normalize(id: RoomId, pin: Record<string, unknown> | null | undefined): { p: Params; w: string[] } {
  return id === 'lazienka-2' ? normFlat(pin) : normAttic(ATTIC_PRESETS[id], pin);
}

export function buildModel(id: RoomId, pin: Record<string, unknown> | null | undefined): RoomModel {
  return id === 'lazienka-2' ? flatModel(pin) : atticModel(ATTIC_PRESETS[id], pin);
}

export function roomPieces(m: RoomModel): Piece[] {
  return isAttic(m) ? atticPieces(m) : flatPieces(m);
}

/** The artifact's per-room shelf packer (parity only). */
export function shelfPlan(m: RoomModel): ShelfPlate[] {
  return packShelf(roomPieces(m), m.p.PL!, m.p.PW!);
}
