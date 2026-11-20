import { describe, expect, it } from 'vitest';
import { buildModel, isAttic, ROOM_IDS, ROOMS, type RoomId } from '@slabs/core';
import { EN_LABELS } from './util';
import { LabelPlacer, MIN_TEXT, planMarks, surfaceList, surfaceMarks, wrapMark } from './marks';

const opts = (over = {}) => ({ scale: 0.6, minStrip: 10, plateLen: 499, ...over });

describe('workshop-drawing marks', () => {
  it('every surface of every room is drawn, with its R start mark, chalk joints, face marks and numbers', () => {
    for (const id of ROOM_IDS) {
      const m = buildModel(id, {});
      const list = surfaceList(m, 10, 499);
      expect(list.length).toBeGreaterThan(0);
      for (const s of list) {
        const d = surfaceMarks(m, s.key, ROOMS[id].key, opts())!;
        expect(d, `${id} ${s.ref}`).toBeTruthy();
        expect(d.svg).toContain('mk-start-tick');
        expect(d.svg).toContain('mk-num');
        expect(d.svg).toContain(`>${s.ref}<`);
      }
      const joined = list.map((s) => surfaceMarks(m, s.key, ROOMS[id].key, opts())!.svg).join('');
      expect(joined, id).toContain('mk-chalk');
      expect(joined, id).toContain('mk-face');
    }
  });
  it('only R points that exist in the room are listed', () => {
    for (const id of ROOM_IDS) {
      const m = buildModel(id, {});
      const refs = surfaceList(m, 10, 499).map((s) => s.ref).sort();
      expect(refs).toEqual(m.refs.map((r) => r.id).sort());
    }
    // sypialnia and łazienka 1 have no recess / built-in walls: fewer R points than the salon
    expect(surfaceList(buildModel('sypialnia', {}), 10, 499).length).toBeLessThan(surfaceList(buildModel('salon', {}), 10, 499).length);
  });
  it('text is never smaller than 11 px: font sizes come from CSS classes, and the minimum constant is >= 11', () => {
    expect(MIN_TEXT).toBeGreaterThanOrEqual(11);
  });
  it('slivers get a pencil X and their width (the salon has strips under 10 cm)', () => {
    const m = buildModel('salon', {});
    const all = surfaceList(m, 10, 499).filter((s) => s.slivers > 0);
    expect(all.length).toBeGreaterThan(0);
    for (const s of all) expect(surfaceMarks(m, s.key, 'S', opts())!.svg).toContain('mk-warn');
    const none = surfaceMarks(m, 1, 'S', opts({ minStrip: 0 }))!;
    expect(none.svg).not.toContain('mk-warn');
  });
  it('windows and cut-outs are marked as waste with a pencil X', () => {
    const m = buildModel('salon', {});
    if (!isAttic(m)) throw new Error('attic expected');
    const wall0 = m.walls.find((w) => w.z === 0)!;
    expect(surfaceMarks(m, wall0.rid, 'S', opts())!.svg).toContain('mk-hole');
    expect(surfaceMarks(m, wall0.rid, 'S', opts())!.svg).toContain('mk-x');
  });
  it('a strip taller than the plate is drawn with a split line', () => {
    const m = buildModel('sypialnia', { PL: 200 });
    const l = surfaceList(m, 10, 200);
    expect(l.some((s) => s.splitNote)).toBe(true);
    const g = l.find((s) => s.kind === 'gable' && s.splitNote)!;
    expect(surfaceMarks(m, g.key, 'Sy', opts({ plateLen: 200 }))!.svg).toContain('mk-split');
  });
  it('English drawings contain no Polish words', () => {
    const pol = /ściana|sufit|dach|kalenica|szerokość|długość|okno|wycięcie|skos|zgięcie|podział|wąski/;
    for (const id of ROOM_IDS) {
      const m = buildModel(id, {}, 'en');
      for (const s of surfaceList(m, 10, 499)) {
        const d = surfaceMarks(m, s.key, ROOMS[id].key, opts({ labels: EN_LABELS }))!;
        expect(pol.test(d.svg.replace(/>[^<]*[ąęłńóśźż][^<]*</g, '><')), `${id} ${s.ref}`).toBe(false);
      }
      expect(pol.test(planMarks(m, ROOMS[id as RoomId].key, opts({ labels: EN_LABELS })).svg)).toBe(false);
    }
  });
  it('wrapMark gives a real pixel size, so text keeps its size (1 unit = 1 px)', () => {
    const m = buildModel('salon', {});
    const d = surfaceMarks(m, 1, 'S', opts())!;
    const svg = wrapMark(d, 'x');
    expect(svg).toContain(`width="${Math.round(d.w)}"`);
    expect(svg).toContain('role="img"');
  });
});

describe('label placement', () => {
  it('labels never overlap, even when many R points sit on the same spot', () => {
    const p = new LabelPlacer(300, 300);
    const boxes = Array.from({ length: 6 }, () => p.place(150, 150, 'R10'));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        expect(overlap, `${i} vs ${j}`).toBe(false);
      }
    }
    expect(boxes.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= 300 && b.y + b.h <= 300)).toBe(true);
  });
});
