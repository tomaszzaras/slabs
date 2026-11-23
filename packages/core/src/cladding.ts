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

/** Puts the surfaces that the preset code does not draw onto the model. Rooms whose surfaces are all preset come back unchanged. */
export function withCladding(m: RoomModel, spec: RoomSpec): RoomModel {
  const pl = plateOf(m.p);
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
  return withCladding(m, spec);
}

export { ringArea };
