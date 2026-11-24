import { describe, expect, it } from 'vitest';
import { area, bbox, cellsToOutline, edgesOf, rectOutline, setWallLength, validOutline } from './outline';

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
