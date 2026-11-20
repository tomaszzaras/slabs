// 3D scene of a room for the 3D view: faces (floor, roof, walls), joint lines of every surface (the start line apart),
// field numbers and the reference points R. World axes: x across the room (ridge at 0), y up, z along the room.
import type { AtticModel } from './attic';
import type { FlatModel } from './flat';
import type { RoomModel } from './rooms';
import type { Pt } from './types';

export type V3 = [number, number, number];
export interface Face3 { pts: V3[]; kind: 'floor' | 'roof' | 'wall' }
export interface Line3 { pts: V3[]; start: boolean; ref: string }
export interface Mesh3D {
  faces: Face3[];
  lines: Line3[];
  labels: Array<{ p: V3; text: string }>;
  balls: Array<{ p: V3; ref: string }>;
  min: V3;
  max: V3;
}

const dedupe = (pts: Pt[]): Pt[] => pts.filter((p, i) => { const q = pts[(i + pts.length - 1) % pts.length]!; return Math.abs(p[0] - q[0]) > 1e-6 || Math.abs(p[1] - q[1]) > 1e-6; });

function atticMesh(m: AtticModel): Mesh3D {
  const { hw, XR, XA, XB, ZA, ZB, L, y } = m;
  const l1 = m.XT !== undefined;
  const XT = m.XT ?? -hw;
  const faces: Face3[] = [], lines: Line3[] = [], labels: Mesh3D['labels'] = [], balls: Mesh3D['balls'] = [];
  const plan: Pt[] = dedupe(l1 ? [[XT, 0], [XR, 0], [XR, L], [XT, L]] : [[-hw, 0], [XA, 0], [XA, ZA], [XR, ZA], [XR, L], [XB, L], [XB, ZB], [-hw, ZB]]);
  faces.push({ kind: 'floor', pts: plan.map((q): V3 => [q[0], 0, q[1]]) });
  // walls on every plan edge; edges across the room (z = const) are gables with the roof profile on top
  plan.forEach((a, i) => {
    const b = plan[(i + 1) % plan.length]!;
    if (Math.abs(a[1] - b[1]) < 1e-6) {
      const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]), z = a[1];
      const top = m.profile(lo, hi);
      faces.push({ kind: 'wall', pts: [[lo, 0, z], [hi, 0, z], ...top.slice().reverse().map((q): V3 => [q[0], q[1], z])] });
    } else {
      const x = a[0], z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
      faces.push({ kind: 'wall', pts: [[x, 0, z0], [x, y(x), z0], [x, y(x), z1], [x, 0, z1]] });
    }
  });
  // roof: strips between the z breaks, split at the ridge / cap edge
  const zs = [...new Set(l1 ? [0, L] : [0, ZA, ZB, L])].sort((a, b) => a - b);
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i]!, z1 = zs[i + 1]!, mid = (z0 + z1) / 2;
    const xl = l1 ? XT : mid > ZB ? XB : -hw, xr = l1 ? XR : mid < ZA ? XA : XR;
    m.profile(xl, xr).forEach((q, k, arr) => {
      const n = arr[k + 1];
      if (n) faces.push({ kind: 'roof', pts: [[q[0], q[1], z0], [n[0], n[1], z0], [n[0], n[1], z1], [q[0], q[1], z1]] });
    });
  }
  const xl = (z: number) => (l1 ? XT : z > ZB - 1e-6 && ZB < L ? XB : -hw), xr = (z: number) => (!l1 && z < ZA - 1e-6 ? XA : XR);
  const half = (z: number, side: 'l' | 'r' | 'all'): V3[] => {
    const a = side === 'r' ? 0 : xl(z), b = side === 'l' ? 0 : xr(z);
    const p = m.profile(Math.min(a, b), Math.max(a, b)).map((q): V3 => [q[0], q[1], z]);
    return [[a, 0, z] as V3, ...p, [b, 0, z] as V3].filter((q, i, arr) => i === 0 || i === arr.length - 1 || true);
  };
  const near = (cs: number[], v: number) => cs.reduce((b, c) => (Math.abs(c - v) < Math.abs(b - v) ? c : b), cs[0]!);
  m.surfs.forEach((s) => {
    const zsb = [...s.cols.map((c) => c.a), s.cols[s.cols.length - 1]!.b];
    const start = near(zsb, s.zr);
    zsb.forEach((z) => {
      let pts: V3[];
      if (s.top) pts = [[s.top.x, s.top.h, z], [s.top.x, 0, z]];
      else if (l1) pts = [[XT, y(XT), z], ...m.profile(XT, XR).slice(1).map((q): V3 => [q[0], q[1], z]), [XR, 0, z]];
      else if (s.key === 1) pts = half(z, 'l').slice(0, -1).concat([[0, y(0), z]]);
      else pts = half(z, 'r').slice(1);
      lines.push({ pts, start: Math.abs(z - start) < 1e-6, ref: s.ref });
    });
    s.cols.forEach((c) => {
      const z = (c.a + c.b) / 2;
      const p: V3 = s.top ? [s.top.x, s.top.h / 2, z] : l1 ? [(XT + XR) / 2, y((XT + XR) / 2), z] : s.key === 1 ? [xl(z) / 2, y(xl(z) / 2), z] : [xr(z) / 2, y(xr(z) / 2), z];
      labels.push({ p, text: String(c.id) });
    });
    const rx = s.top ? s.top.x : l1 ? XT : 0;
    balls.push({ p: [rx, s.top ? s.top.h : y(rx), s.zr], ref: s.ref });
  });
  m.walls.forEach((w) => {
    const xsb = [...w.strips.map((q) => q.a), w.strips[w.strips.length - 1]!.b];
    const start = near(xsb, w.xr);
    xsb.forEach((x) => lines.push({ pts: [[x, w.bs, w.z], [x, Math.max(y(x), w.bs), w.z]], start: Math.abs(x - start) < 1e-6, ref: w.ref }));
    w.strips.forEach((q) => { const x = (q.a + q.b) / 2; labels.push({ p: [x, (w.bs + y(x)) / 2, w.z], text: String(q.id) }); });
    balls.push({ p: [w.xr, w.bs, w.z], ref: w.ref });
  });
  return { faces, lines, labels, balls, min: [l1 ? XT : -hw, 0, 0], max: [XR, m.RID, L] };
}

