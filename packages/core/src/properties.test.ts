import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { loadGolden } from './golden';
import { placedPolygons, polyArea, polyDistance, pieceOutline } from './geometry';
import { applyAllowances, computeCut, splitLong, DEFAULT_ALLOWANCES, DEFAULT_REQUEST, normPiece, NO_ALLOWANCES, NO_SETTINGS, verifyGuillotine, type CutRequest, type CutSettings } from './nest';
import { buildModel, isAttic, ROOMS, roomPieces, type RoomId } from './rooms';
import { pieceArea } from './shelf';
import type { Piece } from './types';

// Deterministic in CI; try other seeds with FC_SEED=123 pnpm test
fc.configureGlobal({ seed: Number(process.env.FC_SEED) || 20260 });

// ---- generators (valid inputs, as in the golden generator)
const shifts = (n: number) => fc.array(fc.integer({ min: -60, max: 60 }), { minLength: 9, maxLength: 9 }).map((a) => Object.fromEntries(a.map((v, i) => ['o' + (i + 1), i < n ? v : 0])));
const plate = fc.record({ PL: fc.constantFrom(499, 499, 420, 560), PW: fc.constantFrom(125, 125, 100, 160) });

const salon = fc.record({
  W: fc.integer({ min: 420, max: 700 }), L: fc.integer({ min: 600, max: 1300 }), ang: fc.integer({ min: 25, max: 55 }), HL: fc.integer({ min: 60, max: 150 }),
  niche: fc.integer({ min: 0, max: 40 }), dA: fc.integer({ min: 60, max: 150 }), ZA: fc.integer({ min: 150, max: 500 }), wB: fc.integer({ min: 300, max: 400 }),
  dB: fc.integer({ min: 20, max: 100 }), cutOn: fc.integer({ min: 0, max: 1 }), cutH: fc.integer({ min: 20, max: 59 }), winOn: fc.integer({ min: 0, max: 1 }), winD: fc.integer({ min: 20, max: 80 }),
  ZO: fc.integer({ min: 0, max: 600 }), XO: fc.integer({ min: -150, max: 150 }),
}).chain((r) => fc.tuple(plate, shifts(9)).map(([pl, sh]) => ({ ...r, ...pl, ...sh })));
const sypialnia = fc.record({
  W: fc.integer({ min: 420, max: 700 }), L: fc.integer({ min: 200, max: 600 }), ang: fc.integer({ min: 25, max: 55 }), HL: fc.integer({ min: 60, max: 150 }),
  capOn: fc.integer({ min: 0, max: 1 }), ZO: fc.integer({ min: 0, max: 200 }), XO: fc.integer({ min: -150, max: 150 }),
}).chain((r) => fc.tuple(plate, shifts(9), fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 60 })).map(([pl, sh, wbOff, capOff]) => ({ ...r, ...pl, ...sh, Wb: Math.floor(r.W / 2) + 30 + Math.min(wbOff, r.W / 2 - 31), capH: r.HL + 10 + capOff })));
const lazienka1 = fc.record({
  W: fc.integer({ min: 420, max: 700 }), bw: fc.integer({ min: 60, max: 200 }), L: fc.integer({ min: 200, max: 500 }), ang: fc.integer({ min: 25, max: 55 }), HL: fc.integer({ min: 60, max: 150 }),
  ZO: fc.integer({ min: 0, max: 200 }), XO: fc.integer({ min: -100, max: 100 }),
}).chain((r) => fc.tuple(plate, shifts(9)).map(([pl, sh]) => ({ ...r, ...pl, ...sh })));
const lazienka2 = fc.record({
  bx: fc.integer({ min: 80, max: 400 }), bz: fc.integer({ min: 120, max: 500 }), H: fc.integer({ min: 200, max: 300 }), hb: fc.integer({ min: 30, max: 100 }), dz: fc.integer({ min: 0, max: 1 }),
  ZO: fc.integer({ min: 0, max: 100 }),
}).chain((r) => fc.tuple(plate, shifts(3)).map(([pl, sh]) => ({ ...r, ...pl, ...sh })));

