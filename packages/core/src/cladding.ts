// Cladding of a room's surfaces on top of an engine model: which surfaces the preset engine draws with its own code (default direction, wood)
// and which get a `Face` (own boards, finish zones). `buildRoom` is the one entry the app uses: spec + house roof + plate -> room model.
import { PF_MODE, type AtticModel } from './attic';
import { boardsOf, buildFace, clipToRect, ringArea, woodZone, type BoardPlan, type Dir, type Ring, type RoomFace } from './face';
import type { Lang } from './messages';
import type { Opening } from './openings';
import { engineInput, finishOf, dirOf, flatIsPreset, flatBand, roofIsPreset, wallIsPreset, type RoomSpec } from './spec';
import { buildModel, isAttic, roomPieces, type RoomModel } from './rooms';
import { withSheet, type SheetConfig } from './sheet';
import type { FlatModel } from './flat';
import type { Pt } from './types';
import { edgesOf } from './outline';
import { WALL0 } from './spec';
import { polyArea } from './geometry';
import { pieceArea } from './shelf';
import type { Params } from './util';

const maxId = (m: RoomModel): number => {
  let n = 0;
  m.surfs.forEach((s) => s.cols.forEach((c) => { n = Math.max(n, c.id); }));
  if (isAttic(m)) {
    m.walls.forEach((w) => w.strips.forEach((c) => { n = Math.max(n, c.id); }));
    m.sheet?.strips.forEach((c) => { n = Math.max(n, c.id); });
  }
  return n;
};

interface Plate { PL: number; BW: number; mode: ReturnType<typeof modeOf> }
const modeOf = (p: Params) => PF_MODE[p.pf ?? 0]!;
const plateOf = (p: Params): Plate => ({ PL: p.PL! - 2 * (p.trimL ?? p.trim ?? 0), BW: p.PW! - 2 * (p.trim ?? 0), mode: modeOf(p) });

const dirIn = (d: Dir | undefined, ok: Dir[], dflt: Dir): Dir => (d && ok.includes(d) ? d : dflt);

/** Wall face of the attic model's gable wall `w` (own boards / finish). */
function gableFace(m: AtticModel, spec: RoomSpec, w: AtticModel['walls'][number], pl: Plate, firstId: number): RoomFace {
  const key = w.rid;
  const dir = dirIn(dirOf(spec, key), ['vertical', 'horizontal'], 'vertical') as 'vertical' | 'horizontal';
  const finish = finishOf(spec, key);
  const zone = woodZone(finish);
  const shift = m.p['o' + key] ?? 0;
  const anchor = dir === 'vertical' ? w.anchor : (zone?.lo ?? 0) + shift;
  const top = m.profile(w.x0, w.x1);
  const f = buildFace({ key, a0: w.x0, a1: w.x1, top, dir, finish, anchor, pitch: pl.BW, PL: pl.PL, mode: pl.mode, firstId });
  const outline = [[w.x0, 0], [w.x1, 0], ...top.slice().reverse()] as Ring;
  return { ...f, ref: w.ref, label: w.label ?? w.title, detail: w.detail ?? '', kind: 'wall', outline, up: true, folds: [], param: 'o' + key };
}

/** The roof sheet's boards along the ridge: one grid per segment between the folds (a board cannot bend along its length). */
function ridgeFace(m: AtticModel, spec: RoomSpec, pl: Plate, firstId: number): RoomFace {
  const sh = m.sheet!;
  const finish = finishOf(spec, 1);
  const outline = sh.outline as Ring;
  const folds = [...new Set(sh.bands.flatMap((b) => b.folds.map((f) => Math.round(f.u * 10) / 10)))].sort((a, b) => a - b).filter((u) => u > sh.uMin + 0.5 && u < sh.uMax - 0.5);
  const cuts = [sh.uMin, ...folds, sh.uMax];
  const shift = m.p.o1 ?? 0;
  const plan: BoardPlan = { rows: [], pieces: [], shapes: [], startAt: 0 };
  let id = firstId;
  if (finish.kind !== 'other') {
    for (let i = 0; i < cuts.length - 1; i++) {
      const fa = cuts[i]!, fb = cuts[i + 1]!;
      const region = clipToRect([outline], fa, -1, fb, sh.L + 1);
      if (!region.length) continue;
      const anchor = (fb <= 0.5 ? fb : fa) + shift;
      const p = boardsOf({ region, along: 'b', pitch: pl.BW, anchor, PL: pl.PL, mode: pl.mode, surf: 1, firstId: id });
      id += p.rows.length;
      plan.rows.push(...p.rows); plan.pieces.push(...p.pieces); plan.shapes.push(...p.shapes);
      if (i === Math.max(0, cuts.findIndex((u) => u >= 0) - 1)) plan.startAt = p.startAt;
    }
  }
  const area = polyArea(outline);
  const wood = finish.kind === 'other' ? [] : [outline];
  return {
    key: 1, a0: sh.uMin, a1: sh.uMax, top: [], hmax: sh.L, dir: 'vertical', finish, wood,
    other: finish.kind === 'other' ? [{ ring: outline, area }] : [], woodArea: finish.kind === 'other' ? 0 : area, otherArea: finish.kind === 'other' ? area : 0,
    anchor: shift, plan, ref: sh.ref, label: m.refs[0]?.name ?? 'Dach', detail: '', kind: 'roof', outline, up: false, folds, param: 'o1',
  };
}

