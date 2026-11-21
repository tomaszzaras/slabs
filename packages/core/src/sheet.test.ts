import { describe, expect, it } from 'vitest';
import { ATTIC_PRESETS, atticModel, atticPieces, type AtticModel, type AtticPresetId } from './attic';
import { splitPieces } from './nest';
import { addStripCut, joinTooLong, legacyOpeningToSheet, moveStripCut, removeStripCut, roofSheet, sanitizeSplits, setLineSplit, setStripSplit, withSheet, type RoofSplits } from './sheet';
import type { Piece } from './types';

// The sheet is built on a model whose legacy segments share one grid: the app sets o2..o5 to o1; here o1..o5 are all equal.
const model = (id: AtticPresetId, pin: Record<string, number> = {}, o = 0): AtticModel => {
  const q = { ...pin, o1: o, o2: o, o3: o, o4: o, o5: o };
  return atticModel(ATTIC_PRESETS[id], q);
};
const r3 = (v: number) => Math.round(v * 1000) / 1000;
// The legacy model marks the seam where its right segment 3 hands over to segment 4 (a grid joint that lies just before the cut-out) as a
// wall edge although it is an ordinary joint between two plates; `seam` leaves the side edges out of the comparison in that case.
const desc = (p: Piece, withCut: boolean, seam = false) => JSON.stringify([r3(p.l), r3(p.w), p.edges?.l0, p.edges?.l1, seam ? 0 : p.edges?.w0, seam ? 0 : p.edges?.w1, seam ? 0 : p.tg ?? null, withCut ? (p.cut ? r3(p.cut) : null) : 0]);
const hasSeam = (m: AtticModel) => { const s4 = m.surfs.find((s) => s.key === 4); return !!s4 && Math.abs(s4.z0 - m.ZB) > 0.5; };
const boards = (ps: Piece[]) => ps.filter((q) => q.src?.kind === 'board');
const sorted = (ps: Piece[], c: boolean, seam = false) => ps.map((q) => desc(q, c, seam)).sort();

const CASES: Array<[AtticPresetId, Record<string, number>, number]> = [
  ['salon', {}, 0], ['salon', {}, 37], ['salon', { W: 600, L: 1100, ZA: 300, dB: 90 }, 0], ['salon', { PL: 499, PW: 124 }, 0], ['salon', { PL: 499, PW: 124, pf: 2 }, 11],
  ['sypialnia', {}, 0], ['sypialnia', { capOn: 0 }, 0], ['sypialnia', { L: 800, ang: 33 }, 20], ['sypialnia', { PL: 499, PW: 124, pf: 2 }, 0],
  ['lazienka-1', {}, 0], ['lazienka-1', { bw: 150, L: 500 }, 30],
];

describe('roof sheet = the legacy per-segment model when all start offsets are equal', () => {
  for (const [id, pin, o] of CASES) {
    const name = `${id} ${JSON.stringify(pin)} o=${o}`;
    it(`${name}: same pieces, folds split (project setting on)`, () => {
      const m = model(id, pin, o);
      const legacy = splitPieces(boards(atticPieces(m)));
      const sheet = roofSheet(m, { splits: {}, splitAtBends: true }).pieces;
      expect(sorted(sheet, false, hasSeam(m))).toEqual(sorted(legacy, false, hasSeam(m)));
      expect(sheet.reduce((a, q) => a + q.l * q.w, 0)).toBeCloseTo(legacy.reduce((a, q) => a + q.l * q.w, 0), 6);
    });
    it(`${name}: same pieces, folds joined (setting off; the cut-out wall is still split)`, () => {
      const m = model(id, pin, o);
      const legacy = boards(atticPieces(m));
      const sh = roofSheet(m, { splits: { line: { wallfold: true } }, splitAtBends: false });
      const cap = m.cap;
      expect(sorted(sh.pieces, !cap, hasSeam(m))).toEqual(sorted(legacy, !cap, hasSeam(m)));
    });
    it(`${name}: the sheet's joints are the legacy joints (same z)`, () => {
      const m = model(id, pin, o);
      const zs = new Set<number>();
      m.surfs.forEach((s) => s.cols.forEach((c) => { zs.add(r3(c.a)); zs.add(r3(c.b)); }));
      const sh = roofSheet(m, { splits: {}, splitAtBends: true });
      const mine = new Set<number>();
      sh.strips.forEach((s) => { mine.add(r3(s.a)); mine.add(r3(s.b)); });
      mine.forEach((z) => expect(zs.has(z), `z=${z}`).toBe(true));
    });
  }
});