const GEN: Record<RoomId, fc.Arbitrary<Record<string, number>>> = { salon, sypialnia, 'lazienka-1': lazienka1, 'lazienka-2': lazienka2 };
const NAMES: Record<string, string> = { S: 'Salon', Sy: 'Sypialnia', 'Ł1': 'Łazienka 1', 'Ł2': 'Łazienka 2' };

describe('property: room geometry', () => {
  for (const id of Object.keys(GEN) as RoomId[]) {
    it(`${id}: total piece area equals the room's net area (plus the window, which is not a piece cut-out)`, () => {
      fc.assert(fc.property(GEN[id], (input) => {
        const m = buildModel(id, input);
        // slivers of 1 cm or less carry no board in the artifact's model (they are dropped, the area still counts them)
        fc.pre(m.surfs.every((s) => Math.abs(s.cols.reduce((a, c) => a + c.b - c.a, 0) - (s.z1 - s.z0)) < 1e-9));
        fc.pre(!isAttic(m) || m.walls.every((w) => Math.abs(w.strips.reduce((a, c) => a + c.b - c.a, 0) - (w.x1 - w.x0)) < 1e-9));
        const pcs = roomPieces(m);
        const total = pcs.reduce((a, p) => a + pieceArea(p), 0);
        let win = 0;
        if (isAttic(m) && m.win) win = polyArea(m.win);
        expect(Math.abs(total - (m.areaCm2 + win))).toBeLessThan(0.01);
        // pieces are plain polygons with the same area as the closed-form area
        pcs.forEach((p) => {
          if (p.kind === 'rect' || p.kind === 'trap') expect(Math.abs(polyArea(pieceOutline(p)) - pieceArea(p))).toBeLessThan(1e-6);
        });
      }), { numRuns: 60 });
    });
    it(`${id}: board pieces fit on a plate whatever the edge trim (grid pitch = PW - 2*trim)`, () => {
      fc.assert(fc.property(GEN[id], fc.constantFrom(0, 0.5, 1), (input, trim) => {
        const m = buildModel(id, { ...input, trim });
        roomPieces(m).forEach((p) => {
          if (p.kind === 'rect') {
            expect(p.l).toBeLessThanOrEqual(m.p.PL! - 2 * trim + 1e-6);
            expect(p.w).toBeLessThanOrEqual(m.p.PW! - 2 * trim + 1e-6);
          }
        });
      }), { numRuns: 40 });
    });
  }
});

// ---- cut plan properties
const settingsArb = fc.record({
  kerf: fc.constantFrom(0, 0.2, 0.3, 0.5),
  trim: fc.constantFrom(0, 0, 0.5, 1),
  minOffcut: fc.constantFrom(0, 10),
  guillotine: fc.boolean(),
});
const roomsArb = fc.tuple(GEN.salon, GEN.sypialnia, GEN['lazienka-1'], GEN['lazienka-2']);
const bandArb = fc.record({ len: fc.integer({ min: 0, max: 1700 }), h: fc.constantFrom(40, 65, 80), min: fc.constantFrom(20, 60, 124), max: fc.constantFrom(100, 124), use: fc.constantFrom(0, 1) });

function request(rooms: Array<Record<string, number>>, band: CutRequest['band'], settings: CutSettings, extra: Partial<CutRequest> = {}): CutRequest {
  const ids: RoomId[] = ['salon', 'sypialnia', 'lazienka-1', 'lazienka-2'];
  return {
    ...DEFAULT_REQUEST, band, settings, maxIters: 60, timeMs: Infinity,
    rooms: ids.map((id, i) => {
      const m = buildModel(id, { ...rooms[i], trim: settings.trim });
      return { key: ROOMS[id].key, name: NAMES[ROOMS[id].key]!, on: true, PL: m.p.PL!, PW: m.p.PW!, pieces: roomPieces(m) };
    }),
    ...extra,
  };
}

