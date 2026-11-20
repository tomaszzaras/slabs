import { buildModel, pieceArea, plateCover, withoutProfile, type Lang, ROOMS, ROOM_IDS, roomPieces, type CutRequest, type PlateSpec, type RoomId, type RoomModel } from '@slabs/core';
import { allowancesCm, cutSettings, type Project } from '../state/project';

/** The plate the project is cut from; `plain` = the same physical plate without the profile (for the comparison). */
export const plateOf = (p: Project, plain = false): PlateSpec => (plain ? withoutProfile(p.settings.plate) : p.settings.plate);

/**
 * Room parameters as the models take them: the plate is the project's (rooms are planned in covering sizes, 499 x 124 for a
 * 500 x 125 plate with a 1 cm tongue), the edge trim narrows the usable board only where the plate edge has no profile.
 */
export const roomInput = (p: Project, id: RoomId, plain = false): Record<string, number> => {
  const plate = plateOf(p, plain), cv = plateCover(plate), trim = p.settings.trimMm / 10;
  return { ...p.rooms[id].params, PL: cv.L, PW: cv.W, trim: cv.long ? 0 : trim, trimL: cv.end ? 0 : trim, pf: plate.profile === 'all' ? 2 : plate.profile === 'long' ? 1 : 0, winOn: 0 };
};

/** The room's model. The window is an opening of the project (not the old fixed window), and the net area leaves every opening out. */
export const roomModel = (p: Project, id: RoomId, lang: Lang = 'pl', plain = false): RoomModel => {
  const m = buildModel(id, roomInput(p, id, plain), lang);
  const ops = p.openings[id];
  if (!ops.length) return m;
  const removed = roomPieces(m).reduce((a, q) => a + pieceArea(q), 0) - roomPieces(m, ops).reduce((a, q) => a + pieceArea(q), 0);
  const areaCm2 = m.areaCm2 - removed;
  return { ...m, areaCm2, areaM2: areaCm2 / 1e4, minPlates: Math.ceil(areaCm2 / m.plate) } as RoomModel;
};

/** Request for the shared cut (all rooms that are switched on) or for one room alone. */
export function buildRequest(p: Project, only?: RoomId, plain = false): CutRequest {
  return {
    rooms: ROOM_IDS.map((id) => {
      const m = roomModel(p, id, 'pl', plain);
      return { key: ROOMS[id].key, name: ROOMS[id].name, on: only ? id === only : p.rooms[id].on, PL: m.p.PL!, PW: m.p.PW!, pieces: roomPieces(m, p.openings[id]) };
    }),
    band: only ? { ...p.shared.band, len: 0 } : p.shared.band,
    splitAtBends: p.shared.split,
    seed: 20260,
    maxIters: only ? 400 : 2000,
    timeMs: Infinity, // same input, same plan, on every device
    settings: cutSettings(p.settings),
    allowances: allowancesCm(p.settings),
    price: p.shared.price,
    plate: plateOf(p, plain),
  };
}

export function hashRequest(req: CutRequest): string {
  const s = JSON.stringify(req, (_k, v) => (v === Infinity ? 'inf' : v));
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0) + ':' + s.length;
}
