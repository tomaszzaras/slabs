import { describe, expect, it } from 'vitest';
import { PITCH, SAMPLE_H, SAMPLE_W, sampleWall, wrapShift } from './sample';

describe('landing sample wall (the real engine on one roof slope)', () => {
  it('a joint on the wall needs the fewest plates and has no sliver; any other start needs one more', () => {
    const best = sampleWall(0);
    expect(PITCH).toBe(124);
    expect(SAMPLE_W).toBe(4 * PITCH);
    expect(best.plates).toBe(2);
    expect(best.slivers).toBe(0);
    expect(best.boards).toBe(4);
    for (const a of [12, 47, 80, 110]) {
      const r = sampleWall(a);
      expect(r.plates, `start ${a}`).toBe(3);
      expect(r.waste).toBeGreaterThan(best.waste);
      expect(r.boards).toBe(5);
    }
  });
  it('marks boards narrower than 10 cm as slivers', () => {
    expect(sampleWall(4).slivers).toBe(1);
    expect(sampleWall(120).slivers).toBe(1);
  });
  it('the start repeats every plate width', () => {
    expect(wrapShift(-1)).toBe(123);
    expect(wrapShift(124)).toBe(0);
    expect(sampleWall(47 + PITCH).plates).toBe(sampleWall(47).plates);
    expect(SAMPLE_H).toBe(240);
  });
});