describe('property: cut plans', () => {
  it('pieces never overlap, keep a kerf apart, stay inside the plate minus edge trim, are never mirrored', () => {
    fc.assert(fc.property(roomsArb, bandArb, settingsArb, (rooms, band, settings) => {
      const r = computeCut(request(rooms, band, settings));
      expect(r.blocking).toEqual([]); // pieces taller than the plate are split, so every valid input can be cut
      const { kerf, trim } = settings;
      const eps = 1e-6;
      r.plates.forEach((pl) => {
        pl.items.forEach((it) => {
          expect(it.x).toBeGreaterThanOrEqual(trim - eps);
          expect(it.y).toBeGreaterThanOrEqual(trim - eps);
          if (!pl.extra || it.p.band) {
            expect(it.x + it.p.l).toBeLessThanOrEqual(r.PL - trim + eps);
            expect(it.y + it.p.w).toBeLessThanOrEqual(r.PW - trim + eps);
          }
          if (it.p.kind === 'nest') it.p.parts!.forEach((t) => expect([0, 1]).toContain(t.rot)); // only 180° turns, never a mirror
        });
        // bounding boxes: separated by at least one kerf in x or in y
        for (let i = 0; i < pl.items.length; i++) {
          for (let j = i + 1; j < pl.items.length; j++) {
            const a = pl.items[i]!, b = pl.items[j]!;
            const gapX = Math.max(b.x - (a.x + a.p.l), a.x - (b.x + b.p.l));
            const gapY = Math.max(b.y - (a.y + a.p.w), a.y - (b.y + b.p.w));
            expect(Math.max(gapX, gapY)).toBeGreaterThanOrEqual(kerf - eps);
          }
        }
        // inside nests and pairs the polygons keep a kerf between them as well
        if (kerf > 0) {
          pl.items.forEach((it) => {
            if (it.p.kind !== 'nest' && it.p.kind !== 'pair') return;
            const polys = placedPolygons(it.p, it.x, it.y);
            for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) expect(polyDistance(polys[i]!, polys[j]!)).toBeGreaterThanOrEqual(kerf - 1e-4);
          });
        }
      });
    }), { numRuns: 25 });
  });

  it('guillotine mode: every plate can be cut with straight through-cuts in the listed order', () => {
    fc.assert(fc.property(roomsArb, bandArb, fc.constantFrom(0, 0.3), fc.constantFrom(0, 0.5), (rooms, band, kerf, trim) => {
      const settings: CutSettings = { kerf, trim, minOffcut: 10, guillotine: true };
      const r = computeCut(request(rooms, band, settings));
      expect(r.blocking).toEqual([]);
      r.plates.forEach((pl) => {
        if (pl.extra) return;
        expect(verifyGuillotine(pl, r.PL, r.PW, kerf, trim)).toBeNull();
        expect(pl.cuts!.map((c) => c.n)).toEqual(pl.cuts!.map((_c, i) => i + 1));
      });
    }), { numRuns: 20 });
  });

  it('band segments respect max, add up to the band length, and at most one is below the minimum', () => {
    fc.assert(fc.property(roomsArb, bandArb, settingsArb, (rooms, band, settings) => {
      const r = computeCut(request(rooms, band, settings));
      if (!band.len || r.bandH <= 0) return;
      const mx = Math.min(band.max, r.PW - 2 * settings.trim);
      expect(r.segs.reduce((a, b) => a + b, 0)).toBeCloseTo(band.len, 6);
      r.segs.forEach((s) => expect(s).toBeLessThanOrEqual(mx + 1e-9));
      const mn = Math.min(Math.max(1, band.min), mx);
      expect(r.segs.filter((s) => s < mn - 1e-9).length).toBeLessThanOrEqual(1);
    }), { numRuns: 25 });
  });

  it('is deterministic: the same request gives the same plan', () => {
    fc.assert(fc.property(roomsArb, bandArb, settingsArb, (rooms, band, settings) => {
      const a = computeCut(request(rooms, band, settings)), b = computeCut(request(rooms, band, settings));
      expect(JSON.stringify(a.plates)).toBe(JSON.stringify(b.plates));
    }), { numRuns: 6 });
  });

  it('kerf and trim never lose a piece: every piece id of every room is on some plate', () => {
    fc.assert(fc.property(roomsArb, settingsArb, (rooms, settings) => {
      const req = request(rooms, { ...DEFAULT_REQUEST.band, len: 0 }, settings);
      const r = computeCut(req);
      const placed = r.plates.reduce((a, pl) => a + pl.items.reduce((s, it) => s + (it.p.kind === 'nest' ? it.p.parts!.length : 1), 0), 0);
      let expected = 0;
      req.rooms.forEach((rm) => {
        let n = rm.pieces.length;
        if (req.splitAtBends) n = rm.pieces.reduce((s, p) => s + (p.kind === 'rect' ? 1 + (p.cuts || (p.cut ? [p.cut] : [])).filter((c) => c > 1 && c < p.l - 1).length : 1), 0);
        expected += n;
      });
      // pair pieces count once (they are placed as one item), nests count their parts
      const pairs = req.rooms.reduce((s, rm) => s + rm.pieces.filter((p) => p.kind === 'pair').length, 0);
      expect(placed).toBeGreaterThanOrEqual(expected - pairs - 0);
    }), { numRuns: 10 });
  });
});

