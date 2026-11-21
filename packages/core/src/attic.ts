// "attic-gable" room template: one parametric model for salon, sypialnia and łazienka 1 (presets).
// Port of the artifact's `norm` / `model` / `cutPieces` (see fixtures/okladzina-domu.html).
import { MSG, type Lang } from './messages';
import { splitLong } from './nest';
import { deriveTg, type ProfileMode } from './plate';
import { applyOpenings, type Opening } from './openings';
import type { RoofSheet } from './sheet';
import type { BoardSurface, Col, EdgeKind, FieldDef, GableWall, Piece, Pt, RefPoint, RoomModelBase } from './types';
import { f, stripDecimals, type Params } from './util';

export type AtticPresetId = 'salon' | 'sypialnia' | 'lazienka-1';

export interface AtticPreset {
  id: AtticPresetId;
  /** short key used in the shared cut */
  roomKey: string;
  name: string;
  defaults: Params;
  fields: FieldDef[];
  limits: Record<string, [number, number]>;
  /** names of the nine start points R1..R9 */
  shiftNames: string[];
  endWord: string;
}

const cm = 'cm';
const fd = (group: string, key: string, label: string, unit = cm): FieldDef => ({ group, key, label, unit });
const zeros = { o1: 0, o2: 0, o3: 0, o4: 0, o5: 0, o6: 0, o7: 0, o8: 0, o9: 0 };
const baseShift = ['lewa połać', 'prawa przy wnęce', 'prawa połać', 'prawa przy wycięciu narożnym', 'ściana wycięcia narożnego', 'szczyt z=0', 'szczyt przy wnęce', 'szczyt przy wycięciu narożnym', 'szczyt z końca'];

export const SALON: AtticPreset = {
  id: 'salon',
  roomKey: 'S',
  name: 'Salon',
  defaults: { W: 548, L: 980, ang: 40, HL: 107, niche: 17, dA: 140, ZA: 415, wB: 349, dB: 60, cutOn: 1, cutH: 56, winOn: 1, winD: 50, PL: 499, PW: 125, ZO: 415, XO: 0, ...zeros },
  fields: [
    fd('Bryła', 'W', 'Szerokość wnętrza'), fd('Bryła', 'L', 'Długość salonu'), fd('Bryła', 'ang', 'Kąt dachu', '°'),
    fd('Bryła', 'HL', 'Wysokość pasa pod skosem (lewa)'), fd('Bryła', 'niche', 'Odsunięcie ściany (prawa)'),
    fd('Wycięcia', 'dA', 'Wnęka: szerokość'), fd('Wycięcia', 'ZA', 'Wnęka: długość'),
    fd('Wycięcia', 'wB', 'Wycięcie narożne: szerokość'), fd('Wycięcia', 'dB', 'Wycięcie narożne: głębokość'),
    fd('Wycięcia', 'cutOn', 'Wycięcie w ścianie z końca', 'chk'), fd('Wycięcia', 'cutH', 'Wysokość tego wycięcia'),
    fd('Okno', 'winOn', 'Okno w ścianie z=0', 'chk'), fd('Okno', 'winD', 'Odstęp okna od dachu, ściany i podłogi'),
    fd('Płyty', 'PL', 'Długość płyty'), fd('Płyty', 'PW', 'Szerokość płyty'),
    fd('Start montażu', 'ZO', 'Start domyślny na dachu (z)'), fd('Start montażu', 'XO', 'Start domyślny na szczytach (x)'),
  ],
  limits: { W: [200, 1200], L: [200, 3000], ang: [10, 70], HL: [0, 300], niche: [0, 100], dA: [10, 400], ZA: [10, 2900], wB: [1, 1200], dB: [10, 400], cutH: [0, 250], winD: [10, 200], PL: [100, 1000], PW: [20, 300], ZO: [0, 3000], XO: [-1000, 1000] },
  shiftNames: baseShift,
  endWord: 'salonu',
};

