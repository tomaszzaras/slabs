import { describe, expect, it } from 'vitest';
import { buildModel, computeCut, DEFAULT_ALLOWANCES, DEFAULT_REQUEST, isAttic, ROOM_IDS, ROOMS, roomPieces, type RoomId } from '@slabs/core';
import { sharedPlateMarks } from './platemarks';
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

describe('waste marks', () => {
  it('windows and cut-outs are holes: paper fill, outline, and the X is clipped to the polygon', () => {
    const m = buildModel('salon', {});
    if (!isAttic(m)) throw new Error('attic expected');
    const svg = surfaceMarks(m, m.walls.find((w) => w.z === 0)!.rid, 'S', opts())!.svg;
    expect(svg).toContain('class="mk-hole"');
    expect(svg).toMatch(/<clipPath id="cp-[^"]+"><polygon/);
    expect(svg).toMatch(/clip-path="url\(#cp-/);
  });
  it('slivers are drawn at least 6 px thick with an X, and their label stays inside the drawing', () => {
    const m = buildModel('salon', {});
    for (const s of surfaceList(m, 10, 499).filter((x) => x.slivers > 0)) {
      for (const sc of [0.3, 0.6, 1]) {
        const d = surfaceMarks(m, s.key, 'S', opts({ scale: sc }))!;
        expect(d.svg).toContain('mk-sliver');
        for (const r of d.svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)" class="mk-sliver"/g)) {
          expect(Math.min(Number(r[3]), Number(r[4]))).toBeGreaterThanOrEqual(6 - 0.05);
        }
        for (const t of d.svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)" class="mk-warn" text-anchor="(\w+)">([^<]*)</g)) {
          const x = Number(t[1]), w = t[4]!.length * 7;
          const x0 = t[3] === 'end' ? x - w : t[3] === 'start' ? x : x - w / 2;
          expect(x0, `${s.ref} scale ${sc}`).toBeGreaterThanOrEqual(-1);
          expect(x0 + w, `${s.ref} scale ${sc}`).toBeLessThanOrEqual(d.w + 1);
        }
      }
    }
  });
});

describe('shared-cut plates with marks', () => {
  const settings = { kerf: 0.3, trim: 0, minOffcut: 10, guillotine: false };
  const R = computeCut({
    ...DEFAULT_REQUEST, settings, allowances: DEFAULT_ALLOWANCES, maxIters: 40, timeMs: Infinity,
    rooms: ROOM_IDS.map((id) => { const m = buildModel(id, {}); return { key: ROOMS[id].key, name: id, on: true, PL: m.p.PL!, PW: m.p.PW!, pieces: roomPieces(m) }; }),
  });
  const svgs = sharedPlateMarks(R, 10, 10, { scale: 0.7 });
  it('every plate has a face dot on its pieces and a pencil X on its offcuts', () => {
    expect(svgs).toHaveLength(R.plates.length);
    expect(svgs.filter((v) => v.includes('mk-face-dot')).length).toBeGreaterThan(svgs.length / 2);
    expect(svgs.filter((v) => v.includes('mk-x')).length).toBeGreaterThan(svgs.length / 2);
    svgs.forEach((v) => expect(v).toMatch(/width="\d+" height="\d+"/));
  });
  it('labels on a plate never overlap each other or leave the drawing', () => {
    svgs.forEach((v, i) => {
      const W = Number(/width="(\d+)"/.exec(v)![1]), H = Number(/height="(\d+)"/.exec(v)![1]);
      const boxes = [...v.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)" class="(mk-num|mk-fig mk-bold|mk-fig|mk-note)" text-anchor="middle">([^<]*)</g)].map((t) => {
        const size = t[3] === 'mk-num' ? 18 : 12, w = t[4]!.length * size * 0.5, x = Number(t[1]), y = Number(t[2]);
        return { x: x - w / 2, y: y - size * 0.8, w, h: size };
      });
      boxes.forEach((b, j) => {
        expect(b.x, `plate ${i + 1}`).toBeGreaterThanOrEqual(-1);
        expect(b.x + b.w, `plate ${i + 1}`).toBeLessThanOrEqual(W + 1);
        expect(b.y + b.h, `plate ${i + 1}`).toBeLessThanOrEqual(H + 1);
        for (let k = j + 1; k < boxes.length; k++) {
          const c = boxes[k]!;
          const overlap = b.x < c.x + c.w - 0.5 && b.x + b.w > c.x + 0.5 && b.y < c.y + c.h - 0.5 && b.y + b.h > c.y + 0.5;
          expect(overlap, `plate ${i + 1}: label ${j} vs ${k}`).toBe(false);
        }
      });
    });
  });
  it('plates are drawn at 1 unit = 1 px, so the 12 px text is never scaled down', () => {
    svgs.forEach((v) => {
      const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(v)!, wh = /width="(\d+)" height="(\d+)"/.exec(v)!;
      expect([vb[1], vb[2]]).toEqual([wh[1], wh[2]]);
    });
  });
});