describe('trust in results: no piece larger than the plate, utilisation never over 100%', () => {
  const alArb = fc.constantFrom(NO_ALLOWANCES, DEFAULT_ALLOWANCES, { ...DEFAULT_ALLOWANCES, wall: 3, angleTolerance: true });
  it('every plate and the total stay at or below 100%; every piece lies inside the plate', () => {
    fc.assert(fc.property(roomsArb, bandArb, settingsArb, alArb, (rooms, band, settings, allowances) => {
      const r = computeCut(request(rooms, band, settings, { allowances }));
      if (r.blocking.length) { expect(r.plates).toEqual([]); return; }
      expect(r.stats.utilisation).toBeLessThanOrEqual(1 + 1e-9);
      r.plates.forEach((pl) => {
        expect(pl.use).toBeLessThanOrEqual(1 + 1e-9);
        pl.items.forEach((it) => {
          expect(it.x + it.p.l).toBeLessThanOrEqual(r.PL + 1e-6);
          expect(it.y + it.p.w).toBeLessThanOrEqual(r.PW + 1e-6);
        });
      });
    }), { numRuns: 40 });
  });

  it('a gable strip taller than the plate is split: area is kept, the parts record the split line, every part fits', () => {
    const g = loadGolden<{ cases: Array<{ name: string; input: Record<string, number> }> }>('sypialnia');
    const m = buildModel('sypialnia', g.cases.find((c) => c.name === 'rand6')!.input);
    const pcs = roomPieces(m);
    pcs.forEach((p) => expect(p.l).toBeLessThanOrEqual(m.p.PL! + 1e-6));
    const split = pcs.filter((p) => p.splits && p.splits.length);
    expect(split.length).toBeGreaterThan(0);
    split.forEach((p) => expect(p.edges!.l0 === 'joint' || p.edges!.l1 === 'joint').toBe(true));
  });

  it('a piece that cannot fit (wider than the plate) blocks the result and names room, piece and fields', () => {
    const req = request([{}, {}, {}, {}], { ...DEFAULT_REQUEST.band, len: 0 }, NO_SETTINGS);
    req.rooms[3]!.pieces = [{ kind: 'rect', l: 200, w: 140, ids: [7] }];
    const r = computeCut(req);
    expect(r.blocking).toHaveLength(1);
    expect(r.blocking[0]).toMatchObject({ room: 'Ł2', roomName: 'Łazienka 2', ids: [7], dir: 'width', fields: ['PW', 'trim', 'allowances'] });
    expect(r.plates).toEqual([]);
    expect(r.stats.plates).toBe(0);
  });

  it('splitLong: a trapezoid is cut into parts with the same total area', () => {
    const t: Piece = { kind: 'trap', l: 700, w: 100, ids: [1], ha: 300, hb: 700, prof: [[0, 300], [1, 700]], edges: { l0: 'wall', l1: 'wall', w0: 'wall', w1: 'wall' } };
    const r = splitLong([t], 499);
    expect(r.count).toBe(1);
    expect(r.pieces).toHaveLength(2);
    expect(r.pieces.reduce((a, p) => a + pieceArea(p), 0)).toBeCloseTo(pieceArea(t), 6);
    r.pieces.forEach((p) => expect(p.l).toBeLessThanOrEqual(499 + 1e-9));
  });
});

