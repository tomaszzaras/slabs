// "flat-ceiling" room template (łazienka 2): boards across the ceiling that wrap onto two opposite walls,
// the two other walls get a band of vertical boards.
import { MSG, type Lang } from './messages';
import type { BoardSurface, Col, EdgeKind, FieldDef, Piece, RefPoint, RoomModelBase } from './types';
import { PF_MODE, profileOf, trimLOf, trimOf } from './attic';
import { deriveTg } from './plate';
import { applyOpenings, type Opening } from './openings';
import { f, stripDecimals, type Params } from './util';

export interface FlatPreset {
  id: 'lazienka-2';
  roomKey: string;
  name: string;
  defaults: Params;
  fields: FieldDef[];
  limits: Record<string, [number, number]>;
  shiftNames: string[];
}

const fd = (group: string, key: string, label: string, unit = 'cm'): FieldDef => ({ group, key, label, unit });

export const LAZIENKA2: FlatPreset = {
  id: 'lazienka-2',
  roomKey: 'Ł2',
  name: 'Łazienka 2',
  defaults: { bx: 149, bz: 278, H: 250, hb: 66, dz: 0, PL: 499, PW: 125, ZO: 0, o1: 0, o2: 0, o3: 0, o4: 0, o5: 0, o6: 0, o7: 0, o8: 0, o9: 0 },
  fields: [
    fd('Pomieszczenie', 'bx', 'Szerokość (x)'), fd('Pomieszczenie', 'bz', 'Długość (z)'), fd('Pomieszczenie', 'hb', 'Wysokość opaski na ścianach'),
    fd('Pomieszczenie', 'H', 'Wysokość pomieszczenia (tylko model 3D)'),
    fd('Układ desek', 'dz', 'Deski biegną wzdłuż długości (z)', 'chk'),
    fd('Płyty', 'PL', 'Długość płyty'), fd('Płyty', 'PW', 'Szerokość płyty'),
    fd('Start montażu', 'ZO', 'Start siatki desek (cm od ściany)'),
  ],
  limits: { bx: [50, 1200], bz: [50, 1200], H: [100, 500], hb: [10, 200], PL: [100, 1000], PW: [20, 300], ZO: [0, 3000] },
  shiftNames: ['sufit: siatka desek', 'opaska: pierwsza ściana', 'opaska: druga ściana', '', '', '', '', '', ''],
};

export interface FlatModel extends RoomModelBase {
  Lc: number; Wc: number; U: number; hb: number; dz: number; names: string[];
}

type Pin = Record<string, unknown> | null | undefined;

export function normFlat(pin: Pin, lang: Lang = 'pl'): { p: Params; w: string[] } {
  const msg = MSG[lang];
  const DEF = LAZIENKA2.defaults;
  const p: Params = {};
  let w: string[] = [];
  for (const k of Object.keys(DEF)) {
    const raw = pin ? pin[k] : undefined;
    const v = Number(raw);
    p[k] = isFinite(v) && pin && raw !== '' && raw !== null && raw !== undefined ? v : DEF[k]!;
  }
  const cl = (key: string, lo: number, hi: number, label: string) => {
    if (p[key]! < lo) { p[key] = lo; w.push(msg.minOf(label, lo)); }
    else if (p[key]! > hi) { p[key] = hi; w.push(msg.maxOf(label, hi)); }
  };
  for (const k of Object.keys(LAZIENKA2.limits)) cl(k, LAZIENKA2.limits[k]![0], LAZIENKA2.limits[k]![1], k);
  for (let oi = 1; oi <= 9; oi++) cl('o' + oi, -1000, 1000, msg.shiftLabel(oi));
  cl('hb', 10, Math.max(10, p.H! - 10), msg.bandBelowRoom);
  p.trim = trimOf(pin);
  if (profileOf(pin)) p.pf = profileOf(pin);
  if (pin && pin.trimL !== undefined) p.trimL = trimLOf(pin, p.trim);
  p.dz = p.dz ? 1 : 0;
  if (w.length) w = w.map(stripDecimals);
  return { p, w };
}

function gridCols(len: number, anchor: number, BW: number, idRef: { n: number }): Col[] {
  const cs: Col[] = [];
  for (let k = Math.floor((0 - anchor) / BW + 1e-9); anchor + k * BW < len - 1e-9; k++) {
    const a = Math.max(0, anchor + k * BW), b = Math.min(len, anchor + (k + 1) * BW);
    if (b - a > 1) cs.push({ id: ++idRef.n, a, b });
  }
  return cs;
}
const nearest = (cand: number[], anchor: number) => cand.reduce((b, c) => (Math.abs(c - anchor) < Math.abs(b - anchor) ? c : b), cand[0]!);

