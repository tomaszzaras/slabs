import { describe, expect, it } from 'vitest';
import { buildModel, ROOM_IDS } from './rooms';
import { roomMesh } from './mesh3d';

describe('3D scene of a room', () => {
  for (const id of ROOM_IDS) {
    it(`${id}: faces, a ball per start point R, a start line per surface, finite coordinates, everything inside the room's bounds`, () => {
      const m = buildModel(id, {});
      const mesh = roomMesh(m);
      expect(mesh.faces.some((f) => f.kind === 'roof')).toBe(true);
      expect(mesh.faces.some((f) => f.kind === 'floor')).toBe(true);
      expect(mesh.balls.map((b) => b.ref).sort()).toEqual(m.refs.map((r) => r.id).sort());
      m.refs.forEach((r) => expect(mesh.lines.filter((l) => l.ref === r.id && l.start).length, r.id).toBeGreaterThanOrEqual(1));
      const all = [...mesh.faces.flatMap((f) => f.pts), ...mesh.lines.flatMap((l) => l.pts), ...mesh.labels.map((l) => l.p), ...mesh.balls.map((b) => b.p)];
      all.forEach((p) => { p.forEach((v) => expect(Number.isFinite(v)).toBe(true)); for (let k = 0; k < 3; k++) { expect(p[k]).toBeGreaterThanOrEqual(mesh.min[k]! - 1e-6); expect(p[k]).toBeLessThanOrEqual(mesh.max[k]! + 1e-6); } });
      expect(mesh.labels.length).toBe(m.fields);
    });
  }
});
