import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildModel, computeCut, normPiece, NO_ALLOWANCES, NO_SETTINGS, ROOM_IDS, shelfPlan, type CutRequest, type Piece, type RoomId } from '@slabs/core';
import { KNOWN_ARTIFACT_BUG, REASON, loadGolden } from '../../core/src/golden';
import { plateSvg, sharedSheets, sheetSvgs, svgBoards, svgGables, svgPlan } from './index';

const sha = (s: string) => crypto.createHash('sha1').update(s).digest('hex');

interface RoomGolden {
  cases: Array<{
    name: string; input: Record<string, number>;
    svg: { plan: { w: number; h: number; sha: string }; boards: { w: number; h: number; sha: string }; gables: { w: number; h: number; sha: string }; sheets: string[] };
    svgText?: { plan: string; boards: string; gables: string; sheets: string[] };
  }>;
}

for (const id of ROOM_IDS) {
  const g = loadGolden<RoomGolden>(id);
  describe(`render parity: ${id}`, () => {
    for (const c of g.cases) {
      const bug = (KNOWN_ARTIFACT_BUG[id] ?? []).includes(c.name);
      it(`${c.name}: plan, boards, gables${bug ? '' : ' and sheets'} are character-for-character the artifact's SVG`, () => {
        const m = buildModel(id as RoomId, c.input);
        for (const [k, fn] of [['plan', svgPlan], ['boards', svgBoards], ['gables', svgGables]] as const) {
          const d = fn(m);
          expect(sha(d.svg), `${id} ${c.name} ${k}`).toBe(c.svg[k].sha);
          expect(Math.abs(d.w - c.svg[k].w)).toBeLessThan(1e-6);
          expect(Math.abs(d.h - c.svg[k].h)).toBeLessThan(1e-6);
        }
        const sheets = sheetSvgs(m, shelfPlan(m));
        if (bug) return; // sheets: see the next test
        expect(sheets.map(sha)).toEqual(c.svg.sheets);
        if (c.svgText) {
          expect(svgPlan(m).svg).toBe(c.svgText.plan);
          expect(svgBoards(m).svg).toBe(c.svgText.boards);
          expect(svgGables(m).svg).toBe(c.svgText.gables);
          expect(sheets).toEqual(c.svgText.sheets);
        }
      });
    }
  });

  for (const c of g.cases.filter((x) => (KNOWN_ARTIFACT_BUG[id] ?? []).includes(x.name))) {
    it(`${c.name}: sheets (${REASON}; corrected behaviour asserted)`, () => {
      const m = buildModel(id as RoomId, c.input);
      const sheets = sheetSvgs(m, shelfPlan(m));
      expect(sheets.length).toBeGreaterThan(0);
      // no piece is drawn outside its plate: the sheet's viewBox is the plate, and the artifact's was exceeded
      const PL = m.p.PL!, PW = m.p.PW!;
      shelfPlan(m).forEach((pl) => pl.items.forEach((it) => { expect(it.x + it.p.l).toBeLessThanOrEqual(PL + 1e-6); expect(it.y + it.p.w).toBeLessThanOrEqual(PW + 1e-6); }));
    });
  }

  describe(`snapshot: ${id} defaults`, () => {
    const m = buildModel(id, {});
    it('plan', () => { expect(svgPlan(m).svg).toMatchSnapshot(); });
    it('boards', () => { expect(svgBoards(m).svg).toMatchSnapshot(); });
    it('gables', () => { expect(svgGables(m).svg).toMatchSnapshot(); });
    it('first sheet', () => { expect(sheetSvgs(m, shelfPlan(m))[0]).toMatchSnapshot(); });
  });
}

interface SharedGolden {
  cases: Array<{
    name: string;
    config: { rooms: Record<string, { on: number; PL: number; PW: number; pieces: Piece[] }>; band: CutRequest['band']; price: number; split: number };
    result: { plates: Array<{ svgSha: string }> };
  }>;
}
const NAMES: Record<string, string> = { S: 'Salon', Sy: 'Sypialnia', 'Ł1': 'Łazienka 1', 'Ł2': 'Łazienka 2' };

describe('render parity: shared cut plates', () => {
  const sg = loadGolden<SharedGolden>('shared');
  for (const c of sg.cases.slice(0, 8)) {
    it(c.name, () => {
      const req: CutRequest = {
        rooms: Object.keys(NAMES).map((k) => ({ key: k, name: NAMES[k]!, on: !!c.config.rooms[k]!.on, PL: c.config.rooms[k]!.PL, PW: c.config.rooms[k]!.PW, pieces: c.config.rooms[k]!.pieces.map((p) => normPiece({ ...p } as Piece)) })),
        band: c.config.band, splitAtBends: !!c.config.split, seed: 20260, maxIters: 2000, timeMs: Infinity, settings: NO_SETTINGS, allowances: NO_ALLOWANCES, price: c.config.price,
      };
      const r = computeCut(req);
      expect(r.plates.map((pl, i) => sha(plateSvg(pl, i, r).g))).toEqual(c.result.plates.map((p) => p.svgSha));
      expect(sharedSheets(r)).toHaveLength(r.plates.length);
    });
  }
});
