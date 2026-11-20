import { describe, expect, it } from 'vitest';
import { loadGolden, subsetDiff } from './golden';
import { buildModel, normalize, roomPieces, shelfPlan, ROOM_IDS, ROOMS, type RoomId } from './rooms';
import { computeCut, normPiece, NO_ALLOWANCES, NO_SETTINGS, type CutRequest } from './nest';
import type { Piece } from './types';

interface RoomGolden {
  defaults: Record<string, number>;
  cases: Array<{
    name: string; input: Record<string, number>; norm: { p: Record<string, number>; w: string[] }; model: Record<string, unknown>; pieces: Piece[];
    shelf: Array<{ area: number; use: number; items: Array<{ x: number; y: number; ids: number[]; kind: string }> }>;
  }>;
}

const SLUG: Record<RoomId, string> = { salon: 'salon', sypialnia: 'sypialnia', 'lazienka-1': 'lazienka-1', 'lazienka-2': 'lazienka-2' };

/** The artifact's salon emits trapezoids with `peak`; the shared cut converts them. Compare in the converted form. */
function normGolden(p: Piece & { peak?: unknown }): Piece {
  const q = { ...p } as Piece & { peak?: unknown };
  normPiece(q as Piece & { peak?: { t: number; h: number } | null });
  delete q.peak;
  return q;
}

for (const id of ROOM_IDS) {
  const g = loadGolden<RoomGolden>(SLUG[id]);
  describe(`parity: ${id} (${g.cases.length} cases)`, () => {
    it('defaults equal the artifact defaults', () => {
      expect(ROOMS[id].defaults).toEqual(g.defaults);
    });
    for (const c of g.cases) {
      describe(c.name, () => {
        it('norm: clamped params and warnings', () => {
          const n = normalize(id, c.input);
          expect(n.w).toEqual(c.norm.w);
          expect(subsetDiff(c.norm.p, n.p)).toBeNull();
        });
        it('model: surfaces, walls, reference points, area', () => {
          const m = buildModel(id, c.input);
          expect(subsetDiff(c.model, m)).toBeNull();
          expect(Math.abs(m.areaCm2 - (c.model.areaCm2 as number))).toBeLessThan(0.01);
        });
        it('pieces', () => {
          const pcs = roomPieces(buildModel(id, c.input));
          expect(pcs.length).toBe(c.pieces.length);
          expect(subsetDiff(c.pieces.map(normGolden), pcs)).toBeNull();
        });
        it('per-room shelf packing', () => {
          const plates = shelfPlan(buildModel(id, c.input));
          expect(plates.length).toBe(c.shelf.length);
          plates.forEach((pl, i) => {
            expect(Math.abs(pl.area - c.shelf[i]!.area)).toBeLessThan(0.01);
            expect(subsetDiff(c.shelf[i]!.items, pl.items.map((it) => ({ x: it.x, y: it.y, ids: it.p.ids, kind: it.p.kind })))).toBeNull();
          });
        });
      });
    }
  });
}

interface SharedGolden {
  cases: Array<{
    name: string;
    config: { rooms: Record<string, { on: number; PL: number; PW: number; pieces: Piece[] }>; band: { len: number; h: number; min: number; max: number; use: number }; price: number; split: number };
    result: {
      PL: number; PW: number; warn: string[]; roomPlates: number; extraPlates: number; segs: number[]; fromOff: number; bandLen: number; bandH: number; bandAlone: number; netto: number;
      per: Array<{ key: string; n: number; area: number; alone: number }>;
      plates: Array<{ extra: boolean; area: number; use: number; items: Array<{ p: Piece; x: number; y: number }> }>;
    };
  }>;
}
const KEYS = ['S', 'Sy', 'Ł1', 'Ł2'];
const NAMES: Record<string, string> = { S: 'Salon', Sy: 'Sypialnia', 'Ł1': 'Łazienka 1', 'Ł2': 'Łazienka 2' };

describe('parity: shared cut (kerf 0, no trim, no allowances)', () => {
  const sg = loadGolden<SharedGolden>('shared');
  for (const c of sg.cases) {
    it(c.name, () => {
      const req: CutRequest = {
        rooms: KEYS.map((k) => ({ key: k, name: NAMES[k]!, on: !!c.config.rooms[k]!.on, PL: c.config.rooms[k]!.PL, PW: c.config.rooms[k]!.PW, pieces: c.config.rooms[k]!.pieces.map((p) => normPiece({ ...p } as Piece)) })),
        band: c.config.band, splitAtBends: !!c.config.split, seed: 20260, maxIters: 2000, timeMs: Infinity, settings: NO_SETTINGS, allowances: NO_ALLOWANCES, price: c.config.price,
      };
      const r = computeCut(req);
      const e = c.result;
      expect(r.warn).toEqual(e.warn);
      expect(r.plates.length).toBe(e.plates.length);
      expect(r.roomPlates).toBe(e.roomPlates);
      expect(r.extraPlates).toBe(e.extraPlates);
      expect(r.per.map((p) => p.alone)).toEqual(e.per.map((p) => p.alone));
      expect(r.per.map((p) => p.n)).toEqual(e.per.map((p) => p.n));
      expect(subsetDiff(e.segs, r.segs)).toBeNull();
      expect(Math.abs(r.fromOff - e.fromOff)).toBeLessThan(1e-6);
      expect(Math.abs(r.netto - e.netto)).toBeLessThan(0.01);
      expect(r.bandAlone).toBe(e.bandAlone);
      // utilisation per plate and every placement
      r.plates.forEach((pl, i) => {
        const ep = e.plates[i]!;
        expect(Math.abs(pl.use - ep.use)).toBeLessThan(1e-9);
        expect(Math.abs(pl.area - ep.area)).toBeLessThan(0.01);
        expect(pl.items.length).toBe(ep.items.length);
        const mine = pl.items.map((it) => ({ x: it.x, y: it.y, ids: it.p.ids, l: it.p.l, w: it.p.w, kind: it.p.kind }));
        expect(subsetDiff(ep.items.map((it) => ({ x: it.x, y: it.y, ids: it.p.ids, l: it.p.l, w: it.p.w, kind: it.p.kind })), mine)).toBeNull();
      });
      // overall utilisation as the artifact shows it
      const util = Math.round((e.netto / (e.plates.length * e.PL * e.PW)) * 100);
      expect(Math.round(r.stats.utilisation * 100)).toBe(util);
    });
  }
});
