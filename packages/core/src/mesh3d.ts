// 3D scene of a room for the 3D view: faces (floor, roof, walls), joint lines of every surface (the start line apart),
// field numbers and the reference points R. World axes: x across the room (ridge at 0), y up, z along the room.
import type { AtticModel } from './attic';
import type { FlatModel } from './flat';
import type { RoomModel } from './rooms';
import type { Pt } from './types';
import { clipToRect, type Ring, type RoomFace } from './face';
import { edgesOf } from './outline';
import { WALL0 } from './spec';
import { roofHeight } from './cladding';

export type V3 = [number, number, number];
export interface Face3 {
  pts: V3[];
  kind: 'floor' | 'roof' | 'wall';
  /** gable wall: the z it stands at (openings of that wall are cut out of it) */
  gableZ?: number;
  /** key of the surface this face belongs to (the surface list's key); the floor belongs to none */
  surf?: number;
}
export interface Line3 { pts: V3[]; start: boolean; ref: string }
export interface Mesh3D {
  faces: Face3[];
  lines: Line3[];
  /** gable wall surface key -> z */
  gableZ: Record<number, number>;
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
      faces.push({ kind: 'wall', gableZ: z, pts: [[lo, 0, z], [hi, 0, z], ...top.slice().reverse().map((q): V3 => [q[0], q[1], z])] });
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
  // One joint line across a roof half at z. `zz` is a z just inside the surface, so a joint on the surface's edge
  // uses that surface's outline, not the neighbour's (e.g. the left slope's last joint at the corner cut-out).
  // A half never reaches past the room's edge: where a corner cut-out extends beyond the ridge, the right half
  // starts at the cut-out wall, not at the ridge.
  const half = (z: number, zz: number, side: 'l' | 'r'): V3[] => {
    const lo = xl(zz), hi = xr(zz);
    const a = side === 'r' ? Math.max(0, lo) : lo, b = side === 'l' ? Math.min(0, hi) : hi;
    if (b - a < 1e-6) return [];
    const p = m.profile(a, b).map((q): V3 => [q[0], q[1], z]);
    // the left half drops to the floor at its outer wall; the right half at its outer wall
    return side === 'l' ? [[a, 0, z] as V3, ...p] : [...p, [b, 0, z] as V3];
  };
  const near = (cs: number[], v: number) => cs.reduce((b, c) => (Math.abs(c - v) < Math.abs(b - v) ? c : b), cs[0]!);
  const sh = m.sheet;
  m.surfs.forEach((s) => {
    const zsb = [...s.cols.map((c) => c.a), s.cols[s.cols.length - 1]!.b];
    const start = near(zsb, s.zr);
    const eps = 1e-3;
    zsb.forEach((z) => {
      const zz = Math.min(Math.max(z, s.z0 + eps), s.z1 - eps);
      let pts: V3[];
      if (s.top) pts = [[s.top.x, s.top.h, z], [s.top.x, 0, z]];
      else if (l1) pts = [[XT, y(XT), z], ...m.profile(XT, XR).slice(1).map((q): V3 => [q[0], q[1], z]), [XR, 0, z]];
      else pts = half(z, zz, s.key === 1 ? 'l' : 'r');
      if (pts.length > 1) lines.push({ pts, start: Math.abs(z - (sh ? sh.zr : start)) < 1e-6, ref: sh ? sh.ref : s.ref });
    });
    if (sh) return; // with the roof sheet the field numbers and the start point R come from the sheet (below)
    s.cols.forEach((c) => {
      const z = (c.a + c.b) / 2;
      const p: V3 = s.top ? [s.top.x, s.top.h / 2, z] : l1 ? [(XT + XR) / 2, y((XT + XR) / 2), z] : s.key === 1 ? [xl(z) / 2, y(xl(z) / 2), z] : [xr(z) / 2, y(xr(z) / 2), z];
      labels.push({ p, text: String(c.id) });
    });
    const rx = s.top ? s.top.x : l1 ? XT : 0;
    balls.push({ p: [rx, s.top ? s.top.h : y(rx), s.zr], ref: s.ref });
  });
  if (sh) {
    // one roof sheet: field numbers on the roof (the right slope where there is one, else the left), one start point R
    sh.strips.forEach((st) => {
      const z = (st.a + st.b) / 2;
      const hasB = !!m.p.cB && z > m.ZB, recess = !!m.p.cA && z < m.ZA;
      const x = m.XT !== undefined ? (XT + XR) / 2 : hasB ? (m.XB + XR) / 2 : recess ? XA / 2 : (m.XR) / 2;
      labels.push({ p: [x, y(x), z], text: String(st.id) });
    });
    const rx = m.XT !== undefined ? XT : sh.ur === 0 ? 0 : m.XB;
    balls.push({ p: [rx, y(rx), sh.zr], ref: sh.ref });
  }
  m.walls.forEach((w) => {
    const xsb = [...w.strips.map((q) => q.a), w.strips[w.strips.length - 1]!.b];
    const start = near(xsb, w.xr);
    xsb.forEach((x) => lines.push({ pts: [[x, w.bs, w.z], [x, Math.max(y(x), w.bs), w.z]], start: Math.abs(x - start) < 1e-6, ref: w.ref }));
    w.strips.forEach((q) => { const x = (q.a + q.b) / 2; labels.push({ p: [x, (w.bs + y(x)) / 2, w.z], text: String(q.id) }); });
    balls.push({ p: [w.xr, w.bs, w.z], ref: w.ref });
  });
  const gableZ: Record<number, number> = {};
  m.walls.forEach((w) => { gableZ[w.rid] = w.z; });
  // which surface each face belongs to: gable walls by their z, the partition by its x, roof halves (and the outer
  // walls under them) by side (key 1 is the left slope) and z range
  faces.forEach((f) => {
    if (f.kind === 'floor') return;
    if (f.gableZ !== undefined) { const k = Object.keys(gableZ).find((q) => gableZ[Number(q)] === f.gableZ); if (k !== undefined) f.surf = Number(k); return; }
    const cx = f.pts.reduce((a, q) => a + q[0], 0) / f.pts.length, cz = f.pts.reduce((a, q) => a + q[2], 0) / f.pts.length;
    const top = m.surfs.find((s) => s.top && Math.abs(s.top.x - cx) < 1e-3 && cz >= s.z0 - 1e-3 && cz <= s.z1 + 1e-3);
    if (top) { f.surf = top.key; return; }
    const cand = m.surfs.filter((s) => !s.top && cz >= s.z0 - 1e-3 && cz <= s.z1 + 1e-3);
    const side = l1 ? cand : cx < 0 ? cand.filter((s) => s.key === 1) : cand.filter((s) => s.key !== 1);
    f.surf = (side[0] ?? cand[0])?.key;
  });
  // with the roof sheet every roof and outer-wall face belongs to the sheet (key 1); the gable walls keep their own keys
  if (sh) faces.forEach((f) => { if (f.surf !== undefined && f.surf <= 5) f.surf = 1; });
  return { faces, lines, gableZ, labels, balls, min: [l1 ? XT : -hw, 0, 0], max: [XR, m.RID, L] };
}

