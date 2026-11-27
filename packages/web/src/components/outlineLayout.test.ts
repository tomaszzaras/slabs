import { describe, expect, it } from 'vitest';
import { cellsToOutline } from '@slabs/core';
import { inside, layoutOutline, outwardNormal, rectHitsPolygon, type V } from './outlineLayout';

const outline = (rows: string[]) => {
  const o = cellsToOutline(rows.map((r) => [...r].map((ch) => ch === '#')), 100);
  if (!('outline' in o)) throw new Error('not a valid shape: ' + o.error);
  return o.outline;
};
const SHAPES: Record<string, string[]> = {
  rectangle: ['.....', '.###.', '.###.', '.###.', '.....'],
  L: ['.....', '.#...', '.#...', '.##..', '.....'],
  T: ['.....', '.###.', '..#..', '..#..', '.....'],
  U: ['.....', '.#.#.', '.#.#.', '.###.', '.....'],
  // the room of the owner's screenshot: a stair-stepped block with notches at the top right and the bottom left
  screenshot: ['.##..', '.###.', '.###.', '.###.', '..##.'],
  zigzag: ['.#...', '.##..', '..##.', '...#.', '.....'],
};
const BOX = { w: 76, h: 44 };

describe('wall inputs on the outline drawing', () => {
  for (const [name, rows] of Object.entries(SHAPES)) {
    it(`${name}: every input is on the canvas, off the floor and off every other input`, () => {
      const W = 520, H = 426, { poly, boxes } = layoutOutline(outline(rows), W, H, BOX.w, BOX.h);
      expect(boxes.length).toBe(poly.length);
      boxes.forEach((c, i) => {
        expect(c[0] - BOX.w / 2).toBeGreaterThanOrEqual(0);
        expect(c[0] + BOX.w / 2).toBeLessThanOrEqual(W);
        expect(c[1] - BOX.h / 2).toBeGreaterThanOrEqual(0);
        expect(c[1] + BOX.h / 2).toBeLessThanOrEqual(H);
        expect(rectHitsPolygon(c, BOX, poly), `input ${i + 1} lies on the floor`).toBe(false);
        boxes.slice(i + 1).forEach((d, j) => {
          const apart = Math.abs(c[0] - d[0]) >= BOX.w || Math.abs(c[1] - d[1]) >= BOX.h;
          expect(apart, `inputs ${i + 1} and ${i + j + 2} overlap`).toBe(true);
        });
      });
    });
  }

  it('also on a phone-sized canvas (68 px wide inputs)', () => {
    const box = { w: 68, h: 44 }, W = 300, H = 320, { poly, boxes } = layoutOutline(outline(SHAPES.screenshot!), W, H, box.w, box.h);
    boxes.forEach((c, i) => {
      expect(rectHitsPolygon(c, box, poly), `input ${i + 1} lies on the floor`).toBe(false);
      boxes.slice(i + 1).forEach((d) => expect(Math.abs(c[0] - d[0]) >= box.w || Math.abs(c[1] - d[1]) >= box.h).toBe(true));
    });
  });

  it('a wall of an ordinary room keeps its input right beside it, on the outer side', () => {
    const { walls, boxes } = layoutOutline(outline(SHAPES.rectangle!), 520, 426, BOX.w, BOX.h);
    walls.forEach((w, i) => {
      const c = boxes[i]!, along = (c[0] - w.mid[0]) * w.n[0] + (c[1] - w.mid[1]) * w.n[1];
      expect(along, `wall ${i + 1}`).toBeGreaterThan(0);
      expect(Math.hypot(c[0] - w.mid[0], c[1] - w.mid[1]), `wall ${i + 1}`).toBeLessThan(80);
    });
  });

  it('the outward normal of a notch wall points into the notch, not away from the room centre', () => {
    const poly: V[] = [[0, 0], [100, 0], [100, 100], [60, 100], [60, 40], [40, 40], [40, 100], [0, 100]]; // a U opening downwards (y down)
    const wall = (i: number) => outwardNormal(poly[i]!, poly[(i + 1) % poly.length]!, poly);
    const is = (n: V, x: number, y: number) => { expect(n[0]).toBeCloseTo(x, 6); expect(n[1]).toBeCloseTo(y, 6); };
    is(wall(0), 0, -1); // the top edge looks up
    is(wall(4), 0, 1); // the notch's ceiling looks down, into the notch
    const left = wall(5);
    expect(left[0]).toBeCloseTo(1, 6); // the notch's left wall (x = 40) has the left arm's floor behind it, so it looks right, into the notch
    is(wall(1), 1, 0); // the right side of the room (x = 100) looks right
    expect(inside([50, 50], poly)).toBe(false);
  });

  it('is deterministic', () => {
    const a = layoutOutline(outline(SHAPES.screenshot!), 520, 426, BOX.w, BOX.h), b = layoutOutline(outline(SHAPES.screenshot!), 520, 426, BOX.w, BOX.h);
    expect(b.boxes).toEqual(a.boxes);
  });
});
