import { describe, expect, it } from 'vitest';
import { EN, ROOMS, ROOM_IDS, buildModel, tr, type Lang } from '@slabs/core';
import { EN_LABELS, PL_LABELS, svgBoards, svgGables, svgPlan } from '@slabs/render';
import { CATALOGUES } from './index';

type Tree = { [k: string]: unknown };
/** Every leaf of the Polish catalogue with its path; functions are called with sample arguments. */
function leaves(t: unknown, path = ''): Array<[string, unknown]> {
  if (Array.isArray(t)) return t.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (t && typeof t === 'object') return Object.entries(t as Tree).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [[path, t]];
}
const get = (t: unknown, path: string) => path.replace(/\[(\d+)\]/g, '.$1').split('.').reduce<unknown>((a, k) => (a as Tree)?.[k], t);
const sample = (fn: (...a: unknown[]) => unknown) => fn(...Array.from({ length: fn.length }, (_v, i) => (i === 0 ? 'x' : 2)));

describe('UI catalogues', () => {
  const pl = CATALOGUES.pl, en = CATALOGUES.en;
  it('English has every key Polish has, and nothing is empty', () => {
    for (const [path, v] of leaves(pl)) {
      const e = get(en, path);
      expect(typeof e, `en.${path} is missing`).toBe(typeof v);
      if (typeof v === 'string') expect((e as string).trim().length, `en.${path} is empty`).toBeGreaterThan(0);
      if (typeof v === 'function') expect(String(sample(e as (...a: unknown[]) => unknown)).length, `en.${path}() is empty`).toBeGreaterThan(0);
    }
    for (const [path] of leaves(en)) expect(get(pl, path), `pl.${path} is missing`).toBeDefined();
  });
  it('formatted strings have the same number of parameters in both languages', () => {
    for (const [path, v] of leaves(pl)) if (typeof v === 'function') expect((get(en, path) as (...a: unknown[]) => unknown).length, path).toBe(v.length);
  });
  it('lists keep their length', () => {
    expect(en.room.refsHead).toHaveLength(pl.room.refsHead.length);
    expect(en.shared.tableHead).toHaveLength(pl.shared.tableHead.length);
  });
});

describe('room texts (core)', () => {
  it('every Polish name, field group, field label and start-point name has an English translation', () => {
    const texts = new Set<string>();
    for (const id of ROOM_IDS) {
      const d = ROOMS[id];
      texts.add(d.name);
      d.fields.forEach((f) => { texts.add(f.group); texts.add(f.label); });
      d.shiftNames.filter(Boolean).forEach((n) => texts.add(n));
    }
    texts.add('salonu'); texts.add('łazienki');
    for (const t of texts) expect(EN[t], `no English text for "${t}"`).toBeTruthy();
  });
  it('the English model has no Polish text in titles and reference points', () => {
    const pol = /[ąęłńóśźżĄĘŁŃÓŚŹŻ]/;
    for (const id of ROOM_IDS) {
      const m = buildModel(id, {}, 'en');
      const all = [...m.refs.flatMap((r) => [r.name, r.where, r.coord]), ...m.surfs.map((s) => s.title)];
      for (const t of all) expect(pol.test(t), `${id}: "${t}"`).toBe(false);
    }
  });
  it('translation of an unknown text falls back to the text itself', () => {
    expect(tr('en' as Lang, 'coś innego')).toBe('coś innego');
    expect(tr('pl', 'Salon')).toBe('Salon');
  });
});

describe('drawing labels (render)', () => {
  it('Polish and English label sets have the same keys, nothing empty', () => {
    expect(Object.keys(EN_LABELS).sort()).toEqual(Object.keys(PL_LABELS).sort());
    for (const k of Object.keys(PL_LABELS) as Array<keyof typeof PL_LABELS>) {
      const a = PL_LABELS[k], b = EN_LABELS[k];
      expect(typeof b).toBe(typeof a);
      if (typeof b === 'string') expect(b.length).toBeGreaterThan(0);
      else expect(b(1, 2).length).toBeGreaterThan(0);
    }
  });
  it('English drawings contain no Polish words', () => {
    const pol = /ściana|sufit|dach|kalenica|szerokość|długość|okno|wycięcie|skos|Płyta|ścianka/;
    for (const id of ROOM_IDS) {
      const m = buildModel(id, {}, 'en');
      for (const d of [svgPlan(m, EN_LABELS), svgBoards(m, EN_LABELS), svgGables(m, EN_LABELS)]) expect(pol.test(d.svg), `${id}`).toBe(false);
    }
  });
});

describe('plurals and unambiguous prefixes', () => {
  const pl = CATALOGUES.pl, en = CATALOGUES.en;
  it('Polish counts use the right form (1 pasek, 2 paski, 5 pasków)', () => {
    expect(pl.room.slivers(1, 10)).toContain('1 pasek węższy');
    expect(pl.room.slivers(2, 10)).toContain('2 paski węższe');
    expect(pl.room.slivers(4, 10)).toContain('4 paski węższe');
    expect(pl.room.slivers(5, 10)).toContain('5 pasków węższych');
    expect(pl.room.stateSliver(4)).toBe('4 wąskie paski');
    expect(pl.shared.pieces(1, '1', 499, 125)).toContain('1 kawałek,');
    expect(pl.shared.pieces(22, '1', 499, 125)).toContain('22 kawałki,');
    expect(pl.shared.done(1)).toBe('Gotowe: 1 płyta.');
  });
  it('English counts are singular for one', () => {
    expect(en.room.slivers(1, 10)).toContain('1 strip narrower');
    expect(en.shared.done(1)).toBe('Done: 1 plate.');
  });
  it('piece labels never run a prefix digit into a field number', async () => {
    const { pieceLabel } = await import('@slabs/core');
    expect(pieceLabel('Ł1', [10])).toBe('Ł1-10');
    expect(pieceLabel('S', [12], 'a')).toBe('S12a');
    expect(pieceLabel('B1', [10, 11])).toBe('B1-10+11');
  });
  it('the bedroom length field says bedroom, the default project name exists in both languages', () => {
    expect(ROOMS.sypialnia.fields.find((f) => f.key === 'L')!.label).toContain('sypialni');
    expect(en.app.defaultProjectName).not.toBe(pl.app.defaultProjectName);
  });
});