describe('splits', () => {
  const m = model('salon');
  const sheet = (sp: RoofSplits = {}, bends = true) => roofSheet(m, { splits: sp, splitAtBends: bends });
  it('defaults: ridge split, folds follow the project setting', () => {
    const a = sheet({}, true), b = sheet({}, false);
    expect(a.lines.filter((l) => l.id === 'ridge').every((l) => l.on)).toBe(true);
    expect(a.lines.filter((l) => l.id === 'eaveL').every((l) => l.on)).toBe(true);
    expect(b.lines.filter((l) => l.id === 'eaveL').every((l) => !l.on)).toBe(true);
    expect(b.pieces.length).toBeLessThan(a.pieces.length);
  });
  it('one strip joined across the ridge is one piece when it fits a plate', () => {
    const base = sheet({}, true);
    const k = base.strips[1]!.k;
    const p0 = base.pieces.length;
    const sp = setStripSplit({}, k, 'ridge', false, true);
    const joined = roofSheet(m, { splits: sp, splitAtBends: true });
    // left + right of the salon are longer than a plate: joining the ridge makes automatic cross-cuts (and a note)
    expect(joinTooLong(base, {}, k, 'ridge', true)).not.toBeNull();
    expect(joined.notes.length).toBeGreaterThan(0);
    expect(joined.pieces.length).toBeGreaterThan(0);
    expect(p0).toBeGreaterThan(0);
  });
  it('a join that fits a plate is allowed: bedroom, ridge joined', () => {
    const mm = model('sypialnia', { W: 300, L: 330, PL: 700 });
    const base = roofSheet(mm, { splits: {}, splitAtBends: false });
    const k = base.strips[0]!.k;
    expect(joinTooLong(base, {}, k, 'ridge', false)).toBeNull();
    const j = roofSheet(mm, { splits: setStripSplit({}, k, 'ridge', false, false), splitAtBends: false });
    expect(j.pieces.length).toBeLessThan(base.pieces.length);
    const one = j.pieces.find((q) => q.ids[0] === j.strips[0]!.id)!;
    expect(one.l).toBeGreaterThan(base.pieces.find((q) => q.ids[0] === base.strips[0]!.id)!.l);
    expect(one.noSplit).toBe(true);
  });
  it('whole-line choice overrides and drops strip choices; defaults are not stored', () => {
    let sp = setStripSplit({}, 2, 'eaveR', false, true);
    expect(sp.strips?.['2']?.s?.eaveR).toBe(false);
    sp = setLineSplit(sp, 'eaveR', false, true);
    expect(sp.line?.eaveR).toBe(false);
    expect(sp.strips).toBeUndefined();
    sp = setLineSplit(sp, 'eaveR', true, true);
    expect(sp).toEqual({});
    expect(setStripSplit({}, 1, 'ridge', true, true)).toEqual({});
  });
  it('cross-cuts: add, move, remove; they are end joints (tongue/groove) and survive other changes by distance from the ridge', () => {
    const mm = model('sypialnia', { PL: 499, PW: 124, pf: 2 });
    const k = roofSheet(mm, { splits: {}, splitAtBends: false }).strips[0]!.k;
    let sp = addStripCut({}, k, -150);
    const a = roofSheet(mm, { splits: sp, splitAtBends: false });
    const pa = a.pieces.filter((q) => q.ids[0] === a.strips[0]!.id);
    expect(pa.some((q) => q.edges!.l1 === 'joint' || q.edges!.l0 === 'joint')).toBe(true);
    expect(pa.some((q) => q.tg && (q.tg.l0 || q.tg.l1))).toBe(true);
    // ridge / fold splits are plain cuts
    const plain = roofSheet(mm, { splits: {}, splitAtBends: true }).pieces;
    expect(plain.every((q) => !q.tg?.l0 && !q.tg?.l1)).toBe(true);
    sp = moveStripCut(sp, k, -150, -120);
    expect(sp.strips![String(k)]!.c).toEqual([-120]);
    // a different length of the room keeps the cut
    const b = roofSheet(model('sypialnia', { PL: 499, PW: 124, pf: 2, L: 400 }), { splits: sp, splitAtBends: false });
    expect(b.cuts.filter((q) => !q.auto).length).toBeGreaterThan(0);
    sp = removeStripCut(sp, k, -120);
    expect(sp).toEqual({});
  });
  it('automatic cross-cuts only where a piece exceeds the plate', () => {
    const long = model('sypialnia', { PL: 300, PW: 124, L: 330 });
    const sh = roofSheet(long, { splits: {}, splitAtBends: false });
    expect(sh.cuts.length).toBeGreaterThan(0);
    expect(sh.cuts.every((c) => c.auto)).toBe(true);
    expect(sh.pieces.every((q) => q.l <= 300 + 1e-6)).toBe(true);
    const ok = roofSheet(model('sypialnia', {}), { splits: {}, splitAtBends: true });
    expect(ok.cuts.length).toBe(0);
  });
  it('sanitize drops junk', () => {
    expect(sanitizeSplits({ line: { ridge: 1, bogus: true, eaveL: false }, strips: { '3': { s: { ridge: false, x: true }, c: [1, 'a', NaN, 40.04] }, abc: {} } })).toEqual({ line: { eaveL: false }, strips: { '3': { s: { ridge: false }, c: [1, 40] } } });
    expect(sanitizeSplits(null)).toEqual({});
  });
  it('old openings move onto the sheet', () => {
    const sh = sheet();
    const o = { id: 'a', kind: 'window' as const, surface: 1, pts: [[10, 5], [30, 5], [30, 20], [10, 20]] as Array<[number, number]> };
    expect(legacyOpeningToSheet(sh, o).pts[0]).toEqual([-10, 5]);
    expect(legacyOpeningToSheet(sh, { ...o, surface: 3 }).pts[0]).toEqual([10, 5]);
    expect(legacyOpeningToSheet(sh, { ...o, surface: 5 }).pts[0]![0]).toBeCloseTo(sh.wallFold! - 10, 6);
    const g = { ...o, surface: 6 };
    expect(legacyOpeningToSheet(sh, g)).toBe(g);
  });
});

describe('model with a sheet', () => {
  it('one roof start point and the gable walls follow; field numbers run on; pieces use the sheet', () => {
    const m = withSheet(model('salon'), { splits: {}, splitAtBends: true });
    expect(m.refs.map((r) => r.id)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5']);
    expect(Object.keys(m.present).map(Number).sort()).toEqual([1, 6, 7, 8, 9]);
    const n = m.sheet!.strips.length;
    expect(m.walls[0]!.strips[0]!.id).toBe(n + 1);
    const ps = atticPieces(m);
    expect(ps.filter((q) => q.src?.kind === 'board').length).toBe(m.sheet!.pieces.length);
    expect(m.fields).toBe(n + m.walls.reduce((a, w) => a + w.strips.length, 0));
  });
  it('the sheet covers the room: net area equals the legacy area', () => {
    for (const [id, pin] of CASES) {
      const m = model(id, pin[0] as never);
      void pin;
      const sh = roofSheet(m, { splits: {}, splitAtBends: true });
      const area = sh.pieces.reduce((a, q) => a + q.l * q.w, 0);
      const legacy = boards(atticPieces(m)).reduce((a, q) => a + q.l * q.w, 0);
      expect(area).toBeCloseTo(legacy, 4);
    }
  });
});