/** Faces of a flat room. Keys: 1 ceiling, 2 / 3 the walls the boards do not run toward, 4 / 5 the walls they run toward (joined to the ceiling when `join`). */
function flatFaces(m: FlatModel, spec: RoomSpec, pl: Plate, firstId: number, only: number[]): RoomFace[] {
  const bx = m.p.bx!, bz = m.p.bz!, H = m.p.H!, dz = !!m.dz;
  const out: RoomFace[] = [];
  let id = firstId;
  const push = (f: RoomFace) => { out.push(f); id += f.plan.rows.length; };
  if (only.includes(1)) {
    const finish = finishOf(spec, 1);
    const alongB = dz; // boards along z when dz
    const outline: Ring = [[0, 0], [bx, 0], [bx, bz], [0, bz]];
    const shift = (m.p.ZO ?? 0) + (m.p.o1 ?? 0);
    const wood = finish.kind === 'other' ? [] : [outline];
    const plan = boardsOf({ region: wood, along: alongB ? 'b' : 'a', pitch: pl.BW, anchor: shift, PL: pl.PL, mode: pl.mode, surf: 1, firstId: id });
    const area = bx * bz;
    push({
      key: 1, a0: 0, a1: bx, top: [], hmax: bz, dir: alongB ? 'vertical' : 'horizontal', finish, wood, other: finish.kind === 'other' ? [{ ring: outline, area }] : [],
      woodArea: finish.kind === 'other' ? 0 : area, otherArea: finish.kind === 'other' ? area : 0, anchor: shift, plan,
      ref: 'R1', label: m.surfs[0]?.label ?? 'Sufit', detail: '', kind: 'ceiling', outline, up: false, folds: [], param: 'o1',
    });
  }
  // wall k: length along the wall
  const wallLen: Record<number, number> = dz ? { 2: bz, 3: bz, 4: bx, 5: bx } : { 2: bx, 3: bx, 4: bz, 5: bz };
  const place: Record<number, string> = dz ? { 2: 'x=0', 3: `x=${Math.round(bx)}`, 4: 'z=0', 5: `z=${Math.round(bz)}` } : { 2: 'z=0', 3: `z=${Math.round(bz)}`, 4: 'x=0', 5: `x=${Math.round(bx)}` };
  for (const key of [2, 3, 4, 5]) {
    if (!only.includes(key)) continue;
    const len = wallLen[key]!;
    const finish = finishOf(spec, key);
    const dir = dirIn(dirOf(spec, key), ['vertical', 'horizontal'], 'vertical') as 'vertical' | 'horizontal';
    const zone = woodZone(finish);
    const shift = m.p['o' + key] ?? 0;
    const anchor = dir === 'vertical' ? (m.p.ZO ?? 0) + shift : (zone?.lo ?? 0) + shift;
    const top: Pt[] = [[0, H], [len, H]];
    const f = buildFace({ key, a0: 0, a1: len, top, dir, finish, anchor, pitch: pl.BW, PL: pl.PL, mode: pl.mode, firstId: id });
    const ref = 'R' + key;
    push({ ...f, ref, label: key <= 3 ? (m.surfs[key - 1]?.label ?? `Ściana ${place[key]}`) : `Ściana ${place[key]}`, detail: place[key]!, kind: 'wall', outline: [[0, 0], [len, 0], [len, H], [0, H]], up: true, folds: [], param: 'o' + key });
  }
  return out;
}

