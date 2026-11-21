// Names the user gave to rooms, surfaces and features. Everything is optional: the generic name (see i18n `s.names`) is the fallback.
import { ROOM_IDS, type RoomId } from '@slabs/core';

export type FeatureKey = 'recess' | 'builtIn' | 'niche' | 'endCut';
export const FEATURE_KEYS: FeatureKey[] = ['recess', 'builtIn', 'niche', 'endCut'];
/** which dimension fields belong to which feature (their label starts with the feature's name) */
export const FEATURE_OF_FIELD: Record<string, FeatureKey> = { dA: 'recess', ZA: 'recess', wB: 'builtIn', dB: 'builtIn', niche: 'niche', cutOn: 'endCut', cutH: 'endCut' };

export interface Names {
  rooms: Partial<Record<RoomId, string>>;
  /** by surface number (R key of the surface: 1..5 boards, 6..9 gables) */
  surfaces: Partial<Record<RoomId, Record<string, string>>>;
  features: Partial<Record<RoomId, Partial<Record<FeatureKey, string>>>>;
}
export const emptyNames = (): Names => ({ rooms: {}, surfaces: {}, features: {} });

/** The owner's house: the names that were fixed in the first version. */
export const houseNames = (): Names => ({ rooms: { salon: 'Salon', sypialnia: 'Sypialnia', 'lazienka-1': 'Łazienka 1', 'lazienka-2': 'Łazienka 2' }, surfaces: {}, features: {} });

const clean = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 60) : null);

/** Accepts anything from a file or link. Returns null when the project has no names at all (an older project). */
export function sanitizeNames(raw: unknown): Names | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const out = emptyNames();
  const rooms = (r.rooms ?? {}) as Record<string, unknown>;
  const surfaces = (r.surfaces ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const features = (r.features ?? {}) as Record<string, Record<string, unknown> | undefined>;
  for (const id of ROOM_IDS) {
    const n = clean(rooms[id]);
    if (n) out.rooms[id] = n;
    const sf = surfaces[id];
    if (sf && typeof sf === 'object') {
      const m: Record<string, string> = {};
      for (const k of Object.keys(sf)) { const v = clean(sf[k]); if (v && /^\d{1,2}$/.test(k)) m[k] = v; }
      if (Object.keys(m).length) out.surfaces[id] = m;
    }
    const ft = features[id];
    if (ft && typeof ft === 'object') {
      const m: Partial<Record<FeatureKey, string>> = {};
      for (const k of FEATURE_KEYS) { const v = clean(ft[k]); if (v) m[k] = v; }
      if (Object.keys(m).length) out.features[id] = m;
    }
  }
  return out;
}

/** Prefix written on the pieces of a room: the generic names get P1..P4 (R1.. in English), custom names their initials (S, Sy, Ł1, Ł2 for the house). */
export function roomPrefixes(names: Names, generic: (id: RoomId) => string): Record<RoomId, string> {
  const out = {} as Record<RoomId, string>;
  const used = new Set<string>();
  const initial = (name: string, len: number) => {
    const m = name.trim().match(/^(\p{L}+)\s*(\d+)?/u);
    const word = m?.[1] ?? name.trim();
    const head = word.slice(0, len);
    return head.charAt(0).toLocaleUpperCase() + head.slice(1).toLocaleLowerCase() + (m?.[2] ?? '');
  };
  for (const id of ROOM_IDS) {
    const custom = names.rooms[id];
    let p = custom ? initial(custom, 1) : generic(id);
    for (let len = 2; custom && used.has(p) && len <= 4; len++) p = initial(custom, len);
    while (used.has(p)) p += "'";
    used.add(p);
    out[id] = p;
  }
  return out;
}
