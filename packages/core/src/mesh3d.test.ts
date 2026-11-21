import { describe, expect, it } from 'vitest';
import { buildModel, ROOM_IDS } from './rooms';
import { roomMesh } from './mesh3d';
import { ATTIC_PRESETS, atticModel } from './attic';
import { withSheet } from './sheet';

// the model the app uses: one roof sheet
const sheetModel = (id: 'salon' | 'sypialnia' | 'lazienka-1', pin: Record<string, number> = {}) => withSheet(atticModel(ATTIC_PRESETS[id], { ...pin, o1: 0, o2: 0, o3: 0, o4: 0, o5: 0 }), { splits: {}, splitAtBends: true });

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

// Every roof joint line must lie on the roof that is actually there at its z: a point inside a polygon face of the
// roof, or on the outer wall below it. Regression: with a corner cut-out reaching past the ridge (salon defaults),
// the left slope's last joint ran diagonally from the cut-out corner to the ridge, and the right slope's joints behind
// the cut-out started at the ridge, outside the room.
describe('3D joint lines stay on the room', () => {
  const onSegment = (p: number[], a: number[], b: number[]) => {
    const ab = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!], ap = [p[0]! - a[0]!, p[1]! - a[1]!, p[2]! - a[2]!];
    const len2 = ab[0]! ** 2 + ab[1]! ** 2 + ab[2]! ** 2;
    const t = len2 ? (ap[0]! * ab[0]! + ap[1]! * ab[1]! + ap[2]! * ab[2]!) / len2 : 0;
    if (t < -1e-6 || t > 1 + 1e-6) return false;
    const d = [ap[0]! - t * ab[0]!, ap[1]! - t * ab[1]!, ap[2]! - t * ab[2]!];
    return Math.hypot(d[0]!, d[1]!, d[2]!) < 0.05;
  };
  // a point is on a planar convex face if it is on one of its edges or inside (barycentric fan test)
  const onFace = (p: number[], f: number[][]) => {
    for (let i = 0; i < f.length; i++) if (onSegment(p, f[i]!, f[(i + 1) % f.length]!)) return true;
    for (let i = 1; i < f.length - 1; i++) {
      const a = f[0]!, b = f[i]!, c = f[i + 1]!;
      const v0 = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!], v1 = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!], v2 = [p[0]! - a[0]!, p[1]! - a[1]!, p[2]! - a[2]!];
      const dot = (u: number[], w: number[]) => u[0]! * w[0]! + u[1]! * w[1]! + u[2]! * w[2]!;
      const d00 = dot(v0, v0), d01 = dot(v0, v1), d02 = dot(v0, v2), d11 = dot(v1, v1), d12 = dot(v1, v2), den = d00 * d11 - d01 * d01;
      if (Math.abs(den) < 1e-9) continue;
      const u = (d11 * d02 - d01 * d12) / den, v = (d00 * d12 - d01 * d02) / den;
      const n = [v0[1]! * v1[2]! - v0[2]! * v1[1]!, v0[2]! * v1[0]! - v0[0]! * v1[2]!, v0[0]! * v1[1]! - v0[1]! * v1[0]!];
      const dist = Math.abs(dot(n, v2)) / Math.hypot(n[0]!, n[1]!, n[2]!);
      if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6 && dist < 0.05) return true;
    }
    return false;
  };
  for (const id of ROOM_IDS) for (const variant of ['per-segment', 'roof sheet']) {
    if (variant === 'roof sheet' && id === 'lazienka-2') continue;
    it(`${id} (${variant}): every joint line point lies on a roof or wall face`, () => {
      const mesh = roomMesh(variant === 'roof sheet' ? sheetModel(id as 'salon') : buildModel(id, {}));
      const faces = mesh.faces.filter((f) => f.kind !== 'floor').map((f) => f.pts as number[][]);
      mesh.lines.forEach((l) => {
        for (let i = 0; i < l.pts.length - 1; i++) {
          const a = l.pts[i]!, b = l.pts[i + 1]!;
          for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            const p = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
            expect(faces.some((f) => onFace(p, f)), `${l.ref} ${p.map((v) => Math.round(v)).join(',')}`).toBe(true);
          }
        }
      });
    });
  }
});

// Clicking a face in 3D selects a surface: every surface of the room owns at least one face, and every face
// that is not the floor belongs to a surface of this room.
describe('3D faces know their surface', () => {
  for (const id of ROOM_IDS) {
    it(`${id}: every surface has a face, no wall or roof face is without a surface, the floor has none`, () => {
      const m = buildModel(id, {});
      const keys = [...m.surfs.map((s) => s.key), ...('walls' in m ? m.walls.map((w) => w.rid) : [])];
      const mesh = roomMesh(m);
      keys.forEach((k) => expect(mesh.faces.some((f) => f.surf === k), `surface ${k}`).toBe(true));
      mesh.faces.forEach((f) => {
        if (f.kind === 'floor') expect(f.surf).toBeUndefined();
        else expect(keys).toContain(f.surf);
      });
    });
  }
  it('salon: the left slope is surface 1, right-hand slopes follow z, the gable at z=415 is its own surface', () => {
    const m = buildModel('salon', {});
    const mesh = roomMesh(m);
    const roof = mesh.faces.filter((f) => f.kind === 'roof');
    roof.forEach((f) => { const cx = f.pts.reduce((a, q) => a + q[0], 0) / f.pts.length; if (cx < 0) expect(f.surf).toBe(1); else expect(f.surf).not.toBe(1); });
    const g = mesh.faces.find((f) => f.gableZ === 415)!;
    expect(g.surf).toBe(Number(Object.keys(mesh.gableZ).find((k) => mesh.gableZ[Number(k)] === 415)));
  });
});

describe('3D scene of a room with a roof sheet', () => {
  for (const id of ['salon', 'sypialnia', 'lazienka-1'] as const) {
    it(`${id}: one ball R1 for the roof, gable walls R2..; a start line each; field numbers = fields; roof faces belong to the sheet (key 1)`, () => {
      const m = sheetModel(id);
      const mesh = roomMesh(m);
      expect(mesh.balls.map((b) => b.ref).sort()).toEqual(m.refs.map((r) => r.id).sort());
      m.refs.forEach((r) => expect(mesh.lines.filter((l) => l.ref === r.id && l.start).length, r.id).toBeGreaterThanOrEqual(1));
      expect(mesh.labels.length).toBe(m.fields);
      const keys = [1, ...m.walls.map((w) => w.rid)];
      mesh.faces.forEach((f) => { if (f.kind === 'floor') expect(f.surf).toBeUndefined(); else expect(keys).toContain(f.surf); });
      keys.forEach((k) => expect(mesh.faces.some((f) => f.surf === k), `surface ${k}`).toBe(true));
    });
  }
});