function outlineMesh(m: FlatModel): Mesh3D {
  const ol = m.outline!, H = m.p.H!;
  if (m.roof) return roofOutlineMesh(m);
  const faces: Face3[] = [{ kind: 'floor', pts: ol.map((q): V3 => [q[0], 0, q[1]]) }, { kind: 'roof', surf: 1, pts: ol.map((q): V3 => [q[0], H, q[1]]) }];
  edgesOf(ol).forEach((e) => faces.push({ kind: 'wall', surf: WALL0 + e.i, pts: [[e.a[0], 0, e.a[1]], [e.b[0], 0, e.b[1]], [e.b[0], H, e.b[1]], [e.a[0], H, e.a[1]]] }));
  const xs = ol.map((q) => q[0]), zs = ol.map((q) => q[1]);
  return { faces, lines: [], gableZ: {}, labels: [], balls: [], min: [Math.min(...xs), 0, Math.min(...zs)], max: [Math.max(...xs), H, Math.max(...zs)] };
}

function roofOutlineMesh(m: FlatModel): Mesh3D {
  const ol = m.outline!, r = m.roof!;
  const hAt = (x: number) => roofHeight(r, x + r.ox);
  const faces: Face3[] = [{ kind: 'floor', pts: ol.map((q): V3 => [q[0], 0, q[1]]) }];
  edgesOf(ol).forEach((e) => {
    const along = Math.abs(e.d[0]) > 0.5, x0 = e.a[0], x1 = e.b[0];
    const top: V3[] = [[e.b[0], hAt(x1), e.b[1]]];
    if (along && (r.W / 2 - r.ox - x0) * (r.W / 2 - r.ox - x1) < 0) top.push([r.W / 2 - r.ox, hAt(r.W / 2 - r.ox), e.a[1]]);
    top.push([e.a[0], hAt(x0), e.a[1]]);
    faces.push({ kind: 'wall', surf: WALL0 + e.i, pts: [[e.a[0], 0, e.a[1]], [e.b[0], 0, e.b[1]], ...top] });
  });
  // the roof: the plan cut at the ridge, each part lifted onto its slope
  const xr = r.W / 2 - r.ox;
  [[-1e5, xr], [xr, 1e5]].forEach(([lo, hi]) => {
    clipToRect([ol as Ring], lo!, -1e5, hi!, 1e5).forEach((ring) => faces.push({ kind: 'roof', surf: 1, pts: ring.map((q): V3 => [q[0], hAt(q[0]), q[1]]) }));
  });
  const xs = ol.map((q) => q[0]), zs = ol.map((q) => q[1]);
  return { faces, lines: [], gableZ: {}, labels: [], balls: [], min: [Math.min(...xs), 0, Math.min(...zs)], max: [Math.max(...xs), Math.max(...ol.map((q) => hAt(q[0]))), Math.max(...zs)] };
}

