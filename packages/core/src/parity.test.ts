import { describe, expect, it } from 'vitest';
import { KNOWN_ARTIFACT_BUG, KNOWN_SHARED_BUG, REASON, loadGolden, subsetDiff } from './golden';
import { buildModel, normalize, roomPieces, shelfPlan, ROOM_IDS, ROOMS, type RoomId } from './rooms';
import { pieceArea } from './shelf';
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
        const bug = (KNOWN_ARTIFACT_BUG[id] ?? []).includes(c.name);
        const overflow = c.pieces.some((p) => p.l > c.norm.p.PL! + 1e-6 || p.w > c.norm.p.PW! + 1e-6);
        it('golden case is marked as artifact bug exactly when the artifact overflows the plate', () => { expect(bug).toBe(overflow); });
        it(bug ? `pieces (${REASON}; corrected behaviour asserted)` : 'pieces', () => {
          const pcs = roomPieces(buildModel(id, c.input));
          const gold = c.pieces.map(normGolden);
          if (!bug) {
            expect(pcs.length).toBe(c.pieces.length);
            expect(subsetDiff(gold, pcs)).toBeNull();
            return;
          }
          const PL = c.norm.p.PL!, PW = c.norm.p.PW!;
          // nothing sticks out any more, and the total area is the artifact's
          pcs.forEach((p) => { expect(p.l).toBeLessThanOrEqual(PL + 1e-6); expect(p.w).toBeLessThanOrEqual(PW + 1e-6); });
          expect(Math.abs(pcs.reduce((a, p) => a + pieceArea(p), 0) - gold.reduce((a, p) => a + pieceArea(p), 0))).toBeLessThan(0.01);
          // pieces that were valid in the artifact are unchanged, in order
          const valid = gold.filter((p) => p.l <= PL + 1e-6);
          const kept = pcs.filter((p) => !p.splits?.length);
          expect(subsetDiff(valid, kept)).toBeNull();
          // every oversize strip became parts with a recorded split line
          const parts = pcs.filter((p) => p.splits?.length);
          expect(parts.length).toBeGreaterThanOrEqual(2 * gold.filter((p) => p.l > PL + 1e-6).length);
        });
        it(bug ? `per-room shelf packing (${REASON}; corrected behaviour asserted)` : 'per-room shelf packing', () => {
          const plates = shelfPlan(buildModel(id, c.input));
          if (!bug) {
            expect(plates.length).toBe(c.shelf.length);
            plates.forEach((pl, i) => {
              expect(Math.abs(pl.area - c.shelf[i]!.area)).toBeLessThan(0.01);
              expect(subsetDiff(c.shelf[i]!.items, pl.items.map((it) => ({ x: it.x, y: it.y, ids: it.p.ids, kind: it.p.kind })))).toBeNull();
            });
            return;
          }
          const PL = c.norm.p.PL!, PW = c.norm.p.PW!;
          plates.forEach((pl) => { expect(pl.use).toBeLessThanOrEqual(1 + 1e-9); expect(pl.area).toBeLessThanOrEqual(PL * PW + 1e-6); });
          expect(Math.abs(plates.reduce((a, pl) => a + pl.area, 0) - c.shelf.reduce((a, pl) => a + pl.area, 0))).toBeLessThan(0.01);
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
    const bug = KNOWN_SHARED_BUG.includes(c.name);
    it(bug ? `${c.name} (${REASON}; corrected behaviour asserted)` : c.name, () => {
      const req: CutRequest = {
        rooms: KEYS.map((k) => ({ key: k, name: NAMES[k]!, on: !!c.config.rooms[k]!.on, PL: c.config.rooms[k]!.PL, PW: c.config.rooms[k]!.PW, pieces: c.config.rooms[k]!.pieces.map((p) => normPiece({ ...p } as Piece)) })),
        band: c.config.band, splitAtBends: !!c.config.split, seed: 20260, maxIters: 2000, timeMs: Infinity, settings: NO_SETTINGS, allowances: NO_ALLOWANCES, price: c.config.price,
      };
      const r = computeCut(req);
      const e = c.result;
      const overflow = Object.values(c.config.rooms).some((rm) => rm.on && rm.pieces.some((p) => p.l > rm.PL + 1e-6));
      expect(bug).toBe(overflow);
      if (bug) {
        expect(r.warn).toEqual(e.warn);
        expect(r.blocking).toEqual([]);
        expect(r.splitCount).toBeGreaterThan(0);
        expect(Math.abs(r.netto - e.netto)).toBeLessThan(0.01); // splitting keeps the area
        expect(r.bandAlone).toBe(e.bandAlone);
        r.plates.forEach((pl) => {
          expect(pl.use).toBeLessThanOrEqual(1 + 1e-9);
          pl.items.forEach((it) => { expect(it.x + it.p.l).toBeLessThanOrEqual(r.PL + 1e-6); expect(it.y + it.p.w).toBeLessThanOrEqual(r.PW + 1e-6); });
        });
        expect(r.stats.utilisation).toBeLessThanOrEqual(1);
        return;
      }
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