export const SYPIALNIA: AtticPreset = {
  id: 'sypialnia',
  roomKey: 'Sy',
  name: 'Sypialnia',
  defaults: { W: 548, Wb: 396, L: 330, ang: 40, HL: 107, niche: 0, dA: 140, ZA: 415, wB: 349, dB: 60, cutOn: 0, cutH: 56, capOn: 1, capH: 300, winOn: 0, winD: 50, PL: 499, PW: 125, ZO: 0, XO: 0, cA: 0, cB: 0, ...zeros },
  fields: [
    fd('Bryła', 'W', 'Szerokość dachu (domu)'), fd('Bryła', 'Wb', 'Szerokość sypialni od lewej ściany'), fd('Bryła', 'L', 'Długość sypialni (wzdłuż kalenicy)'), fd('Bryła', 'ang', 'Kąt dachu', '°'),
    fd('Bryła', 'HL', 'Wysokość pasa pod skosem (lewa)'), fd('Bryła', 'capOn', 'Płaski sufit u góry', 'chk'), fd('Bryła', 'capH', 'Wysokość płaskiego sufitu'),
    fd('Płyty', 'PL', 'Długość płyty'), fd('Płyty', 'PW', 'Szerokość płyty'),
    fd('Start montażu', 'ZO', 'Start domyślny na dachu (z)'), fd('Start montażu', 'XO', 'Start domyślny na szczytach (x)'),
  ],
  limits: { W: [200, 1200], Wb: [100, 1200], L: [200, 3000], ang: [10, 70], HL: [0, 300], niche: [0, 100], dA: [10, 400], ZA: [10, 2900], wB: [1, 1200], dB: [10, 400], cutH: [0, 250], winD: [10, 200], PL: [100, 1000], PW: [20, 300], ZO: [0, 3000], XO: [-1000, 1000] },
  shiftNames: baseShift,
  endWord: 'salonu',
};

export const LAZIENKA1: AtticPreset = {
  id: 'lazienka-1',
  roomKey: 'Ł1',
  name: 'Łazienka 1',
  defaults: { W: 548, Wb: 396, bw: 200, L: 274, ang: 40, HL: 107, niche: 0, dA: 140, ZA: 415, wB: 349, dB: 60, cutOn: 0, cutH: 56, capOn: 0, capH: 300, winOn: 0, winD: 50, PL: 499, PW: 125, ZO: 0, XO: 0, cA: 0, cB: 0, ...zeros },
  fields: [
    fd('Bryła', 'W', 'Szerokość dachu (domu)'), fd('Bryła', 'bw', 'Szerokość łazienki od prawej ściany'), fd('Bryła', 'L', 'Długość łazienki (wzdłuż kalenicy)'), fd('Bryła', 'ang', 'Kąt dachu', '°'),
    fd('Bryła', 'HL', 'Wysokość pasa pod skosem (lewa)'),
    fd('Płyty', 'PL', 'Długość płyty'), fd('Płyty', 'PW', 'Szerokość płyty'),
    fd('Start montażu', 'ZO', 'Start domyślny na dachu (z)'), fd('Start montażu', 'XO', 'Start domyślny na szczytach (cm od ścianki)'),
  ],
  limits: { W: [200, 1200], Wb: [100, 1200], L: [200, 3000], ang: [10, 70], HL: [0, 300], niche: [0, 100], dA: [10, 400], ZA: [10, 2900], wB: [1, 1200], dB: [10, 400], cutH: [0, 250], winD: [10, 200], PL: [100, 1000], PW: [20, 300], ZO: [0, 3000], XO: [-1000, 1000] },
  shiftNames: baseShift.map((s, i) => (i === 4 ? 'ścianka działowa' : s)),
  endWord: 'łazienki',
};

export const ATTIC_PRESETS: Record<AtticPresetId, AtticPreset> = { salon: SALON, sypialnia: SYPIALNIA, 'lazienka-1': LAZIENKA1 };

type Pin = Record<string, unknown> | null | undefined;

/** Edge trim (cm) per plate edge, optional input shared with the cut settings: the usable board is PW - 2*trim wide. */
export function trimOf(pin: Pin): number {
  const v = Number(pin ? pin.trim : 0);
  return isFinite(v) && v > 0 ? Math.min(v, 10) : 0;
}

