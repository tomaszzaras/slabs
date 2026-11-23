import { tr, type Lang } from '@slabs/core';
import { emptyNames, roomPrefixes, type FeatureKey, type Names } from '../state/names';
import { LABELS, type Labels } from '@slabs/render';
import { en } from './en';
import { pl, type Strings } from './pl';

export type { Lang };
export const CATALOGUES: Record<Lang, Strings> = { pl, en };

function initialLang(): Lang {
  try {
    const v = localStorage.getItem('slabs-lang');
    if (v === 'pl' || v === 'en') return v;
  } catch { /* ignore */ }
  try { if (typeof navigator !== 'undefined' && navigator.language && !navigator.language.toLowerCase().startsWith('pl')) return 'en'; } catch { /* ignore */ }
  return 'pl';
}

/** Current language and its strings. ES module live bindings: components read `s` while rendering, and the app re-renders when the language changes. */
export let lang: Lang = initialLang();
export let s: Strings = CATALOGUES[lang];
export let drawingLabels: Labels = LABELS[lang];

export function setLang(l: Lang): void {
  lang = l;
  s = CATALOGUES[l];
  drawingLabels = LABELS[l];
  computePrefixes();
  try { localStorage.setItem('slabs-lang', l); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

/** Number in the current locale (decimal comma in Polish). */
export const nf = (n: number, digits = 0): string => new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);

/** Names the user gave (rooms, surfaces, features) of the open project; the generic names of the current language are the fallback. */
let names: Names = emptyNames();
/** the rooms of the open project in the user's order: the generic name and prefix of a room come from its place in it */
let order: string[] = [];
let prefixes: Record<string, string> = {};
const pos = (id: string): number => { const i = order.indexOf(id); return i < 0 ? order.length : i; };
const genericPrefix = (id: string) => `${lang === 'en' ? 'R' : 'P'}${pos(id) + 1}`;
function computePrefixes() { prefixes = roomPrefixes(names, order, genericPrefix); }
export function setNames(n: Names | undefined, rooms: string[] = order): void { names = n ?? emptyNames(); order = rooms; computePrefixes(); }
computePrefixes();
export const genericRoomName = (id: string): string => s.names.room(pos(id) + 1);
/** What the room is called: the user's name, else "Pomieszczenie 1". */
export const roomName = (id: string): string => names.rooms[id]?.trim() || genericRoomName(id);
/** The key of a room in the cut is its id in the project. */
export const roomNameByKey = (key: string): string => (order.includes(key) ? roomName(key) : key);
/** A band keeps its name on the item itself (rooms keep theirs in `names`); empty = the generic "Opaska". */
export const genericBandName = (): string => s.band.generic;
export const bandName = (b: { name?: string }): string => b.name?.trim() || s.band.generic;
/** Room prefixes written on pieces (P1.. for generic names, initials of a custom name). Computed again when the language changes. */
export const roomPrefix = (key: string): string => prefixes[key] ?? key;
export const featureName = (id: string, f: FeatureKey): string => names.features[id]?.[f]?.trim() || s.names.features[f];
export const surfaceNameOf = (id: string, surface: number, generic: string): string => names.surfaces[id]?.[String(surface)]?.trim() || generic;
export const customSurfaceName = (id: string, surface: number): string => names.surfaces[id]?.[String(surface)] ?? '';
export const T_ = (plText: string): string => tr(lang, plText);
