// The live sample wall of the landing page: one roof slope, cut with the same engine as the app (@slabs/core).
// Pure and fast (no worker, no 3D): a few boards, one nesting run per change of the start point.
import { DEFAULT_PLATE, DEFAULT_REQUEST, buildFace, computeCut, plateCover, WOOD, type CutResult, type RoomFace } from '@slabs/core';

/** The example slope in cm: 4.96 m along the ridge, 2.40 m up the slope. */
export const SAMPLE_W = 496;
export const SAMPLE_H = 240;
const SETTINGS = { kerf: 0.3, trim: 0, minOffcut: 10, guillotine: false, minStrip: 10 };

/** Joint pitch of the plates (covering width, tongue and groove included). */
export const PITCH = plateCover(DEFAULT_PLATE).W;

export interface SampleResult {
  face: RoomFace;
  plates: number;
  /** share of the plates' area that is not used, 0..1 */
  waste: number;
  /** boards narrower than the sliver limit (cm) */
  slivers: number;
  boards: number;
}

/** Start point -> number in [0, PITCH): the grid repeats every plate width. */
export const wrapShift = (v: number): number => ((v % PITCH) + PITCH) % PITCH;

export function sampleWall(shift: number): SampleResult {
  const cv = plateCover(DEFAULT_PLATE);
  const anchor = wrapShift(shift);
  const f = buildFace({
    key: 1, a0: 0, a1: SAMPLE_W, top: [[0, SAMPLE_H], [SAMPLE_W, SAMPLE_H]], dir: 'vertical', finish: WOOD,
    anchor, pitch: cv.W, PL: cv.L, mode: DEFAULT_PLATE.profile, firstId: 1,
  });
  const face: RoomFace = {
    ...f, ref: 'R', label: '', detail: '', kind: 'roof',
    outline: [[0, 0], [SAMPLE_W, 0], [SAMPLE_W, SAMPLE_H], [0, SAMPLE_H]], up: false, folds: [], param: 'o1',
  };
  const res: CutResult = computeCut({
    ...DEFAULT_REQUEST, band: { len: 0, h: 0, min: 0, max: 0, use: false }, settings: SETTINGS, plate: DEFAULT_PLATE, maxIters: 40, timeMs: Infinity,
    rooms: [{ key: 'S', name: 'sample', on: true, PL: cv.L, PW: cv.W, pieces: f.plan.pieces }],
  });
  const slivers = f.plan.rows.filter((r) => r.hi - r.lo < SETTINGS.minStrip - 1e-6).length;
  return { face, plates: res.plates.length, waste: res.stats.grossM2 > 0 ? 1 - res.stats.utilisation : 0, slivers, boards: f.plan.rows.length };
}