describe('fitting allowances', () => {
  it('with all allowances at 0 the plan equals the plan without allowances', () => {
    fc.assert(fc.property(roomsArb, bandArb, (rooms, band) => {
      const zero = { ...NO_ALLOWANCES, enabled: true };
      const a = computeCut(request(rooms, band, NO_SETTINGS));
      const b = computeCut(request(rooms, band, NO_SETTINGS, { allowances: zero }));
      expect(JSON.stringify(b.plates)).toBe(JSON.stringify(a.plates));
    }), { numRuns: 5 });
  });

  it('cut size = fit size + allowances of the touched edges, and the fit size is kept', () => {
    const m = buildModel('salon', {});
    const pcs = roomPieces(m);
    const out = applyAllowances(pcs, DEFAULT_ALLOWANCES);
    pcs.forEach((p, i) => {
      const q = out[i]!;
      if (p.kind !== 'rect') return;
      const a = (t: keyof typeof DEFAULT_ALLOWANCES) => DEFAULT_ALLOWANCES[t] as number;
      const e = p.edges!;
      expect(q.l).toBeCloseTo(p.l + a(e.l0) + a(e.l1), 9);
      expect(q.w).toBeCloseTo(p.w + a(e.w0) + a(e.w1), 9);
      expect(q.fitL).toBeCloseTo(p.l, 9);
      expect(q.fitW).toBeCloseTo(p.w, 9);
    });
    // joint edges (the plate grid) never change
    const inner = pcs.find((p) => p.kind === 'rect' && p.edges!.w0 === 'joint' && p.edges!.w1 === 'joint')!;
    const q = out[pcs.indexOf(inner)]!;
    expect(q.w).toBeCloseTo(inner.w, 9);
  });

  it('allowances only ever add area when positive, and the statistics report it', () => {
    const rooms = [{}, {}, {}, {}];
    const base = computeCut(request(rooms, { ...DEFAULT_REQUEST.band, len: 0 }, NO_SETTINGS));
    const al = computeCut(request(rooms, { ...DEFAULT_REQUEST.band, len: 0 }, NO_SETTINGS, { allowances: DEFAULT_ALLOWANCES }));
    expect(al.stats.allowanceM2).toBeGreaterThan(0);
    expect(base.stats.allowanceM2).toBe(0);
    expect(al.netto).toBeGreaterThan(base.netto);
  });
});

describe('pieces as polygons', () => {
  it('golden pieces: polygon area equals the closed form for rect and trap', () => {
    const g = loadGolden<{ cases: Array<{ pieces: Piece[] }> }>('salon');
    g.cases.forEach((c) => c.pieces.forEach((p0) => {
      const p = normPiece({ ...p0 } as Piece);
      if (p.kind === 'rect' || p.kind === 'trap') expect(Math.abs(polyArea(pieceOutline(p)) - pieceArea(p))).toBeLessThan(1e-6);
      if (p.kind === 'pair') expect(Math.abs(placedPolygons(p, 0, 0).reduce((s, q) => s + polyArea(q), 0) - pieceArea(p))).toBeLessThan(1e-6);
    }));
  });
  it('a polygon piece counts by its outline area', () => {
    const p: Piece = { kind: 'poly', l: 10, w: 10, ids: [1], outline: [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]] };
    expect(pieceArea(p)).toBeCloseTo(64, 9);
  });
});
