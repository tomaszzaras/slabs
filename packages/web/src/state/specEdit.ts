// Edits of a room's spec (pure functions). The drawings still address a measurement by the preset engine's input name (HL, L, hb, o3 ...);
// `applyParam` turns such an edit into a change of the room's spec (or of the room's roof override).
import { ROOF_KEYS, notch, surfaceKeys, type Finish, type Notch, type NotchKind, type RoofKey, type RoomSpec, type SurfCfg } from '@slabs/core';
import { ROOF_LIMITS, roomRoof, type Project, type RoomRef } from './project';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function setNotch(s: RoomSpec, kind: NotchKind, n: Partial<Notch> | null): RoomSpec {
  const rest = s.notches.filter((x) => x.kind !== kind);
  if (!n) return { ...s, notches: rest };
  const cur = s.notches.find((x) => x.kind === kind) ?? { kind, a: 0, b: 0 };
  const order: NotchKind[] = ['corner', 'recess', 'offset'];
  return { ...s, notches: [...rest, { ...cur, ...n, kind }].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)) };
}

/** Sets or clears (null) the direction / finish of one surface. A cfg equal to the default is not stored. */
export function setSurf(s: RoomSpec, key: number, patch: Partial<SurfCfg> | { dir: undefined } | { finish: undefined }): RoomSpec {
  const cur = { ...(s.surf[String(key)] ?? {}), ...patch } as SurfCfg;
  if (cur.dir === undefined) delete cur.dir;
  if (cur.finish === undefined || cur.finish.kind === 'wood') delete cur.finish;
  const surf = { ...s.surf };
  if (cur.dir === undefined && cur.finish === undefined) delete surf[String(key)]; else surf[String(key)] = cur;
  return { ...s, surf };
}

/** The wall keys of a room (everything but the roof / ceiling). */
export const wallKeys = (s: RoomSpec): number[] => surfaceKeys(s).filter((k) => k >= 2);
/** All walls: wood up to `h` (from the floor) or the `h` below the ceiling (flat ceiling only). Other surfaces are unchanged. */
export function allWallsWood(s: RoomSpec, h: number, from: 'floor' | 'ceiling'): RoomSpec {
  let out = s;
  const H = s.ceiling.kind === 'flat' ? s.ceiling.h : null;
  const fin: Finish = from === 'ceiling' && H !== null ? { kind: 'split', at: Math.max(0, H - h), wood: 'above' } : { kind: 'split', at: h, wood: 'below' };
  const keys = s.ceiling.kind === 'flat' ? [2, 3, 4, 5] : wallKeys(s);
  for (const k of keys) out = setSurf(out, k, { finish: fin });
  return out;
}

/** Changes the height of a flat room: the wood zones that hang from the ceiling keep their height. */
function withHeight(s: RoomSpec, h: number): RoomSpec {
  if (s.ceiling.kind !== 'flat') return s;
  const dH = h - s.ceiling.h;
  const surf = { ...s.surf };
  for (const k of Object.keys(surf)) {
    const f = surf[k]!.finish;
    if (f && f.kind === 'split' && f.wood === 'above') surf[k] = { ...surf[k]!, finish: { ...f, at: Math.max(0, f.at + dH) } };
  }
  return { ...s, ceiling: { kind: 'flat', h }, surf };
}

/** Edit of one input of the preset engine, as a change of the project. Unknown or not applicable keys leave the project as it is. */
export function applyParam(p: Project, room: RoomRef, key: string, value: number): Project {
  const r = p.rooms[room];
  if (!r) return p;
  let s = r.spec;
  let roof = r.roof;
  if ((ROOF_KEYS as readonly string[]).includes(key)) {
    const k = key as RoofKey;
    const o = { ...(roof ?? {}) };
    if (value === p.roof[k]) delete o[k]; else o[k] = value;
    roof = Object.keys(o).length ? o : undefined;
  } else if (/^o\d$/.test(key) || key === 'ZO' || key === 'XO') {
    const starts = { ...s.starts };
    if (/^o\d$/.test(key) && value === 0) delete starts[key]; else starts[key] = value;
    s = { ...s, starts };
  } else if (key === 'L' || key === 'bz') s = { ...s, l: value };
  else if (key === 'Wb' || key === 'bw' || key === 'bx') s = { ...s, w: value };
  else if (key === 'niche') s = setNotch(s, 'offset', value > 0 ? { a: value, b: 0 } : null);
  else if (key === 'dA') s = setNotch(s, 'recess', { a: value });
  else if (key === 'ZA') s = setNotch(s, 'recess', { b: value });
  else if (key === 'wB') s = setNotch(s, 'corner', { a: value });
  else if (key === 'dB') s = setNotch(s, 'corner', { b: value });
  else if (key === 'cutH') s = setSurf(s, 9, { finish: { kind: 'split', at: value, wood: 'above' } });
  else if (key === 'capH' && s.ceiling.kind === 'roof') s = { ...s, ceiling: { kind: 'roof', cap: value } };
  else if (key === 'H') s = withHeight(s, value);
  else if (key === 'hb' && s.ceiling.kind === 'flat') {
    const at = Math.max(0, s.ceiling.h - value);
    for (const k of [2, 3, 4, 5]) s = setSurf(s, k, { finish: { kind: 'split', at, wood: 'above' } });
  } else return p;
  if (s === r.spec && roof === r.roof) return p;
  const { roof: _old, ...rest } = r;
  return { ...p, rooms: { ...p.rooms, [room]: { ...rest, spec: s, ...(roof ? { roof } : {}) } } };
}

/** The roof as a room has it, limited to what the models take (for the form). */
export const roofLimits = (k: RoofKey): [number, number] => ROOF_LIMITS[k];
export const effectiveRoof = roomRoof;
export { notch, clamp };
