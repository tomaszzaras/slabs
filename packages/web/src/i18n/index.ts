import { ROOMS, tr, type Lang, type RoomId } from '@slabs/core';
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
  try { localStorage.setItem('slabs-lang', l); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

/** Number in the current locale (decimal comma in Polish). */
export const nf = (n: number, digits = 0): string => new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);

/** Room names and room texts in the current language. */
export const roomName = (id: RoomId): string => tr(lang, ROOMS[id].name);
export const roomNameByKey = (key: string): string => { const id = (Object.keys(ROOMS) as RoomId[]).find((i) => ROOMS[i].key === key); return id ? roomName(id) : key; };
export const T_ = (plText: string): string => tr(lang, plText);
