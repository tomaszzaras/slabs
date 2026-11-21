import { describe, expect, it } from 'vitest';
import { buildModel, defaultOpenings, isAttic, roomPieces } from './rooms';
import { rectOpening, asRect } from './openings';
import { pieceArea } from './shelf';
import { polyArea } from './geometry';
import { computeCut, DEFAULT_REQUEST, NO_SETTINGS } from './nest';
import { ROOMS, ROOM_IDS } from './rooms';

const area = (ps: ReturnType<typeof roomPieces>) => ps.reduce((a, p) => a + pieceArea(p), 0);

describe('openings are cut out of the pieces', () => {
  const m = buildModel('salon', {});
  if (!isAttic(m)) throw new Error('attic');
  const open = defaultOpenings('salon', {});
  it('the salon starts with the artifact window as an editable opening (same polygon)', () => {
    expect(open).toHaveLength(1);
    expect(open[0]!.pts).toEqual(m.win);
    expect(open[0]!.surface).toBe(m.walls.find((w) => w.z === 0)!.rid);
  });
  it('KNOWN ARTIFACT DIFFERENCE: the artifact counted the window area inside the pieces; here the window is not wood', () => {
    const without = roomPieces(m);
    const withOpen = roomPieces(m, open);
    const winArea = polyArea(m.win!);
    expect(winArea).toBeGreaterThan(1000);
    expect(Math.abs(area(without) - area(withOpen) - winArea)).toBeLessThan(0.01);
    // and now the pieces add up to the room's net area exactly (the artifact needed "+ window")
    expect(Math.abs(area(withOpen) - m.areaCm2)).toBeLessThan(0.01);
  });
  it('without openings the pieces are exactly the artifact pieces', () => {
    expect(roomPieces(m, [])).toEqual(roomPieces(m));
  });
  it('a window that crosses a joint splits the strip into pieces; area = strips - window', () => {
    const wall = m.walls.find((w) => w.z === 0)!;
    const base = roomPieces(m, []);
    const o = rectOpening('t', 'window', wall.rid, -150, 60, 100, 100);
    const pcs = roomPieces(m, [o]);
    expect(pcs.length).toBeGreaterThan(base.length - 1);
    expect(Math.abs(area(base) - area(pcs) - 100 * 100)).toBeLessThan(0.01);
    expect(pcs.some((p) => p.kind === 'poly')).toBe(true);
  });
  it('a hole inside a board column keeps the piece as it is and records the hole', () => {
    const b = m.surfs.find((s) => s.key === 3)!;
    const c = b.cols[1]!;
    const o = rectOpening('h', 'cutout', 3, 100, c.a + 20, 40, 30);
    const base = roomPieces(m, []);
    const pcs = roomPieces(m, [o]);
    expect(pcs).toHaveLength(base.length);
    const withHole = pcs.filter((p) => p.holes?.length);
    expect(withHole).toHaveLength(1);
    expect(withHole[0]!.kind).toBe('rect');
    expect(Math.abs(area(base) - area(pcs) - 1200)).toBeLessThan(0.01);
  });
  it('an opening off every piece changes nothing; asRect recognises rectangles', () => {
    expect(roomPieces(m, [rectOpening('x', 'door', 3, -5000, -5000, 10, 10)])).toEqual(roomPieces(m));
    expect(asRect(rectOpening('x', 'door', 3, 1, 2, 30, 40).pts)).toEqual({ a: 1, b: 2, w: 30, h: 40 });
    expect(asRect([[0, 0], [10, 0], [5, 8]])).toBeNull();
  });
  it('a shared cut with the window cut out stays valid: nothing over 100%, nothing larger than the plate', () => {
    const req = (op: boolean) => ({ ...DEFAULT_REQUEST, settings: NO_SETTINGS, maxIters: 60, timeMs: Infinity, rooms: ROOM_IDS.map((id) => { const mm = buildModel(id, {}); return { key: ROOMS[id].key, name: id, on: true, PL: mm.p.PL!, PW: mm.p.PW!, pieces: roomPieces(mm, id === 'salon' && op ? open : []) }; }) });
    const a = computeCut(req(false)), b = computeCut(req(true));
    expect(b.blocking).toHaveLength(0);
    b.plates.forEach((pl) => expect(pl.use).toBeLessThanOrEqual(1 + 1e-9));
    expect(b.plates.length).toBeLessThanOrEqual(a.plates.length + 1);
    expect(b.stats.netM2).toBeLessThan(a.stats.netM2);
  });
});