/** The room of a free floor plan: the ceiling (key 1) and a wall per side of the outline (keys WALL0 + i), all as faces. */
/** Height of the house roof above the floor at x (house coordinates, the ridge in the middle). */
export const roofHeight = (r: { W: number; ang: number; HL: number }, x: number): number => r.HL + (r.W / 2 - Math.abs(x - r.W / 2)) * Math.tan((r.ang * Math.PI) / 180);

/** The roof over a free plan: two slopes unrolled (u = arc length from the ridge) and clipped to the plan; boards down the slope or along the ridge. */
function roofOverOutline(spec: RoomSpec, roof: { W: number; ang: number; HL: number }, pl: Plate, firstId: number): RoomFace {
  const ol = spec.outline!, ox = spec.outlineX ?? 0, C = Math.cos((roof.ang * Math.PI) / 180);
  const finish = finishOf(spec, 1);
  const ridge = dirOf(spec, 1) === 'ridge';
  const shift = spec.starts.o1 ?? 0;
  const ring = ol.map((q): Pt => [(ox + q[0] - roof.W / 2) / C, q[1]]) as Ring;
  const uMin = Math.min(...ring.map((q) => q[0])), uMax = Math.max(...ring.map((q) => q[0])), zMax = Math.max(...ring.map((q) => q[1]));
  const parts = [clipToRect([ring], uMin - 1, -1, 0, zMax + 1), clipToRect([ring], 0, -1, uMax + 1, zMax + 1)];
  const plan: BoardPlan = { rows: [], pieces: [], shapes: [], startAt: 0 };
  let id = firstId, got = false;
  if (finish.kind !== 'other') parts.forEach((region, i) => {
    if (!region.length) return;
    const p = boardsOf({ region, along: ridge ? 'b' : 'a', pitch: pl.BW, anchor: shift + (ridge ? 0 : (spec.starts.ZO ?? 0)), PL: pl.PL, mode: pl.mode, surf: 1, firstId: id });
    id += p.rows.length;
    plan.rows.push(...p.rows); plan.pieces.push(...p.pieces); plan.shapes.push(...p.shapes);
    if (i === 1 || !got) plan.startAt = p.startAt;
    got = true;
  });
  const area = ringArea(parts.flat());
  const none = finish.kind === 'other';
  return {
    key: 1, a0: uMin, a1: uMax, top: [], hmax: zMax, dir: ridge ? 'vertical' : 'horizontal', finish, wood: none ? [] : parts.flat(),
    other: none ? [{ ring, area }] : [], woodArea: none ? 0 : area, otherArea: none ? area : 0, anchor: shift, plan,
    ref: 'R1', label: 'Dach', detail: '', kind: 'roof', outline: ring, up: false, folds: uMin < 0 && uMax > 0 ? [0] : [], param: 'o1',
  };
}

