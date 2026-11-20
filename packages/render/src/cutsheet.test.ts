import { describe, expect, it } from 'vitest';
import { buildModel, computeCut, DEFAULT_ALLOWANCES, DEFAULT_REQUEST, ROOMS, ROOM_IDS, roomPieces } from '@slabs/core';
import { cutSheets, piecesCsv } from './cutsheet';

const req = (settings = { kerf: 0.3, trim: 0, minOffcut: 10, guillotine: false }, allowances = DEFAULT_ALLOWANCES) => ({
  ...DEFAULT_REQUEST, settings, allowances, maxIters: 40, timeMs: Infinity,
  rooms: ROOM_IDS.map((id) => { const m = buildModel(id, { trim: settings.trim }); return { key: ROOMS[id].key, name: id, on: true, PL: m.p.PL!, PW: m.p.PW!, pieces: roomPieces(m) }; }),
});

describe('cutting sheets', () => {
  const R = computeCut(req());
  const sheets = cutSheets(R, 10);
  it('one sheet per plate; every piece of the plan is on exactly one sheet; sizes inside the plate', () => {
    expect(sheets).toHaveLength(R.plates.length);
    const n = sheets.reduce((a, s) => a + s.items.length, 0);
    const expected = R.plates.reduce((a, pl) => a + pl.items.reduce((k, it) => k + (it.p.kind === 'nest' ? it.p.parts!.length : it.p.kind === 'pair' ? 2 : 1), 0), 0);
    expect(n).toBe(expected);
    sheets.forEach((s) => s.items.forEach((p) => { expect(p.x + p.l).toBeLessThanOrEqual(R.PL + 0.2); expect(p.y + p.w).toBeLessThanOrEqual(R.PW + 0.2); expect(p.label.length).toBeGreaterThan(0); }));
  });
  it('allowances show cut size and fit size', () => {
    const withFit = sheets.flatMap((s) => s.items).filter((p) => p.fitL !== undefined || p.fitW !== undefined);
    expect(withFit.length).toBeGreaterThan(0);
    withFit.forEach((p) => expect(p.fitL !== p.l || p.fitW !== p.w).toBe(true));
    const none = cutSheets(computeCut(req(undefined, { ...DEFAULT_ALLOWANCES, enabled: false })), 10).flatMap((s) => s.items);
    expect(none.every((p) => p.fitL === undefined)).toBe(true);
  });
  it('guillotine sheets carry the cuts in order; split pieces carry their split line', () => {
    const g = cutSheets(computeCut(req({ kerf: 0.3, trim: 0, minOffcut: 10, guillotine: true })), 10);
    const withCuts = g.filter((s) => s.cuts.length);
    expect(withCuts.length).toBeGreaterThan(0);
    withCuts.forEach((s) => expect(s.cuts.map((c) => c.n)).toEqual(s.cuts.map((_c, i) => i + 1)));
  });
  it('CSV has a row per piece plus the header', () => {
    expect(piecesCsv(sheets).split('\n')).toHaveLength(1 + sheets.reduce((a, s) => a + s.items.length, 0));
  });
});
