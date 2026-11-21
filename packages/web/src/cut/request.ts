import { isAttic, buildModel, pieceArea, plateCover, withoutProfile, type Lang, ROOMS, ROOM_IDS, roomPieces, type BandSpec, type CutRequest, type PlateSpec, type RoomId, type RoomModel } from '@slabs/core';
import { s } from '../i18n';
import type { Names } from '../state/names';
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
/**
 * Names for the surfaces of a model: the user's name, else the generic name by position ("Połać lewa", "Szczyt przedni"; the
 * features in it carry their own names). The model's own titles stay as they are (artifact wording, parity); the names are what the
 * user sees on drawings, lists and tables.
 */
function withNames(m: RoomModel, id: RoomId, names: Names): RoomModel {
  const f = (k: 'recess' | 'builtIn') => names.features[id]?.[k]?.trim() || s.names.features[k];
  const generic = (key: number, core: string): string => {
    if (!isAttic(m)) return core;
    const n = s.names.surf;
    switch (key) {
      case 1: return n.left;
      case 2: return n.rightAt(f('recess'));
      case 3: return n.right;
      case 4: return n.rightAt(f('builtIn'));
      case 5: return m.preset === 'lazienka-1' ? n.partition : n.wallOf(f('builtIn'));
      case 6: return n.gableFront;
      case 7: return n.gableAt(f('recess'));
      case 8: return n.gableAt(f('builtIn'));
      case 9: return n.gableRear;
      default: return core;
    }
  };
  const label = (key: number, core: string) => names.surfaces[id]?.[String(key)]?.trim() || generic(key, core);
  const surfs = m.surfs.map((q) => ({ ...q, label: label(q.key, q.label ?? q.title) }));
  const walls = isAttic(m) ? m.walls.map((w) => ({ ...w, label: label(w.rid, w.label ?? w.title) })) : undefined;
  const refs = m.refs.map((r) => {
    const q = surfs.find((x) => x.ref === r.id) ?? walls?.find((x) => x.ref === r.id);
    return q?.label ? { ...r, name: q.label } : r;
  });
  return { ...m, surfs, refs, ...(walls ? { walls } : {}) } as RoomModel;
}

/** The generic (position) name of a surface, whatever the user called it. */
export function genericSurfaceName(p: Project, id: RoomId, key: number): string {
  const m = roomModel({ ...p, names: { ...p.names, surfaces: {} } }, id);
  return m.surfs.find((q) => q.key === key)?.label ?? (isAttic(m) ? m.walls.find((w) => w.rid === key)?.label : undefined) ?? '';
}

export const roomModel = (p: Project, id: RoomId, lang: Lang = 'pl', plain = false): RoomModel => {
  const m = withNames(buildModel(id, roomInput(p, id, plain), lang), id, p.names);
  const ops = p.openings[id];
  if (!ops.length) return m;
  const removed = roomPieces(m).reduce((a, q) => a + pieceArea(q), 0) - roomPieces(m, ops).reduce((a, q) => a + pieceArea(q), 0);
  const areaCm2 = m.areaCm2 - removed;
  return { ...m, areaCm2, areaM2: areaCm2 / 1e4, minPlates: Math.ceil(areaCm2 / m.plate) } as RoomModel;
};

/** The band the cut takes: the first one that is switched on (the engine cuts one band); none, or a single room's cut, means no band. */
export function bandSpec(p: Project, only?: RoomId): BandSpec {
  const b = p.bands.find((x) => x.on);
  if (!b || only) return { len: 0, h: b?.h ?? 65, min: b?.min ?? 124, max: b?.max ?? 124, use: b?.use ? 1 : 0 };
  return { len: b.len, h: b.h, min: b.min, max: b.max, use: b.use ? 1 : 0 };
}

/** Request for the shared cut (all rooms that are switched on) or for one room alone. */
export function buildRequest(p: Project, only?: RoomId, plain = false): CutRequest {
  return {
    rooms: ROOM_IDS.map((id) => {
      const m = roomModel(p, id, 'pl', plain);
      return { key: ROOMS[id].key, name: ROOMS[id].name, on: only ? id === only : p.rooms[id].on, PL: m.p.PL!, PW: m.p.PW!, pieces: roomPieces(m, p.openings[id]) };
    }),
    band: bandSpec(p, only),
    splitAtBends: p.settings.splitAtBends,
    seed: 20260,
    maxIters: only ? 400 : 2000,
    timeMs: Infinity, // same input, same plan, on every device
    settings: cutSettings(p.settings),
    allowances: allowancesCm(p.settings),
    price: p.settings.platePrice,
    plate: plateOf(p, plain),
  };
}

export function hashRequest(req: CutRequest): string {
  const s = JSON.stringify(req, (_k, v) => (v === Infinity ? 'inf' : v));
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0) + ':' + s.length;
}