function outlineFaces(m: FlatModel, spec: RoomSpec, pl: Plate, firstId: number, roof?: { W: number; ang: number; HL: number }): RoomFace[] {
  const out: RoomFace[] = [];
  let id = firstId;
  const H = m.p.H!, ol = spec.outline!;
  if (spec.ceiling.kind === 'roof' && roof) {
    const ox = spec.outlineX ?? 0;
    const rf = roofOverOutline(spec, roof, pl, id);
    out.push(rf);
    id += rf.plan.rows.length;
    edgesOf(ol).forEach((e) => {
      const key = WALL0 + e.i;
      const finish = finishOf(spec, key);
      const dir = dirIn(dirOf(spec, key), ['vertical', 'horizontal'], 'vertical') as 'vertical' | 'horizontal';
      const zone = woodZone(finish);
      const shiftW = spec.starts['o' + key] ?? 0;
      const xAt = (a: number) => ox + e.a[0] + e.d[0] * a;
      const along = Math.abs(e.d[0]) > 0.5;
      // the top of the wall is the roof line over it: flat for a wall along the ridge, a gable (with a peak at the ridge) across it
      const cuts = along && roof.W / 2 > Math.min(xAt(0), xAt(e.len)) + 1e-6 && roof.W / 2 < Math.max(xAt(0), xAt(e.len)) - 1e-6 ? [(roof.W / 2 - xAt(0)) / e.d[0]] : [];
      const as = [0, ...cuts, e.len];
      const top = as.map((a): Pt => [a, roofHeight(roof, xAt(a))]);
      const hmax = Math.max(...top.map((q) => q[1]));
      const anchor = dir === 'vertical' ? (spec.starts.ZO ?? 0) + shiftW : (zone?.lo ?? 0) + shiftW;
      const f = buildFace({ key, a0: 0, a1: e.len, top, dir, finish, anchor, pitch: pl.BW, PL: pl.PL, mode: pl.mode, firstId: id });
      id += f.plan.rows.length;
      out.push({ ...f, ref: 'R' + key, label: `Ściana ${e.i + 1}`, detail: `${Math.round(e.len)} cm`, kind: 'wall', outline: [[0, 0], [e.len, 0], ...top.slice().reverse()] as Ring, up: true, folds: [], param: 'o' + key, hmax });
    });
    return out;
  }
  const fin = finishOf(spec, 1);
  const dirC = dirOf(spec, 1) === 'ridge' ? 'b' : 'a';
  const shift = (m.p.ZO ?? 0) + (m.p.o1 ?? 0);
  const wood = fin.kind === 'other' ? [] : [ol as Ring];
  const plan = boardsOf({ region: wood, along: dirC, pitch: pl.BW, anchor: shift, PL: pl.PL, mode: pl.mode, surf: 1, firstId: id });
  const ca = polyArea(ol);
  id += plan.rows.length;
  out.push({
    key: 1, a0: 0, a1: Math.max(...ol.map((q) => q[0])), top: [], hmax: Math.max(...ol.map((q) => q[1])), dir: dirC === 'b' ? 'vertical' : 'horizontal', finish: fin, wood,
    other: fin.kind === 'other' ? [{ ring: ol as Ring, area: ca }] : [], woodArea: fin.kind === 'other' ? 0 : ca, otherArea: fin.kind === 'other' ? ca : 0, anchor: shift, plan,
    ref: 'R1', label: 'Sufit', detail: '', kind: 'ceiling', outline: ol as Ring, up: false, folds: [], param: 'o1',
  });
  edgesOf(ol).forEach((e) => {
    const key = WALL0 + e.i;
    const finish = finishOf(spec, key);
    const dir = dirIn(dirOf(spec, key), ['vertical', 'horizontal'], 'vertical') as 'vertical' | 'horizontal';
    const zone = woodZone(finish);
    const shiftW = spec.starts['o' + key] ?? 0;
    const anchor = dir === 'vertical' ? (m.p.ZO ?? 0) + shiftW : (zone?.lo ?? 0) + shiftW;
    const f = buildFace({ key, a0: 0, a1: e.len, top: [[0, H], [e.len, H]], dir, finish, anchor, pitch: pl.BW, PL: pl.PL, mode: pl.mode, firstId: id });
    id += f.plan.rows.length;
    out.push({ ...f, ref: 'R' + key, label: `Ściana ${e.i + 1}`, detail: `${Math.round(e.len)} cm`, kind: 'wall', outline: [[0, 0], [e.len, 0], [e.len, H], [0, H]], up: true, folds: [], param: 'o' + key });
  });
  return out;
}

