import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { piecePolygons, polyArea } from './geometry';
import { computeCut, DEFAULT_REQUEST, verifyGuillotine, type CutRequest, type CutSettings } from './nest';
import { DEFAULT_PLATE, deriveTg, frameSides, orientations, plateCover, rotate180, withoutProfile, type PlateSpec } from './plate';
import { buildModel, ROOMS, roomPieces, ROOM_IDS, type RoomId } from './rooms';
import { pieceArea } from './shelf';
import type { Piece } from './types';

fc.configureGlobal({ seed: Number(process.env.FC_SEED) || 20260 });

const NAMES: Record<string, string> = { S: 'Salon', Sy: 'Sypialnia', 'Ł1': 'Łazienka 1', 'Ł2': 'Łazienka 2' };
const eps = 1e-6;

/** Request for the four default rooms with the given plate (covering sizes go to the models, physical size to the cut). */
function req(plate: PlateSpec, settings: Partial<CutSettings> = {}, over: Partial<CutRequest> = {}, rooms: Partial<Record<RoomId, Record<string, number>>> = {}): CutRequest {
  const cv = plateCover(plate);
  const st: CutSettings = { kerf: 0.3, trim: 0, minOffcut: 10, guillotine: false, ...settings };
  const pf = plate.profile === 'all' ? 2 : plate.profile === 'long' ? 1 : 0;
  const trimW = cv.long ? 0 : st.trim, trimL = cv.end ? 0 : st.trim;
  return {
    ...DEFAULT_REQUEST, settings: st, maxIters: 60, timeMs: Infinity, plate,
    rooms: ROOM_IDS.map((id) => {
      const m = buildModel(id, { ...ROOMS[id].defaults, ...rooms[id], PL: cv.L, PW: cv.W, trim: trimW, trimL, pf, winOn: 0 });
      return { key: ROOMS[id].key, name: NAMES[ROOMS[id].key]!, on: true, PL: m.p.PL!, PW: m.p.PW!, pieces: roomPieces(m) };
    }),
    ...over,
  };
}

/** Every profiled edge of every placed item lies on the plate edge with the same profile; boxes do not overlap; nothing is over 100 %. */
function checkPlates(r: ReturnType<typeof computeCut>, plate: PlateSpec, kerf: number, trimX: number, trimY: number) {
  const t = plateCover(plate).t;
  r.plates.forEach((pl) => {
    const boxes: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
    pl.items.forEach((it) => {
      const p = it.p;
      if (p.band) { boxes.push({ x0: it.x, y0: it.y, x1: it.x + p.l, y1: it.y + p.w }); return; }
      const s = frameSides(p);
      expect(s.ok).toBe(true);
      // the item's top edge is the plate's tongue edge, its bottom the groove edge, left = groove end, right = tongue end
      if (s.top) { expect(s.top).toBe('T'); expect(it.y - t).toBeCloseTo(trimY, 5); }
      if (s.bottom) { expect(s.bottom).toBe('G'); expect(it.y + p.w).toBeCloseTo(plate.W - trimY, 5); }
      if (s.left) { expect(s.left).toBe('G'); expect(it.x).toBeCloseTo(trimX, 5); }
      if (s.right) { expect(s.right).toBe('T'); expect(it.x + p.l + t).toBeCloseTo(plate.L - trimX, 5); }
      boxes.push({ x0: it.x, y0: it.y - (s.top ? t : 0), x1: it.x + p.l + (s.right ? t : 0), y1: it.y + p.w });
    });
    boxes.forEach((b) => { expect(b.x0).toBeGreaterThanOrEqual(trimX - eps); expect(b.y0).toBeGreaterThanOrEqual(trimY - eps); expect(b.x1).toBeLessThanOrEqual(plate.L - trimX + eps); expect(b.y1).toBeLessThanOrEqual(plate.W - trimY + eps); });
    if (!pl.extra) {
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        const gap = Math.max(b.x0 - a.x1, a.x0 - b.x1, b.y0 - a.y1, a.y0 - b.y1);
        expect(gap).toBeGreaterThanOrEqual(kerf - 1e-4);
      }
    }
    expect(pl.use).toBeLessThanOrEqual(1 + 1e-9);
  });
}

