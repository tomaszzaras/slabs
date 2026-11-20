import { buildModel, type Lang, ROOMS, ROOM_IDS, roomPieces, type CutRequest, type RoomId, type RoomModel } from '@slabs/core';
import { allowancesCm, cutSettings, type Project } from '../state/project';

/** Room parameters as the models take them: the edge trim narrows the usable board. */
export const roomInput = (p: Project, id: RoomId): Record<string, number> => ({ ...p.rooms[id].params, trim: p.settings.trimMm / 10 });
export const roomModel = (p: Project, id: RoomId, lang: Lang = 'pl'): RoomModel => buildModel(id, roomInput(p, id), lang);

/** Request for the shared cut (all rooms that are switched on) or for one room alone. */
export function buildRequest(p: Project, only?: RoomId): CutRequest {
  return {
    rooms: ROOM_IDS.map((id) => {
      const m = roomModel(p, id);
      return { key: ROOMS[id].key, name: ROOMS[id].name, on: only ? id === only : p.rooms[id].on, PL: m.p.PL!, PW: m.p.PW!, pieces: roomPieces(m) };
    }),
    band: only ? { ...p.shared.band, len: 0 } : p.shared.band,
    splitAtBends: p.shared.split,
    seed: 20260,
    maxIters: only ? 400 : 2000,
    timeMs: Infinity, // same input, same plan, on every device
    settings: cutSettings(p.settings),
    allowances: allowancesCm(p.settings),
    price: p.shared.price,
  };
}

export function hashRequest(req: CutRequest): string {
  const s = JSON.stringify(req, (_k, v) => (v === Infinity ? 'inf' : v));
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0) + ':' + s.length;
}