/** Profile of the plates the room is clad with: 0 plain, 1 long edges, 2 all edges (optional input, set by the app from the project's plate). */
export function profileOf(pin: Pin): number {
  const v = Number(pin ? pin.pf : 0);
  return v >= 2 ? 2 : v >= 1 ? 1 : 0;
}
export const PF_MODE: ProfileMode[] = ['none', 'long', 'all'];
/** Edge trim along the plate length when it differs from the trim across (profiled edges are not trimmed). */
export function trimLOf(pin: Pin, fallback: number): number {
  if (!pin || pin.trimL === undefined) return fallback;
  const v = Number(pin.trimL);
  return isFinite(v) && v > 0 ? Math.min(v, 10) : 0;
}

export interface NormResult {
  p: Params;
  w: string[];
}

/** Clamps the inputs to sensible ranges and collects the corrections as warnings. */
export function normAttic(preset: AtticPreset, pin: Pin, lang: Lang = 'pl'): NormResult {
  const msg = MSG[lang];
  const DEF = preset.defaults;
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
  const skip = preset.id === 'salon' ? ['dA', 'wB', 'ZA', 'dB', 'winD', 'niche'] : ['Wb', 'dA', 'wB', 'ZA', 'dB', 'winD', 'niche'];
  for (const k of Object.keys(preset.limits)) {
    if (skip.includes(k)) continue;
    cl(k, preset.limits[k]![0], preset.limits[k]![1], k);
  }
  for (let oi = 1; oi <= 9; oi++) cl('o' + oi, -1000, 1000, msg.shiftLabel(oi));
  p.trim = trimOf(pin);
  if (profileOf(pin)) p.pf = profileOf(pin);
  if (pin && pin.trimL !== undefined) p.trimL = trimLOf(pin, p.trim);
  const hw = p.W! / 2;
  const flag = (k: string) => (pin && pin[k] !== undefined ? (pin[k] ? 1 : 0) : DEF[k]!);
  if (preset.id === 'salon') {
    cl('niche', 0, Math.min(100, hw - 30), msg.niche);
    const XR = hw - p.niche!;
    cl('dA', 10, XR - 10, msg.recessW);
    cl('ZA', 10, p.L! - 30, msg.recessL);
    cl('wB', hw + 1, p.W! - p.niche! - 1, msg.builtInW);
    cl('dB', 10, Math.max(10, p.L! - p.ZA! - 10), msg.builtInD);
    cl('winD', 10, hw - 10, msg.windowGap);
    const c = pin ? pin.cutOn : undefined;
    p.cutOn = c === 0 || c === false ? 0 : c !== undefined ? (c ? 1 : 0) : DEF.cutOn!;
    p.winOn = flag('winOn');
    p.cA = 1;
    p.cB = 1;
    return { p, w };
  }
  if (preset.id === 'sypialnia') {
    cl('Wb', hw + 20, p.W! - 1, msg.bedroomW);
    p.niche = p.W! - p.Wb!;
    p.capOn = flag('capOn');
    if (p.capOn) {
      const lo = p.HL! + 10;
      cl('capH', Math.ceil(lo), Math.max(Math.ceil(lo), 3000), msg.capH);
      p.capMin = Math.ceil(lo);
    }
  } else {
    cl('bw', 50, hw - 10, msg.bathW);
    p.niche = 0;
    p.capOn = 0;
  }
  const XR = hw - p.niche!;
  p.cA = flag('cA');
  p.cB = flag('cB');
  if (p.cA) { cl('dA', 10, XR - 10, msg.recessW); cl('ZA', 10, p.L! - 30, msg.recessL); }
  if (p.cB) { cl('wB', hw + 1, p.W! - p.niche! - 1, msg.builtInW); cl('dB', 10, Math.max(10, p.L! - (p.cA ? p.ZA! : 0) - 10), msg.builtInD); }
  cl('winD', 10, hw - 10, msg.windowGap);
  // sypialnia and łazienka 1 have no windows, recess, built-in or end-wall cut
  p.winOn = 0; p.cutOn = 0; p.cA = 0; p.cB = 0;
  if (w.length) w = w.map(stripDecimals);
  return { p, w };
}

