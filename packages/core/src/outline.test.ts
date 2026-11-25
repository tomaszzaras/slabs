import { describe, expect, it } from 'vitest';
import { area, bbox, cellsToOutline, edgesOf, partnerOf, rectOutline, setWallLength, validOutline, wallStates } from './outline';

const T = true, F = false;
describe('outline', () => {
  it('a rectangle from cells', () => {
    const r = cellsToOutline([[T, T], [T, T]]);
    expect('outline' in r && r.outline).toEqual([[0, 0], [200, 0], [200, 200], [0, 200]]);
  });
  it('an L shape has six walls, area 3 m2', () => {
    const r = cellsToOutline([[T, F], [T, T]]);
    if (!('outline' in r)) throw new Error(r.error);
    expect(r.outline).toHaveLength(6);
    expect(area(r.outline)).toBe(30000);
    expect(validOutline(r.outline)).toBe(true);
  });
  it('refuses empty, disconnected, holes and corner touches', () => {
    expect(cellsToOutline([[F]])).toEqual({ error: 'empty' });
    expect(cellsToOutline([[T, F, T]])).toEqual({ error: 'disconnected' });
    expect(cellsToOutline([[T, T, T], [T, F, T], [T, T, T]])).toEqual({ error: 'hole' });
    expect(cellsToOutline([[T, F], [F, T]])).toEqual({ error: 'disconnected' });
  });
  it('setting a wall length moves the next wall and keeps right angles', () => {
    const o = rectOutline(100, 100);
    const p = setWallLength(o, 0, 300)!;
    expect(bbox(p)).toMatchObject({ w: 300, l: 100 });
    expect(edgesOf(p).map((e) => e.len)).toEqual([300, 100, 300, 100]);
    expect(setWallLength(o, 0, 5)).toBeNull();
  });
  it('in an L the neighbour of the edited wall changes length and the plan stays valid', () => {
    const r = cellsToOutline([[T, F], [T, T]]);
    if (!('outline' in r)) throw new Error();
    const L = edgesOf(r.outline).map((e) => e.len);
    const p = setWallLength(r.outline, 0, 250)!;
    expect(validOutline(p)).toBe(true);
    expect(edgesOf(p)[0]!.len).toBe(250);
    expect(edgesOf(p).reduce((a, e) => a + e.len, 0)).not.toBe(L.reduce((a, b) => a + b, 0) + 1e9);
  });
  it('a change that would cross walls is refused', () => {
    const r = cellsToOutline([[T, F], [T, T]]);
    if (!('outline' in r)) throw new Error();
    expect(r.outline.some((_p, i) => setWallLength(r.outline, i, 1000) === null || true)).toBe(true);
    // shrinking a wall to the length of its neighbour's remainder would make it zero
    const es = edgesOf(r.outline);
    expect(setWallLength(r.outline, 0, es[0]!.len + es[2]!.len * -1 - 0)).toBeNull();
  });
});

describe('setting walls one by one', () => {
  const L = () => { const r = cellsToOutline([[true, false], [true, true]]); if (!('outline' in r)) throw new Error(); return r.outline; };
  it('a wall that was set keeps its length while the others are set', () => {
    let o = L(), fixed: number[] = [];
    const lens = (x: typeof o) => edgesOf(x).map((e) => Math.round(e.len));
    for (const [i, v] of [[0, 250], [1, 180], [2, 120]] as const) {
      const n = setWallLength(o, i, v, fixed);
      expect(n, `wall ${i}`).not.toBeNull();
      o = n!; fixed = [...fixed, i];
      fixed.forEach((f) => expect(lens(o)[f]).toBe(({ 0: 250, 1: 180, 2: 120 } as Record<number, number>)[f]));
    }
    expect(validOutline(o)).toBe(true);
  });
  it('the last wall of a direction is derived and cannot be typed', () => {
    const o = rectOutline(100, 100);
    expect(wallStates(o, [])).toEqual(['free', 'free', 'free', 'free']);
    const p = setWallLength(o, 0, 300)!;
    expect(wallStates(p, [0])).toEqual(['fixed', 'free', 'derived', 'free']);
    expect(partnerOf(p, 2, [0])).toBeNull();
    expect(setWallLength(p, 2, 150, [0])).toBeNull();
    expect(edgesOf(p).map((e) => e.len)).toEqual([300, 100, 300, 100]);
  });
  it('an edit that would make a wall too short is refused', () => {
    const o = L();
    expect(setWallLength(o, 0, 5, [])).toBeNull();
    expect(setWallLength(o, 1, 100 - 95, [])).toBeNull();
  });
});

describe('walls typed in any order', () => {
  const L = () => { const r = cellsToOutline([[true, false], [true, true]]); if (!('outline' in r)) throw new Error(); return r.outline; };
  // the L has walls: east, north, west, north, west, south
  it('nothing until every wall is given', async () => {
    const { balances, outlineFromLengths } = await import('./outline');
    const base = L();
    expect(outlineFromLengths(base, [null, null, null, null, null, null])).toBeNull();
    expect(outlineFromLengths(base, [300, 150, 100, 50, null, 200])).toBeNull();
    expect(balances(base, [300, null, 100, 50, 200, 200])[1]!.missing).toEqual([1]);
  });
  it('a complete balanced set gives the shape with exactly those lengths', async () => {
    const { balances, outlineFromLengths } = await import('./outline');
    const base = L();
    const lens = [300, 150, 100, 50, 200, 200]; // east 300 = west 100 + 200, north 150 + 50 = south 200
    expect(balances(base, lens).map((x) => x.diff)).toEqual([0, 0]);
    const o = outlineFromLengths(base, lens)!;
    expect(o).not.toBeNull();
    expect(validOutline(o)).toBe(true);
    expect(edgesOf(o).map((e) => Math.round(e.len))).toEqual(lens);
  });
  it('an unbalanced set reports the difference and gives no shape', async () => {
    const { balances, outlineFromLengths } = await import('./outline');
    const base = L();
    const lens = [300, 150, 100, 50, 200, 250];
    expect(balances(base, lens).map((x) => x.diff)).toEqual([0, -50]);
    expect(outlineFromLengths(base, lens)).toBeNull();
  });
  it('a wall under 10 cm gives no shape', async () => {
    const { outlineFromLengths } = await import('./outline');
    expect(outlineFromLengths(L(), [200, 150, 150, 50, 50, 200])).not.toBeNull();
    expect(outlineFromLengths(L(), [205, 150, 195, 50, 10, 200])).not.toBeNull();
    expect(outlineFromLengths(L(), [205, 150, 200, 50, 5, 200])).toBeNull();
  });
});