function flatMesh(m: FlatModel): Mesh3D {
  if (m.outline) return outlineMesh(m);
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
  // ceiling = the first surface; the walls of the two bands in the order they are drawn (x walls when the boards run along z)
  const fs = m.surfs.map((q) => q.key);
  faces[1]!.surf = fs[0];
  const walls = dz ? [faces[4]!, faces[5]!] : [faces[2]!, faces[3]!];
  faces.forEach((f) => { if (f.kind !== 'floor') f.surf = fs[0]; }); // the ceiling boards wrap down the two walls at their ends
  walls.forEach((w, q) => { w.surf = fs[q + 1]; });
  return { faces, lines, gableZ: {}, labels, balls, min: [0, 0, 0], max: [bx, H, bz] };
}

/** Where a point of an attic roof sheet (u = arc length from the ridge, z) is in the room: walks the roof profile, then the knee wall down. */
function roofPoint(m: AtticModel, u: number, z: number): V3 {
  const pts = m.profile(-m.hw, m.XR);
  const right = pts.filter((q) => q[0] >= -1e-9), left = pts.filter((q) => q[0] <= 1e-9).reverse();
  const walk = (path: Pt[], dist: number): Pt => {
    let d = dist;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]!, b = path[i + 1]!, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d <= len + 1e-9) { const t = len ? d / len : 0; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
      d -= len;
    }
    const e = path[path.length - 1]!;
    return [e[0], Math.max(0, e[1] - d)]; // the knee wall below the eave
  };
  const q = u >= 0 ? walk(right, u) : walk(left, -u);
  return [q[0], q[1], z];
}