function flatMesh(m: FlatModel): Mesh3D {
  const bx = m.p.bx!, bz = m.p.bz!, H = m.p.H!;
  const faces: Face3[] = [{ kind: 'floor', pts: [[0, 0, 0], [bx, 0, 0], [bx, 0, bz], [0, 0, bz]] }];
  faces.push({ kind: 'roof', pts: [[0, H, 0], [bx, H, 0], [bx, H, bz], [0, H, bz]] });
  faces.push({ kind: 'wall', pts: [[0, 0, 0], [bx, 0, 0], [bx, H, 0], [0, H, 0]] }, { kind: 'wall', pts: [[0, 0, bz], [bx, 0, bz], [bx, H, bz], [0, H, bz]] });
  faces.push({ kind: 'wall', pts: [[0, 0, 0], [0, 0, bz], [0, H, bz], [0, H, 0]] }, { kind: 'wall', pts: [[bx, 0, 0], [bx, 0, bz], [bx, H, bz], [bx, H, 0]] });
  const lines: Line3[] = [], labels: Mesh3D['labels'] = [], balls: Mesh3D['balls'] = [];
  const hb = m.hb, dz = !!m.dz;
  const near = (cs: number[], v: number) => cs.reduce((b, c) => (Math.abs(c - v) < Math.abs(b - v) ? c : b), cs[0]!);
  // ceiling boards with the wrap down the two walls at their ends; grid across the board direction
  const s0 = m.surfs[0]!;
  const b0 = [...s0.cols.map((c) => c.a), s0.cols[s0.cols.length - 1]!.b], st0 = near(b0, s0.zr);
  b0.forEach((c) => {
    lines.push({ ref: s0.ref, start: Math.abs(c - st0) < 1e-6, pts: dz ? [[c, H - hb, 0], [c, H, 0], [c, H, bz], [c, H - hb, bz]] : [[0, H - hb, c], [0, H, c], [bx, H, c], [bx, H - hb, c]] });
  });
  s0.cols.forEach((c) => labels.push({ p: dz ? [(c.a + c.b) / 2, H, bz / 2] : [bx / 2, H, (c.a + c.b) / 2], text: String(c.id) }));
  balls.push({ p: dz ? [s0.zr, H, 0] : [0, H, s0.zr], ref: s0.ref });
  // bands on the two other walls: vertical boards
  m.surfs.slice(1).forEach((s, q) => {
    const bs = [...s.cols.map((c) => c.a), s.cols[s.cols.length - 1]!.b], st = near(bs, s.zr);
    const at = (c: number): V3[] => (dz ? [[q ? bx : 0, H, c], [q ? bx : 0, H - hb, c]] : [[c, H, q ? bz : 0], [c, H - hb, q ? bz : 0]]);
    bs.forEach((c) => lines.push({ ref: s.ref, start: Math.abs(c - st) < 1e-6, pts: at(c) }));
    s.cols.forEach((c) => labels.push({ p: at((c.a + c.b) / 2)[0]!.map((v, i) => (i === 1 ? H - hb / 2 : v)) as V3, text: String(c.id) }));
    balls.push({ p: at(s.zr)[0]!, ref: s.ref });
  });
  return { faces, lines, labels, balls, min: [0, 0, 0], max: [bx, H, bz] };
}

export function roomMesh(m: RoomModel): Mesh3D {
  return 'walls' in m ? atticMesh(m) : flatMesh(m);
}