describe('tongue and groove: plate model', () => {
  it('covering size is the physical size minus the tongue in every profiled direction', () => {
    expect(plateCover(DEFAULT_PLATE)).toMatchObject({ L: 499, W: 124, long: true, end: true, t: 1 });
    expect(plateCover({ ...DEFAULT_PLATE, profile: 'long' })).toMatchObject({ L: 500, W: 124, end: false });
    expect(plateCover({ ...DEFAULT_PLATE, profile: 'none' })).toMatchObject({ L: 500, W: 125, long: false, end: false, t: 0 });
  });
  it('typed edges: joints get a profile, walls / folds / openings stay plain', () => {
    const e = { l0: 'joint', l1: 'wall', w0: 'joint', w1: 'bend' };
    expect(deriveTg(e, 'all')).toEqual({ l0: 'G', w0: 'T' });
    expect(deriveTg({ l0: 'wall', l1: 'joint', w0: 'wall', w1: 'joint' }, 'all')).toEqual({ l1: 'T', w1: 'G' });
    expect(deriveTg({ l0: 'wall', l1: 'joint', w0: 'wall', w1: 'joint' }, 'long')).toEqual({ w1: 'G' });
    expect(deriveTg(e, 'none')).toBeUndefined();
  });
  it('pieces carry tongue and groove on the sides of their joints (same convention on every surface)', () => {
    const m = buildModel('salon', { ...ROOMS.salon.defaults, PL: 499, PW: 124, pf: 2, winOn: 0 });
    const pcs = roomPieces(m);
    expect(pcs.some((p) => p.tg?.w0 === 'T')).toBe(true);
    pcs.forEach((p) => {
      if (p.edges?.w0 === 'joint') expect(p.tg?.w0).toBe('T');
      if (p.edges?.w1 === 'joint') expect(p.tg?.w1).toBe('G');
      if (p.edges?.w0 !== 'joint') expect(p.tg?.w0).toBeUndefined();
    });
    expect(pcs.every((p) => p.kind !== 'pair')).toBe(true);
  });
  it('orientations: 0° or 180° only; 180° swaps which side carries the tongue', () => {
    const g = { t: 1, long: true, end: true };
    const a: Piece = { kind: 'rect', l: 100, w: 50, ids: [1], tg: { w0: 'T', w1: 'G' } };
    const b: Piece = { kind: 'rect', l: 100, w: 50, ids: [2], tg: { w0: 'G', w1: 'T' } };
    expect(orientations(a, g).map((o) => o.rot)).toEqual([false]);
    expect(orientations(b, g).map((o) => o.rot)).toEqual([true]);
    const plain: Piece = { kind: 'rect', l: 100, w: 50, ids: [3] };
    expect(orientations(plain, g)).toHaveLength(1);
    const o = orientations(a, g)[0]!;
    expect(o).toMatchObject({ bw: 100, bh: 51, dy: 1, aT: true, aB: true });
    // a turned piece is the same shape with the profile swapped
    const r = rotate180(b);
    expect(r.tg).toEqual({ w0: 'T', w1: 'G', l0: undefined, l1: undefined });
    expect(orientations(r, g).map((q) => q.rot)).toEqual([false]);
  });
  it('a ready-made 180° turn keeps area and the polygon', () => {
    const trap: Piece = { kind: 'trap', l: 120, w: 60, ids: [1], ha: 80, hb: 120, prof: [[0, 80], [1, 120]], tg: { w0: 'G', w1: 'T' } };
    const r = rotate180(trap);
    expect(r.kind).toBe('nest');
    expect(Math.abs(polyArea(piecePolygons(r)[0]!) - pieceArea(trap))).toBeLessThan(1e-9);
    expect(frameSides(r)).toMatchObject({ top: 'T', bottom: 'G', ok: true });
    const poly: Piece = { kind: 'poly', l: 100, w: 40, ids: [2], outline: [[0, 0], [100, 0], [60, 40], [0, 40]], tg: { l0: 'G' } };
    const rp = rotate180(poly);
    expect(polyArea(rp.outline!)).toBeCloseTo(polyArea(poly.outline!), 9);
    expect(rp.tg!.l1).toBe('G');
  });
  it('pairing head to tail is dropped when it would put a tongue on the wrong plate edge', () => {
    const r = computeCut(req(DEFAULT_PLATE));
    r.plates.forEach((pl) => pl.items.forEach((it) => { if (it.p.kind === 'nest') expect(frameSides(it.p).ok).toBe(true); }));
  });
});