export interface AtticModel extends RoomModelBase {
  preset: AtticPresetId;
  A: number; C: number; hw: number; XR: number; XA: number; XB: number; ZB: number; ZA: number; L: number;
  RID: number; HR: number; HL: number; XT?: number;
  cap: boolean; xc: number; bp: number[];
  y: (x: number) => number;
  profile: (a: number, b: number) => Pt[];
  walls: GableWall[];
  win: Pt[] | null;
  ZO: number; XO: number; plates80: number;
  /** the roof and knee walls as one unrolled sheet (set by withSheet); then the pieces of the roof come from it */
  sheet?: RoofSheet;
}

export function atticModel(preset: AtticPreset, pin: Pin, lang: Lang = 'pl'): AtticModel {
  const msg = MSG[lang];
  const n = normAttic(preset, pin, lang);
  const p = n.p;
  const isL1 = preset.id === 'lazienka-1', isSalon = preset.id === 'salon';
  const A = Math.tan((p.ang! * Math.PI) / 180), C = Math.cos((p.ang! * Math.PI) / 180);
  const hw = p.W! / 2, XR = hw - p.niche!;
  const XA = p.cA ? XR - p.dA! : XR, XB = p.cB ? -hw + p.wB! : -hw, ZB = p.cB ? p.L! - p.dB! : p.L!, ZA = p.cA ? p.ZA! : 0;
  const L = p.L!, RID = p.HL! + hw * A, BW = p.PW! - 2 * p.trim!, ZO = p.ZO!, XO = p.XO!;
  const XT = isL1 ? XR - p.bw! : undefined;
  const capEff = !isL1 && !!(p.capOn && p.capH! < RID - 1);
  const CAPH = isL1 ? RID - XT! * A : capEff ? p.capH! : RID;
  const xc = capEff ? (RID - CAPH) / A : 0;
  const y = (x: number) => (capEff ? (x < -xc ? RID + x * A : CAPH) : RID - Math.abs(x) * A);
  const rl = (x: number) => (x <= xc ? x : xc + (x - xc) / C);
  const bp = capEff ? [-xc] : [0];
  const rr = (x: number) => (capEff ? x : x / C);
  const profile = (a: number, b: number): Pt[] => {
    const o: Pt[] = [[a, y(a)]];
    bp.forEach((q) => { if (q > a + 1e-6 && q < b - 1e-6) o.push([q, y(q)]); });
    o.push([b, y(b)]);
    return o;
  };
  const HR = y(XR);
  const cols = (z0: number, z1: number, zo: number): Array<[number, number]> => {
    const o: Array<[number, number]> = [];
    for (let k = Math.floor((z0 - zo) / BW + 1e-9); zo + k * BW < z1 - 1e-9; k++) {
      const s = Math.max(z0, zo + k * BW), e = Math.min(z1, zo + (k + 1) * BW);
      if (e - s > 1) o.push([s, e]);
    }
    return o;
  };
  const strips = (a: number, b: number, xo: number): Array<[number, number]> => {
    const o: Array<[number, number]> = [];
    let x = a;
    while (x < b - 1e-6) {
      let xe = xo + (Math.floor((x - xo) / BW + 1e-9) + 1) * BW;
      if (xe <= x + 1e-6) xe += BW;
      xe = Math.min(b, xe);
      if (xe - x > 0.5) o.push([x, xe]);
      x = xe;
    }
    return o;
  };
  let id = 0;
  const surfs: BoardSurface[] = [];
  const refs: RefPoint[] = [];
  let area = 0, fields = 0;
  const a2 = ZO + p.o3!, zj = a2 + Math.floor((ZB - a2) / BW) * BW, ZJ = p.cB && zj > ZA + 1 && ZB - zj < 10 ? zj : ZB;
  const nearest = (cand: number[], anchor: number) => cand.reduce((b, c) => (Math.abs(c - anchor) < Math.abs(b - anchor) ? c : b), cand[0]!);

  function addBoard(title: string, u: number, z0: number, z1: number, cut: number | null, notch: Pt | null, desc: string | undefined, lastTop: { x: number; h: number } | undefined, anchor: number, rid: number) {
    const cs: Col[] = cols(z0, z1, anchor).map((c) => ({ id: ++id, a: c[0], b: c[1] }));
    if (!cs.length) return;
    const cand = [z0, z1];
    cs.forEach((c) => cand.push(c.a, c.b));
    const zr = nearest(cand, anchor);
    const s: BoardSurface = {
      flat: capEff && rid < 5 ? (rid === 1 ? xc : cut ?? 0) : 0, key: rid, anchor, kind: 'board', title, u, z0, z1, cut, notch, cols: cs, zr, ur: 0, ref: '',
      desc, top: lastTop,
    };
    s.ref = 'R' + (isSalon ? refs.length + 1 : rid);
    s.ur = notch && zr > notch[0] ? notch[1] : 0;
    surfs.push(s);
    area += (z1 - z0) * u - (notch ? (z1 - notch[0]) * notch[1] : 0);
    fields += cs.length;
    const first = cs[0]!, last = cs[cs.length - 1]!;
    refs.push({
      id: s.ref, name: title, fields: first.id === last.id ? String(first.id) : first.id + '–' + last.id,
      where: lastTop ? msg.refWhereTop(f(zr)) : isL1 ? msg.refWherePartition(f(zr)) : msg.refWhereRidge(f(zr)),
      coord: lastTop ? msg.coordTop(f(lastTop.x), f(lastTop.h), f(zr)) : isL1 ? msg.coordTop(f(XT!), f(CAPH), f(zr)) : msg.coordRidge(f(CAPH), f(zr)),
    });
  }
  if (isL1) {
    addBoard(msg.boardRightSlope, rr(XR - XT!) + HR, 0, L, rr(XR - XT!), null, undefined, undefined, ZO + p.o3!, 3);
    addBoard(msg.partition(f(XT!)), CAPH, 0, L, null, null, '', { x: XT!, h: CAPH }, ZO + p.o5!, 5);
  } else {
    addBoard(msg.boardLeft, rl(hw) + p.HL!, 0, ZB, rl(hw), null, undefined, undefined, ZO + p.o1!, 1);
    addBoard(msg.boardRightRecess, rr(XA) + y(XA), 0, ZA, rr(XA), null, undefined, undefined, ZO + p.o2!, 2);
    addBoard(msg.boardRightWall(f(XR)), rr(XR) + HR, ZA, ZJ, rr(XR), null, undefined, undefined, ZO + p.o3!, 3);
    addBoard(msg.boardRightBuiltIn, rr(XR) + HR, ZJ, L, rr(XR), [ZB, rl(XB)], undefined, undefined, ZO + p.o4!, 4);
    addBoard(msg.boardBuiltInWall(f(XB)), y(XB), ZB, L, null, null, '', { x: XB, h: y(XB) }, ZO + p.o5!, 5);
  }
  // gable walls
  const cutOn = !!(p.cutOn && p.cB);
  const x0a = isL1 ? XT! : -hw;
  let walls: GableWall[] = [
    { on: 1, z: 0, x0: x0a, x1: XA, bs: 0, title: msg.wallZ0(!!p.winOn, isSalon) },
    { on: p.cA!, z: ZA, x0: XA, x1: XR, bs: 0, title: msg.wallRecess(f(ZA)) },
    { on: p.cB!, z: ZB, x0: -hw, x1: XB, bs: 0, title: msg.wallBuiltIn(f(ZB)) },
    { on: 1, z: L, x0: isL1 ? XT! : p.cB ? XB : -hw, x1: XR, bs: cutOn ? p.cutH! : 0, title: msg.wallEnd(f(L), cutOn ? f(p.cutH!) : null) },
  ].map((w) => ({ ...w, anchor: 0, rid: 0, strips: [], xr: 0, ref: '' }));
  const stripArea = (a: number, b: number, bs: number) => {
    const pr = profile(a, b);
    let t = 0;
    for (let i = 0; i < pr.length - 1; i++) t += ((pr[i]![1] - bs + (pr[i + 1]![1] - bs)) / 2) * (pr[i + 1]![0] - pr[i]![0]);
    return t;
  };
  walls.forEach((w, wi) => {
    if (!w.on) return;
    const an = (isL1 ? XT! : 0) + XO + p['o' + (6 + wi)]!;
    w.anchor = an;
    w.rid = 6 + wi;
    w.strips = strips(w.x0, w.x1, an).map((s) => ({ id: ++id, a: s[0], b: s[1] }));
    const cand = [w.x0, w.x1];
    w.strips.forEach((s) => cand.push(s.a, s.b));
    w.xr = nearest(cand, an);
    w.ref = 'R' + (isSalon ? refs.length + 1 : 6 + wi);
    w.strips.forEach((s) => { area += stripArea(s.a, s.b, w.bs); });
    fields += w.strips.length;
    const firstS = w.strips[0], lastS = w.strips[w.strips.length - 1];
    refs.push({
      id: w.ref, name: msg.gableTitle(w.title), fields: firstS && lastS ? firstS.id + '–' + lastS.id : '', where: msg.refWhereStrip(f(w.xr)),
      coord: msg.coordStrip(f(w.xr), f(w.bs), f(w.z)),
    });
  });
  walls = walls.filter((w) => w.on && w.strips.length);
  const winOnWall = !!p.winOn || isSalon;
  surfs.forEach((q) => {
    const k = q.key;
    q.label = k === 1 ? msg.lblLeft : k === 2 ? msg.lblRecess : k === 3 ? (isL1 ? msg.lblRightSlope : msg.lblRightWall) : k === 4 ? msg.lblBuiltIn : isL1 ? msg.lblPartition : msg.lblBuiltInWall;
    q.detail = k === 3 && !isL1 ? `x=${f(XR)}` : k === 5 ? `x=${f(isL1 ? XT! : XB)}` : '';
  });
  walls.forEach((w) => {
    const wi = w.rid - 6;
    w.label = wi === 0 ? (winOnWall ? msg.lblWallWin : msg.lblWallStart) : wi === 1 ? msg.lblWallRecess : wi === 2 ? msg.lblWallBuiltIn : msg.lblWallEnd;
    w.detail = `z=${f(w.z)}` + (wi === 3 && cutOn ? ', ' + msg.detailCutFrom(f(p.cutH!)) : '');
  });
  const present: Record<number, number> = {};
  surfs.forEach((q) => { present[q.key] = 1; });
  walls.forEach((w) => { present[w.rid] = 1; });
  if (!isSalon) refs.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  let win: Pt[] | null = null;
  if (p.winOn) {
    const wx = -hw + p.winD!;
    if (wx < -1) {
      win = [[wx, p.winD!], [0, p.winD!], [0, CAPH - (capEff ? p.winD! : p.winD! / C)], [wx, y(wx) - p.winD! / C]];
      let s2 = 0;
      for (let i = 0; i < 4; i++) { const a = win[i]!, b = win[(i + 1) % 4]!; s2 += a[0] * b[1] - b[0] * a[1]; }
      area -= Math.abs(s2) / 2;
    }
  }
  const plate = p.PL! * p.PW!;
  return {
    preset: preset.id, XT, p, warn: n.w, A, C, hw, XR, XA, XB, ZB, ZA, L, RID, TOPH: CAPH, cap: capEff, xc, bp, profile, HR, HL: p.HL!, y,
    surfs, walls, present, refs, win, areaCm2: area, areaM2: area / 1e4, fields, plate, ZO, XO,
    minPlates: Math.ceil(area / plate), plates80: Math.ceil(area / plate / 0.8),
  };
}

