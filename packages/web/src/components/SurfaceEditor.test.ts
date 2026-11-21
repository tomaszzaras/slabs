import { describe, expect, it } from 'vitest';
import { buildModel, isAttic } from '@slabs/core';
import { surfaceMarks } from '@slabs/render';
import { edgeShifts, snapShift } from './SurfaceEditor';

const o = { scale: 0.6, minStrip: 10, plateLen: 499 };

describe('start point handle', () => {
  it('is given for every surface and its base + value is the anchor of the joint grid', () => {
    const m = buildModel('salon', { o1: 12, o6: -7 });
    for (const key of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const d = surfaceMarks(m, key, 'S', o)!;
      expect(d.start, `R${key}`).toBeTruthy();
      expect(d.start!.param).toBe('o' + key);
      const surf = m.surfs.find((s) => s.key === key), wall = isAttic(m) ? m.walls.find((w) => w.rid === key) : undefined;
      expect(d.start!.base + d.start!.value).toBeCloseTo((surf ? surf.anchor : wall!.anchor), 9);
    }
  });
  it('dragging to a shift equals typing that shift: same model', () => {
    const typed = buildModel('salon', { o3: 20 });
    const base = surfaceMarks(buildModel('salon', {}), 3, 'S', o)!.start!;
    const dragged = buildModel('salon', { o3: snapShift(base, 20.2, false) });
    expect(dragged.surfs.find((s) => s.key === 3)!.anchor).toBe(typed.surfs.find((s) => s.key === 3)!.anchor);
  });
  it('snaps to whole cm, Shift gives tenths, and a joint magnet puts a joint on a surface edge', () => {
    const h = surfaceMarks(buildModel('sypialnia', {}), 1, 'Sy', o)!.start!;
    const far = 1000 / h.perCm; // never near an edge candidate by accident
    expect(snapShift({ ...h, edges: [] }, 7.4, false)).toBe(7);
    expect(snapShift({ ...h, edges: [] }, 7.46, true)).toBe(7.5);
    const cand = edgeShifts(h, 0)[0]!;
    expect(snapShift(h, cand + 2 / h.perCm, false)).toBeCloseTo(Math.round(cand * 10) / 10, 5);
    expect(far).toBeGreaterThan(0);
  });
  it('shift stays inside the allowed range', () => {
    const h = surfaceMarks(buildModel('salon', {}), 1, 'S', o)!.start!;
    expect(snapShift({ ...h, edges: [] }, 5000, false)).toBe(1000);
    expect(snapShift({ ...h, edges: [] }, -5000, false)).toBe(-1000);
  });
  it('the flat-ceiling room offers typed measurements; the first and last field widths are reported', () => {
    const d = surfaceMarks(buildModel('lazienka-2', {}), 1, 'Ł2', o)!;
    expect(d.measures!.map((m) => m.param)).toEqual(['hb', 'bx', 'hb', 'bz']);
    expect(d.start!.firstW + 0).toBeGreaterThan(0);
  });
});
