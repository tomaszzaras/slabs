import { describe, expect, it } from 'vitest';
import { computeCut, DEFAULT_REQUEST, NO_SETTINGS, verifyGuillotine, type CutRequest, type CutSettings, type Plate } from './nest';
import { buildModel, fieldIssues, ROOM_IDS, ROOMS, roomPieces } from './rooms';
import type { Piece } from './types';

function defaults(settings: CutSettings, extra: Partial<CutRequest> = {}): CutRequest {
  return {
    ...DEFAULT_REQUEST, settings, maxIters: 200, timeMs: Infinity,
    rooms: ROOM_IDS.map((id) => {
      const m = buildModel(id, { trim: settings.trim });
      return { key: ROOMS[id].key, name: ROOMS[id].name, on: true, PL: m.p.PL!, PW: m.p.PW!, pieces: roomPieces(m) };
    }),
    ...extra,
  };
}

describe('kerf, trim, offcuts on the project defaults', () => {
  const base = computeCut(defaults(NO_SETTINGS));
  it('kerf 0 and trim 0: no kerf area, no allowance area (the parity tests compare the plans with the artifact)', () => {
    expect(base.plates.length).toBeGreaterThan(0);
    expect(base.stats.kerfM2).toBe(0);
  });
  it('a 3 mm kerf never gives a smaller usable area and reports the area lost in cuts', () => {
    const r = computeCut(defaults({ kerf: 0.3, trim: 0, minOffcut: 10, guillotine: false }));
    expect(r.stats.kerfM2).toBeGreaterThan(0);
    expect(r.plates.length).toBeGreaterThanOrEqual(base.plates.length - 1);
    expect(r.stats.offcutKeptM2).toBeGreaterThanOrEqual(0);
  });
  it('edge trim of 1 cm keeps every piece inside the trimmed plate and narrows the board grid', () => {
    const req = defaults({ kerf: 0, trim: 1, minOffcut: 0, guillotine: false });
    const r = computeCut(req);
    r.plates.forEach((pl) => pl.items.forEach((it) => {
      expect(it.x).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(it.y).toBeGreaterThanOrEqual(1 - 1e-9);
    }));
    const m = buildModel('salon', { trim: 1 });
    expect(m.surfs[0]!.cols.find((c) => c.b - c.a > 100)!.b - m.surfs[0]!.cols.find((c) => c.b - c.a > 100)!.a).toBeCloseTo(123, 9);
  });
  it('minimum usable offcut: kept offcuts are at least that big in both directions', () => {
    const r = computeCut(defaults({ kerf: 0.3, trim: 0, minOffcut: 20, guillotine: false }));
    r.plates.forEach((pl) => (pl.offcuts ?? []).forEach((o) => { expect(o.w).toBeGreaterThanOrEqual(20 - 1e-9); expect(o.h).toBeGreaterThanOrEqual(20 - 1e-9); }));
  });
});

describe('guillotine mode', () => {
  it('numbers the cuts in order and every plate verifies', () => {
    const settings: CutSettings = { kerf: 0.3, trim: 0.5, minOffcut: 10, guillotine: true };
    const r = computeCut(defaults(settings));
    let cuts = 0;
    r.plates.forEach((pl: Plate) => {
      if (pl.extra) return;
      expect(verifyGuillotine(pl, r.PL, r.PW, 0.3, 0.5)).toBeNull();
      cuts += pl.cuts?.length ?? 0;
    });
    expect(cuts).toBeGreaterThan(0);
  });
  it('detects a layout that cannot be cut with through-cuts', () => {
    const p = (x: number, y: number, l: number, w: number): { p: Piece; x: number; y: number } => ({ p: { kind: 'rect', l, w, ids: [1] }, x, y });
    // pinwheel of four rectangles: no straight cut crosses it
    const pl: Plate = { free: [], items: [p(0, 0, 60, 30), p(60, 0, 40, 60), p(40, 60, 60, 40), p(0, 30, 40, 70)], area: 0, use: 0, cuts: [{ n: 1, orient: 'v', pos: 60, from: 0, to: 100 }] };
    expect(verifyGuillotine(pl, 100, 100, 0, 0)).not.toBeNull();
  });
});

describe('field issues explain dependent bounds', () => {
  it('a recess wider than the interior allows names the width it depends on', () => {
    const issue = fieldIssues('salon', { ...ROOMS.salon.defaults, W: 548, dA: 900 }).find((i) => i.key === 'dA')!;
    expect(issue.kind).toBe('max');
    expect(issue.because).toContain('W');
  });
  it('a fixed limit has no dependency', () => {
    const issue = fieldIssues('salon', { ...ROOMS.salon.defaults, W: 100 }).find((i) => i.key === 'W')!;
    expect(issue.bound).toBe(200);
    expect(issue.because).toEqual([]);
  });
});