/** Puts the surfaces that the preset code does not draw onto the model. Rooms whose surfaces are all preset come back unchanged. */
export function withCladding(m: RoomModel, spec: RoomSpec, roof?: { W: number; ang: number; HL: number }): RoomModel {
  const pl = plateOf(m.p);
  if (spec.outline && !isAttic(m)) {
    const faces = outlineFaces(m, spec, pl, 1, roof);
    const present: Record<number, number> = {};
    faces.forEach((f) => { present[f.key] = 1; });
    const refs = faces.map((f) => { const first = f.plan.rows[0], last = f.plan.rows[f.plan.rows.length - 1]; return { id: f.ref, name: f.label, fields: first && last ? (first.id === last.id ? String(first.id) : `${first.id}–${last.id}`) : '', where: `linia łączenia ${f.up ? (f.dir === 'vertical' ? 'x' : 'wys.') : 'u'}=${Math.round(f.plan.startAt)}`, coord: f.detail }; });
    return { ...m, outline: spec.outline, ...(spec.ceiling.kind === 'roof' && roof ? { roof: { ...roof, ox: spec.outlineX ?? 0 } } : {}), faces, legacyOff: [1, 2, 3], spec, present, refs, fields: faces.reduce((a, f) => a + f.plan.rows.length, 0), areaCm2: faces.reduce((a, f) => a + f.woodArea, 0), areaM2: faces.reduce((a, f) => a + f.woodArea, 0) / 1e4 } as RoomModel;
  }
  let id = maxId(m) + 1;
  const faces: RoomFace[] = [];
  const off: number[] = [];
  const add = (fs: RoomFace[]) => fs.forEach((f) => { faces.push(f); off.push(f.key); id += f.plan.rows.length; });
  if (isAttic(m)) {
    if (m.sheet && !roofIsPreset(spec)) add([ridgeFace(m, spec, pl, id)]);
    m.walls.forEach((w) => { if (!wallIsPreset(spec, w.rid)) add([gableFace(m, spec, w, pl, id)]); });
  } else if (!flatIsPreset(spec)) {
    const joined = spec.join && flatBand(spec) !== null && finishOf(spec, 1).kind === 'wood';
    const preset = (k: number) => (dirOf(spec, k) ?? 'vertical') === 'vertical' && finishOf(spec, k).kind === 'split' && (finishOf(spec, k) as { wood: string }).wood === 'above';
    const only: number[] = [];
    if (!joined) only.push(1);
    // joined: the walls the ceiling runs onto are part of the ceiling; the others are preset bands when they match the band, else faces
    const bandHb = flatBand(spec);
    const bandOk = (k: number) => joined && preset(k) && bandHb !== null && (finishOf(spec, k) as { at: number }).at === m.p.H! - bandHb;
    if (joined) { [2, 3].forEach((k) => { if (!bandOk(k)) only.push(k); }); }
    else only.push(2, 3, 4, 5);
    add(flatFaces(m, spec, pl, id, only));
  }
  if (!faces.length) return { ...m, spec };
  const legacyFields = (k: number): number => (isAttic(m) ? (k === 1 ? m.sheet?.strips.length ?? 0 : m.walls.find((w) => w.rid === k)?.strips.length ?? 0) : m.surfs.find((s) => s.key === k)?.cols.length ?? 0);
  const fields = m.fields - off.reduce((a, k) => a + legacyFields(k), 0) + faces.reduce((a, f) => a + f.plan.rows.length, 0);
  const refs = m.refs.map((r) => {
    const f = faces.find((x) => x.ref === r.id);
    if (!f) return r;
    const first = f.plan.rows[0], last = f.plan.rows[f.plan.rows.length - 1];
    const at = Math.round(f.plan.startAt);
    return { ...r, name: f.label, fields: first && last ? (first.id === last.id ? String(first.id) : `${first.id}–${last.id}`) : '', where: `linia łączenia ${f.up ? (f.dir === 'vertical' ? 'x' : 'wys.') : 'u'}=${at}`, coord: f.detail };
  });
  const present = { ...m.present };
  faces.forEach((f) => { present[f.key] = 1; });
  return { ...m, faces, legacyOff: off, spec, fields, refs, present };
}

/** Net wood area (cm²) of the room after openings: the preset areas of the surfaces that stay plus the faces' boards. */
export function woodAreaCm2(m: RoomModel, openings: Opening[] = []): number {
  if (!m.faces?.length) return m.areaCm2;
  return roomPieces(m, openings).reduce((a, q) => a + pieceArea(q), 0);
}
/** Area (cm²) of surfaces covered with something other than wood. */
export const otherAreaCm2 = (m: RoomModel): number => (m.faces ?? []).reduce((a, f) => a + f.otherArea, 0);

export interface RoomBuildContext {
  /** the house roof with this room's overrides */
  roof: { W: number; ang: number; HL: number };
  /** plate inputs: PL, PW, trim, trimL, pf (what the engines take beside the room's own numbers) */
  plate: Params;
  cfg: SheetConfig;
  lang?: Lang;
}

/** The room model of a spec: the engine's model, with the roof sheet, plus the faces of the surfaces the preset code does not draw. */
export function buildRoom(spec: RoomSpec, ctx: RoomBuildContext): RoomModel {
  const { type, params } = engineInput(spec, ctx.roof);
  const o1 = params.o1 ?? 0;
  const input: Params = { ...params, ...ctx.plate, ...(type === 'lazienka-2' ? {} : { o2: o1, o3: o1, o4: o1, o5: o1 }), winOn: 0 };
  const base = buildModel(type, input, ctx.lang ?? 'pl');
  const m = isAttic(base) ? withSheet(base, ctx.cfg, ctx.lang ?? 'pl') : base;
  return withCladding(m, spec, ctx.roof);
}

export { ringArea };