/** Pieces to cut: one per board column (split at PL), gable strips as trapezoids, equal neighbours paired head to tail. */
export function atticPieces(m: AtticModel, openings: Opening[] = []): Piece[] {
  const out: Piece[] = [];
  const { y, p } = m;
  const PL = p.PL! - 2 * (p.trimL ?? p.trim!);
  const mode = PF_MODE[p.pf ?? 0]!;
  const side = (inside: boolean): EdgeKind => (inside ? 'joint' : 'wall');
  if (m.sheet) out.push(...m.sheet.pieces);
  else m.surfs.forEach((s) => {
    s.cols.forEach((c) => {
      const parts: Array<{ w: number; l: number; cut: number | null; w0: EdgeKind; w1: EdgeKind; u0: number; z0: number }> = [];
      const cutS = s.cut ?? null;
      const w0 = side(c.a > s.z0 + 0.5), w1 = side(c.b < s.z1 - 0.5);
      if (s.notch) {
        const wA = Math.min(c.b, s.notch[0]) - c.a, wB = c.b - Math.max(c.a, s.notch[0]);
        if (wA > 0.5) parts.push({ w: wA, l: s.u, cut: cutS, w0, w1: c.b > s.notch[0] + 0.5 ? 'wall' : w1, u0: 0, z0: c.a });
        if (wB > 0.5) parts.push({ w: wB, l: s.u - s.notch[1], cut: cutS ? cutS - s.notch[1] : null, w0: c.a < s.notch[0] - 0.5 ? 'wall' : w0, w1, u0: s.notch[1], z0: Math.max(c.a, s.notch[0]) });
      } else parts.push({ w: c.b - c.a, l: s.u, cut: cutS, w0, w1, u0: 0, z0: c.a });
      parts.forEach((pt) => {
        let l = pt.l, first = true, off = pt.u0;
        while (l > PL + 1e-6) {
          out.push({ kind: 'rect', l: PL, w: pt.w, ids: [c.id], cut: null, edges: { l0: first ? 'wall' : 'joint', l1: 'joint', w0: pt.w0, w1: pt.w1 }, src: { kind: 'board', surf: s.key, u0: off, z0: pt.z0 } });
          l -= PL;
          off += PL;
          first = false;
        }
        out.push({ kind: 'rect', l, w: pt.w, ids: [c.id], cut: l === pt.l ? pt.cut : null, edges: { l0: first ? 'wall' : 'joint', l1: 'wall', w0: pt.w0, w1: pt.w1 }, src: { kind: 'board', surf: s.key, u0: off, z0: pt.z0 } });
      });
    });
  });
  m.walls.forEach((w) => {
    const bs = w.bs, st = w.strips;
    let i = 0;
    const crosses = (q: Col) => m.bp.some((b) => b > q.a + 1e-6 && b < q.b - 1e-6);
    const bottom: EdgeKind = bs > 0 ? 'opening' : 'wall';
    while (i < st.length) {
      const s = st[i]!, n = st[i + 1];
      let paired = false;
      if (mode === 'none' && n && !crosses(s) && !crosses(n) && Math.abs(s.b - s.a - (n.b - n.a)) < 0.5) {
        const ya = y(s.a) - bs, yb = y(s.b) - bs, yc = y(n.b) - bs, tot = ya + yc;
        if (tot <= PL && Math.abs(yb - (ya + yc) / 2) < 0.5) {
          out.push({ kind: 'pair', l: tot, w: s.b - s.a, ids: [s.id, n.id], ya, yb, yc, edges: { l0: bottom, l1: 'wall', w0: side(s.a > w.x0 + 0.5), w1: side(n.b < w.x1 - 0.5) }, src: { kind: 'gable', surf: w.rid, u0: bs, z0: s.a } });
          i += 2;
          paired = true;
        }
      }
      if (!paired) {
        const prof = m.profile(s.a, s.b).map((q): Pt => [(q[0] - s.a) / (s.b - s.a), q[1] - bs]);
        const ha = prof[0]![1], hb = prof[prof.length - 1]![1];
        out.push({ kind: 'trap', l: Math.max(...prof.map((q) => q[1])), w: s.b - s.a, ids: [s.id], ha, hb, prof, edges: { l0: bottom, l1: 'wall', w0: side(s.a > w.x0 + 0.5), w1: side(s.b < w.x1 - 0.5) }, src: { kind: 'gable', surf: w.rid, u0: bs, z0: s.a } });
        i++;
      }
    }
  });
  // gable strips taller than the plate are split like boards (the artifact placed them silently, overflowing the plate)
  out.forEach((q) => { const g = deriveTg(q.edges, mode); if (g) q.tg = g; });
  return splitLong(applyOpenings(out, openings), PL, mode === 'all').pieces;
}