describe('tongue and groove: cut plans', () => {
  it('default rooms: every required profile edge lies on a matching plate edge, no overlaps, never above 100 %', () => {
    for (const guillotine of [false, true]) {
      const r = computeCut(req(DEFAULT_PLATE, { guillotine }));
      expect(r.blocking).toEqual([]);
      expect(r.tgDropped).toBe(0);
      expect(r.PL).toBe(500); expect(r.PW).toBe(125);
      checkPlates(r, DEFAULT_PLATE, 0.3, 0, 0);
      if (guillotine) r.plates.forEach((pl) => expect(verifyGuillotine(pl, r.PL, r.PW, 0.3, 0, 0)).toBeNull());
    }
  });
  it('long edges only: ends are cut plain and edge trim applies to the short edges', () => {
    const plate: PlateSpec = { ...DEFAULT_PLATE, profile: 'long' };
    const r = computeCut(req(plate, { trim: 0.5 }));
    expect(r.blocking).toEqual([]);
    checkPlates(r, plate, 0.3, 0.5, 0);
    r.plates.forEach((pl) => pl.items.forEach((it) => { const s = frameSides(it.p); expect(s.left).toBeUndefined(); expect(s.right).toBeUndefined(); }));
  });
  it('profile none reproduces the artifact: same plates with or without the plate model', () => {
    const none: PlateSpec = { L: 499, W: 125, tongue: 1, profile: 'none' };
    const a = computeCut(req(none, { kerf: 0 }));
    const b = computeCut({ ...req(none, { kerf: 0 }), plate: undefined });
    expect(a.plates.length).toBe(b.plates.length);
    expect(a.plates.map((p) => p.items.map((i) => [i.x, i.y, i.p.l, i.p.w]))).toEqual(b.plates.map((p) => p.items.map((i) => [i.x, i.y, i.p.l, i.p.w])));
    expect(a.tongue).toBeUndefined();
  });
  it('the whole project is cut in both modes; the plain-plate result is the comparison', () => {
    const t = computeCut(req(DEFAULT_PLATE)), n = computeCut(req(withoutProfile(DEFAULT_PLATE)));
    expect(t.plates.length).toBeGreaterThan(0);
    expect(n.plates.length).toBeGreaterThan(0);
    expect(t.stats.plates - n.stats.plates).toBeLessThan(40); // sanity: the difference is a few plates, not a different order of magnitude
  });
  it('every piece of every room is on some plate (nothing is lost to the constraints)', () => {
    const r = computeCut(req(DEFAULT_PLATE));
    const placed = new Set<string>();
    r.plates.forEach((pl) => pl.items.forEach((it) => {
      const add = (p: Piece) => placed.add(`${p.room ?? ''}:${p.ids.join('+')}:${p.seg ?? ''}`);
      if (it.p.kind === 'nest') it.p.parts!.forEach((t) => add({ ...t.p, room: t.p.room ?? it.p.room })); else add(it.p);
    }));
    const q = req(DEFAULT_PLATE);
    q.rooms.forEach((rm) => rm.pieces.forEach((p) => expect([...placed].some((k) => k.startsWith(`${rm.key}:${p.ids.join('+')}:`))).toBe(true)));
  });

  const rooms = fc.record({
    W: fc.integer({ min: 420, max: 700 }), L: fc.integer({ min: 600, max: 1300 }), ang: fc.integer({ min: 25, max: 55 }), HL: fc.integer({ min: 60, max: 150 }),
    ZO: fc.integer({ min: 0, max: 600 }), XO: fc.integer({ min: -150, max: 150 }),
  });
  it('property: constraints hold for random rooms, kerf, trim and both cutting modes', () => {
    fc.assert(fc.property(rooms, fc.constantFrom('all', 'long') as fc.Arbitrary<'all' | 'long'>, fc.constantFrom(0, 0.3), fc.constantFrom(0, 0.5), fc.boolean(), (salon, profile, kerf, trim, guillotine) => {
      const plate: PlateSpec = { ...DEFAULT_PLATE, profile };
      const r = computeCut(req(plate, { kerf, trim, guillotine }, {}, { salon }));
      expect(r.blocking).toEqual([]);
      checkPlates(r, plate, kerf, profile === 'all' ? 0 : trim, 0);
      if (guillotine) r.plates.forEach((pl) => expect(verifyGuillotine(pl, r.PL, r.PW, kerf, profile === 'all' ? 0 : trim, 0)).toBeNull());
    }), { numRuns: 12 });
  });
});