export function flatModel(pin: Pin, lang: Lang = 'pl'): FlatModel {
  const msg = MSG[lang];
  const n = normFlat(pin, lang), p = n.p;
  const BW = p.PW! - 2 * p.trim!, hb = p.hb!, dz = p.dz!;
  const Lc = dz ? p.bz! : p.bx!, Wc = dz ? p.bx! : p.bz!, U = hb + Lc + hb, anchor = p.ZO! + p.o1!;
  const idRef = { n: 0 };
  const surfs: BoardSurface[] = [];
  const refs: RefPoint[] = [];
  let area = 0, fields = 0;
  const cs = gridCols(Wc, anchor, BW, idRef);
  const cand = [0, Wc];
  cs.forEach((c) => cand.push(c.a, c.b));
  const zr = nearest(cand, anchor);
  surfs.push({ key: 1, kind: 'board', title: msg.ceilingBoards, u: U, z0: 0, z1: Wc, cuts: [hb, hb + Lc], cols: cs, anchor, zr, ur: 0, ref: 'R1', lab: 'wys.' });
  area += Wc * U;
  fields += cs.length;
  refs.push({
    id: 'R1', name: msg.ceilingRef, fields: cs[0]!.id + '–' + cs[cs.length - 1]!.id,
    where: msg.ceilingWhere(!!dz, f(zr)), coord: msg.ceilingCoord(!!dz, f(zr)),
  });
  const names = [msg.wallAt(0), msg.wallAt(f(dz ? Lc : Wc))];
  for (let q = 0; q < 2; q++) {
    const anc = p.ZO! + p['o' + (2 + q)]!;
    const c2 = gridCols(Lc, anc, BW, idRef);
    const cd2 = [0, Lc];
    c2.forEach((c) => cd2.push(c.a, c.b));
    const zr2 = nearest(cd2, anc);
    const ref = 'R' + (2 + q);
    surfs.push({ key: 2 + q, kind: 'board', title: msg.bandBoards(msg.bandWall(names[q]!)), u: hb, z0: 0, z1: Lc, cuts: [], cols: c2, anchor: anc, zr: zr2, ur: 0, ref, lab: 'wys.' });
    area += Lc * hb;
    fields += c2.length;
    refs.push({ id: ref, name: msg.bandWall(names[q]!), fields: c2[0]!.id + '–' + c2[c2.length - 1]!.id, where: msg.bandWhere(!!dz, f(zr2)), coord: msg.bandCoord(!!dz, f(zr2)) });
  }
  surfs[0]!.label = msg.lblCeiling;
  surfs[1]!.label = msg.lblBandStart; surfs[1]!.detail = `${dz ? 'x' : 'z'}=0`;
  surfs[2]!.label = msg.lblBandEnd; surfs[2]!.detail = `${dz ? 'x' : 'z'}=${f(dz ? Lc : Wc)}`;
  const plate = p.PL! * p.PW!;
  return {
    p, warn: n.w, Lc, Wc, U, hb, dz, surfs, refs, present: { 1: 1, 2: 1, 3: 1 }, areaCm2: area, areaM2: area / 1e4, fields, plate, TOPH: p.H!,
    minPlates: Math.ceil(area / plate), names: names.map((s) => msg.bandWall(s)),
  };
}

export function flatPieces(m: FlatModel, openings: Opening[] = []): Piece[] {
  const out: Piece[] = [];
  const PL = m.p.PL! - 2 * (m.p.trimL ?? m.p.trim!);
  const mode = PF_MODE[m.p.pf ?? 0]!;
  const emit = (surf: number, z0: number, l: number, w: number, ids: number[], cuts: number[], w0: EdgeKind, w1: EdgeKind) => {
    let off = 0, part = 0;
    const tot = Math.ceil(l / PL - 1e-9);
    while (off < l - 1e-6) {
      const len = Math.min(PL, l - off);
      const o = off;
      out.push({
        kind: 'rect', l: len, w, ids, cuts: cuts.filter((c) => c > o + 1 && c < o + len - 1).map((c) => c - o), part: tot > 1 ? ++part + '/' + tot : '',
        edges: { l0: o === 0 ? 'wall' : 'joint', l1: o + len >= l - 1e-6 ? 'wall' : 'joint', w0, w1 }, src: { kind: 'board', surf, u0: o, z0 },
      });
      off += len;
    }
  };
  m.surfs.forEach((s) => s.cols.forEach((c) => emit(s.key, c.a, s.u, c.b - c.a, [c.id], s.cuts ?? [], c.a > s.z0 + 0.5 ? 'joint' : 'wall', c.b < s.z1 - 0.5 ? 'joint' : 'wall')));
  out.forEach((q) => { const g = deriveTg(q.edges, mode); if (g) q.tg = g; });
  return applyOpenings(out, openings);
}