/** 3D position of a point (a, b) of a face, or null when the model has no placement for it (the room with a partition, cut-out wall). */
function facePlace(m: RoomModel, f: RoomFace): ((a: number, b: number) => V3) | null {
  if ('walls' in m) {
    if (f.kind === 'roof') return m.XT === undefined && !m.p.cB ? (u, z) => roofPoint(m, u, z) : null;
    const w = m.walls.find((q) => q.rid === f.key);
    return w ? (a, b) => [a, b, w.z] : null;
  }
  const bx = m.p.bx!, bz = m.p.bz!, H = m.p.H!, dz = !!m.dz;
  if (m.outline && m.roof && f.kind === 'roof') { const r = m.roof, C = Math.cos((r.ang * Math.PI) / 180); return (u, z) => { const x = r.W / 2 + u * C; return [x - r.ox, roofHeight(r, x), z]; }; }
  if (m.outline && f.key >= WALL0) { const e = edgesOf(m.outline)[f.key - WALL0]!; return (a, b) => [e.a[0] + e.d[0] * a, b, e.a[1] + e.d[1] * a]; }
  if (f.kind === 'ceiling') return (a, b) => [a, H, b];
  const at: Record<number, (a: number, b: number) => V3> = dz
    ? { 2: (a, b) => [0, b, a], 3: (a, b) => [bx, b, a], 4: (a, b) => [a, b, 0], 5: (a, b) => [a, b, bz] }
    : { 2: (a, b) => [a, b, 0], 3: (a, b) => [a, b, bz], 4: (a, b) => [0, b, a], 5: (a, b) => [bx, b, a] };
  return at[f.key] ?? null;
}

/** Joint lines, numbers and the start ball of the surfaces drawn with the generic boards; the preset ones they replace are dropped. */
function withFaces(m: RoomModel, mesh: Mesh3D): Mesh3D {
  if (!m.faces?.length) return mesh;
  const gone = new Set(m.faces.map((f) => f.ref));
  if (!('walls' in m)) m.surfs.forEach((q) => { if ((m.legacyOff ?? []).includes(q.key)) gone.add(q.ref); });
  const goneIds = new Set<number>();
  if ('walls' in m) { m.sheet?.strips.forEach((s) => { if (gone.has(m.sheet!.ref)) goneIds.add(s.id); }); m.walls.forEach((w) => { if (gone.has(w.ref)) w.strips.forEach((s) => goneIds.add(s.id)); }); }
  else m.surfs.forEach((s) => { if (gone.has(s.ref)) s.cols.forEach((c) => goneIds.add(c.id)); });
  const lines = mesh.lines.filter((l) => !gone.has(l.ref));
  const labels = mesh.labels.filter((l) => !goneIds.has(Number(l.text)));
  const balls = mesh.balls.filter((b) => !gone.has(b.ref));
  m.faces.forEach((f) => {
    const place = facePlace(m, f);
    if (!place) return;
    const alongB = f.dir === 'vertical';
    f.plan.rows.forEach((r, i) => {
      const start = Math.abs(r.lo - f.plan.startAt) < 0.5;
      if (i > 0) {
        const segs = alongB ? clipToRect(f.wood, r.lo - 0.01, -1e4, r.lo + 0.01, 1e4) : clipToRect(f.wood, -1e4, r.lo - 0.01, 1e4, r.lo + 0.01);
        segs.forEach((sg) => {
          const lo = Math.min(...sg.map((q) => (alongB ? q[1] : q[0]))), hi = Math.max(...sg.map((q) => (alongB ? q[1] : q[0])));
          lines.push({ ref: f.ref, start, pts: alongB ? [place(r.lo, lo), place(r.lo, hi)] : [place(lo, r.lo), place(hi, r.lo)] });
        });
      }
      const sh = f.plan.shapes.find((q) => q.id === r.id);
      if (sh) { const cx = sh.ring.reduce((a, q) => a + q[0], 0) / sh.ring.length, cy = sh.ring.reduce((a, q) => a + q[1], 0) / sh.ring.length; labels.push({ p: place(cx, cy), text: String(r.id) }); }
    });
    balls.push({ p: alongB ? place(f.plan.startAt, f.up ? 0 : Math.min(...f.outline.map((q) => q[1]))) : place(Math.min(...f.outline.map((q) => q[0])), f.plan.startAt), ref: f.ref });
  });
  return { ...mesh, lines, labels, balls };
}

export function roomMesh(m: RoomModel): Mesh3D {
  return withFaces(m, 'walls' in m ? atticMesh(m) : flatMesh(m));
}
