import { describe, expect, it } from 'vitest';
import { asRect, rectPts } from '@slabs/core';
import type { SurfaceMap } from '@slabs/render';
import { addVertex, dragVertex, moveSnapped, newOpeningPts } from './openingEdit';

const map: SurfaceMap = { toPx: (a, b) => [a, b], toCm: (x, y) => [x, y], perCm: 1, bounds: { a0: 0, a1: 400, b0: 0, b1: 250 }, guides: { a: [125, 250], b: [100] } };
const r = rectPts(50, 60, 100, 80);

describe('opening editing', () => {
  it('moves by whole centimetres and keeps the size', () => {
    const p = moveSnapped(r, 20.4, 10.4, map, [], false);
    expect(asRect(p)).toEqual({ a: 70, b: 70, w: 100, h: 80 });
  });
  it('snaps an edge to a joint line within 6 px, Shift turns snapping off', () => {
    // right edge would be at 223, the joint is at 250 (27 cm away): no snap; left edge at 123 -> joint 125
    const p = moveSnapped(r, 73, 0, map, [], false);
    expect(asRect(p)!.a).toBe(125);
    const free = moveSnapped(r, 73.4, 0, map, [], true);
    expect(asRect(free)!.a).toBeCloseTo(123.4, 5);
  });
  it('snaps to the edge of another opening and to the surface edge', () => {
    const other = { id: 'x', kind: 'window' as const, surface: 1, pts: rectPts(300, 0, 20, 20) };
    expect(asRect(moveSnapped(r, 149, 0, map, [other], false))!.a).toBe(200); // right edge 299 -> 300
    expect(asRect(moveSnapped(r, -100, 0, map, [], false))!.a).toBe(0); // clamped to the surface
    expect(asRect(moveSnapped(r, 0, 1000, map, [], false))!.b).toBe(170);
  });
  it('dragging a corner of a rectangle resizes it, the opposite corner stays', () => {
    const p = dragVertex(r, 2, 200, 200, map, false);
    expect(asRect(p)).toEqual({ a: 50, b: 60, w: 150, h: 140 });
    const tiny = dragVertex(r, 2, 51, 61, map, true);
    expect(asRect(tiny)!.w).toBeGreaterThanOrEqual(5);
  });
  it('polygon vertices move one at a time; a vertex is added in the middle of the longest edge', () => {
    const tri: Array<[number, number]> = [[0, 0], [100, 0], [50, 40]];
    expect(dragVertex(tri, 2, 60, 80, map, true)).toEqual([[0, 0], [100, 0], [60, 80]]);
    expect(addVertex(tri)).toEqual([[0, 0], [50, 0], [100, 0], [50, 40]]);
  });
  it('a new opening is inside the surface, a polygon has five vertices', () => {
    for (const k of ['window', 'door', 'cutout', 'polygon'] as const) {
      const pts = newOpeningPts(k, map);
      pts.forEach((q) => { expect(q[0]).toBeGreaterThanOrEqual(0); expect(q[0]).toBeLessThanOrEqual(400); expect(q[1]).toBeGreaterThanOrEqual(0); expect(q[1]).toBeLessThanOrEqual(250); });
    }
    expect(newOpeningPts('polygon', map)).toHaveLength(5);
  });
});
