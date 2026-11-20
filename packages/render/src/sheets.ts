import type { CutResult, Piece, Plate, RoomModel, ShelfPlate } from '@slabs/core';
import { isAttic } from '@slabs/core';
import { PL_LABELS, ROOM_COLORS, T, f, pts, type Labels } from './util';

interface Placed { p: Piece; x: number; y: number }
const lmax = (p: Piece) => Math.max(...p.prof!.map((q) => q[1]));

/** One plate of the per-room plan (the artifact's shelf layout): returns the plate contents and the title. */
export function plateInner(pl: { items: Placed[]; use: number }, idx: number, m: RoomModel, L: Labels = PL_LABELS): { g: string; title: string } {
  const PL = m.p.PL!, PW = m.p.PW!, flat = !isAttic(m);
  let g = `<rect x="0" y="0" width="${PL}" height="${PW}" class="bd"/>`;
  const ids: number[] = [];
  pl.items.forEach((it) => {
    const p = it.p, x = it.x, y_ = it.y, w = p.w, lab = p.ids.join('+');
    p.ids.forEach((i) => ids.push(i));
    const nm = w >= 14 ? 'n' : 'n s';
    if (p.kind === 'rect') {
      g += `<rect x="${x.toFixed(1)}" y="${y_.toFixed(1)}" width="${p.l.toFixed(1)}" height="${w.toFixed(1)}" class="sl"/>`;
      if (flat) {
        const cu = p.cuts || [], lb = lab + (p.part ? ' ' + p.part : '');
        cu.forEach((c) => { g += `<line x1="${(x + c).toFixed(1)}" y1="${y_.toFixed(1)}" x2="${(x + c).toFixed(1)}" y2="${(y_ + w).toFixed(1)}" class="cut"/>`; });
        const bnd = [0, ...cu, p.l], ty = y_ + w / 2 + (w >= 14 ? 5 : 3);
        for (let bi = 0; bi < bnd.length - 1; bi++) if (bnd[bi + 1]! - bnd[bi]! >= 24 || bnd.length === 2) g += T(x + (bnd[bi]! + bnd[bi + 1]!) / 2, ty, lb, nm);
      } else {
        if (p.cut) g += `<line x1="${(x + p.cut).toFixed(1)}" y1="${y_.toFixed(1)}" x2="${(x + p.cut).toFixed(1)}" y2="${(y_ + w).toFixed(1)}" class="cut"/>`;
        g += T(x + (p.cut || p.l) / 2, y_ + w / 2 + (w >= 14 ? 5 : 3), lab, nm);
        if (p.cut && p.l - p.cut >= 24) g += T(x + (p.cut + p.l) / 2, y_ + w / 2 + (w >= 14 ? 5 : 3), lab, nm);
      }
      g += T(x + p.l - 2, y_ + w - 3, f(p.l) + '×' + f(w), 't3', 'end');
    } else if (p.kind === 'pair') {
      g += `<polygon points="${pts([[x, y_], [x + p.ya!, y_], [x + p.yb!, y_ + w], [x, y_ + w]])}" class="sl"/><polygon points="${pts([[x + p.ya!, y_], [x + p.l, y_], [x + p.l, y_ + w], [x + p.yb!, y_ + w]])}" class="sl"/>`;
      g += T(x + Math.min(p.ya!, p.yb!) / 2, y_ + w / 2 + 5, p.ids[0]!, nm) + T(x + p.l - Math.min(p.yb!, p.yc!) / 2, y_ + w / 2 + 5, p.ids[1]!, nm);
      g += T(x + p.l / 2, y_ + w - 3, f(p.ya!) + '→' + f(p.yb!) + ' / ' + f(p.yc!) + '→' + f(p.yb!) + ' (' + f(w) + ')', 't3');
    } else {
      const poly = [[x, y_], ...p.prof!.map((q) => [x + q[1], y_ + w * q[0]]), [x, y_ + w]] as Array<[number, number]>;
      g += `<polygon points="${pts(poly)}" class="sl"/>` + T(x + Math.min(p.ha!, p.hb!) / 2, y_ + w / 2 + (w >= 14 ? 5 : 3), lab, nm) + T(x + p.l - 2, y_ + w - 3, f(p.ha!) + '→' + f(p.hb!) + ' (' + f(w) + ')', 't3', 'end');
    }
  });
  return { g, title: L.plate + ' ' + (idx + 1) + ': ' + L.fieldsWord + ' ' + ids.sort((a, b) => a - b).join(', ') + ' · ' + L.utilisation + ' ' + Math.round(pl.use * 100) + '%' };
}

/** SVG strings of the per-room shelf plan, one per plate. */
export function sheetSvgs(m: RoomModel, plates: ShelfPlate[], L: Labels = PL_LABELS): string[] {
  return plates.map((pl, i) => {
    const r = plateInner(pl, i, m, L);
    return `<svg viewBox="-6 -22 ${m.p.PL! + 12} ${m.p.PW! + 34}" role="img">${T(0, -8, r.title, 't', 'start')}${r.g}</svg>`;
  });
}

// ---------------------------------------------------------------- shared cut

const roomIdx = (room: string | undefined) => ROOM_COLORS.map((r) => r.k).indexOf(room ?? '');

function itemSvg(it: Placed, L: Labels): string {
  const p = it.p, x = it.x, y = it.y, w = p.w;
  let g = '';
  const ri = roomIdx(p.room), cl = p.band ? 'sl rb' : 'sl ' + (ri >= 0 ? ROOM_COLORS[ri]!.c : 'r0'), pre = p.band ? '' : p.room ?? '';
  const lab = p.band ? L.bandShort : pre + p.ids.join('+') + (p.seg || '');
  const nm = w >= 14 ? 'n' : 'n s';
  if (p.kind === 'rect') {
    g += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${p.l.toFixed(1)}" height="${w.toFixed(1)}" class="${cl}"/>`;
    const cu = p.cuts || (p.cut ? [p.cut] : []);
    cu.forEach((c) => { g += `<line x1="${(x + c).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + c).toFixed(1)}" y2="${(y + w).toFixed(1)}" class="cut"/>`; });
    const bnd = [0, ...cu, p.l], ty = y + w / 2 + (w >= 14 ? 5 : 3);
    for (let i = 0; i < bnd.length - 1; i++) if (bnd[i + 1]! - bnd[i]! >= 34 || bnd.length === 2) g += T(x + (bnd[i]! + bnd[i + 1]!) / 2, ty, lab, w >= 14 && !p.band ? 'n' : 'n s');
    g += T(x + p.l - 2, y + w - 3, f(p.l) + '×' + f(w), 't3', 'end');
  } else if (p.kind === 'nest') {
    p.parts!.forEach((t) => {
      const q = t.p, L = lmax(q), ri2 = roomIdx(q.room), c2 = 'sl ' + (ri2 >= 0 ? ROOM_COLORS[ri2]!.c : 'r0'), mh = Math.min(...q.prof!.map((u) => u[1])), hh = q.w;
      let pl: Array<[number, number]>;
      if (!t.rot) pl = [[x + t.ox, y + t.oy], ...q.prof!.map((u): [number, number] => [x + t.ox + u[1], y + t.oy + hh * u[0]]), [x + t.ox, y + t.oy + hh]];
      else {
        const Rr = x + t.ox + L;
        pl = [[Rr, y + t.oy + hh], ...q.prof!.map((u): [number, number] => [Rr - u[1], y + t.oy + hh - hh * u[0]]), [Rr, y + t.oy]];
      }
      g += `<polygon points="${pts(pl)}" class="${c2}"/>` + T(t.rot ? x + t.ox + L - mh / 2 : x + t.ox + mh / 2, y + t.oy + hh / 2 + (hh >= 14 ? 5 : 3), (q.room ?? '') + q.ids.join('+'), hh >= 14 ? 'n' : 'n s');
    });
    g += T(x + p.l - 2, y + w - 3, f(p.l) + '×' + f(w), 't3', 'end');
  } else if (p.kind === 'pair') {
    const gp = p.gap ?? 0;
    g += `<polygon points="${pts([[x, y], [x + p.ya!, y], [x + p.yb!, y + w], [x, y + w]])}" class="${cl}"/><polygon points="${pts([[x + p.ya! + gp, y], [x + p.l, y], [x + p.l, y + w], [x + p.yb! + gp, y + w]])}" class="${cl}"/>`;
    g += T(x + Math.min(p.ya!, p.yb!) / 2, y + w / 2 + 5, pre + p.ids[0], nm) + T(x + p.l - Math.min(p.yb!, p.yc!) / 2, y + w / 2 + 5, pre + p.ids[1], nm);
    g += T(x + p.l / 2, y + w - 3, f(w), 't3');
  } else {
    const poly = [[x, y], ...p.prof!.map((q) => [x + q[1], y + w * q[0]]), [x, y + w]] as Array<[number, number]>;
    g += `<polygon points="${pts(poly)}" class="${cl}"/>` + T(x + Math.min(p.ha!, p.hb!) / 2, y + w / 2 + (w >= 14 ? 5 : 3), lab, nm) + T(x + p.l - 2, y + w - 3, f(p.ha!) + '→' + f(p.hb!) + ' (' + f(w) + ')', 't3', 'end');
  }
  return g + splitMarks(it);
}

/** Dashed line along the edge where a piece was cut from a longer one (strip taller than the plate). */
function splitMarks(it: Placed): string {
  const p = it.p;
  if (!p.splits || !p.splits.length || (p.kind !== 'rect' && p.kind !== 'trap')) return '';
  let g = '';
  p.splits.forEach((sp) => {
    const xs = it.x + (sp.edge === 'l0' ? 0 : p.l);
    let y0 = it.y, y1 = it.y + p.w;
    if (p.kind === 'trap' && p.prof) {
      const on = p.prof.filter((q) => (sp.edge === 'l0' ? q[1] <= 1e-6 : q[1] >= p.l - 1e-6));
      if (on.length) { y0 = it.y + p.w * Math.min(...on.map((q) => q[0])); y1 = it.y + p.w * Math.max(...on.map((q) => q[0])); }
    }
    g += `<line x1="${xs.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${xs.toFixed(1)}" y2="${y1.toFixed(1)}" class="sp"/>`;
  });
  return g;
}

/** One plate of the shared cut: contents and title. */
export function plateSvg(pl: Plate, i: number, R: Pick<CutResult, 'PL' | 'PW'>, L: Labels = PL_LABELS): { g: string; title: string } {
  let g = `<rect x="0" y="0" width="${R.PL}" height="${R.PW}" class="bd"/>`;
  const rooms: Record<string, number> = {};
  pl.items.forEach((it) => {
    g += itemSvg(it, L);
    if (it.p.kind === 'nest') it.p.parts!.forEach((t) => { rooms[t.p.room ?? ''] = 1; });
    else rooms[it.p.band ? L.band : it.p.room ?? ''] = 1;
  });
  const title = L.plate + ' ' + (i + 1) + (pl.extra ? ' (' + L.extraPlate + ')' : '') + ': ' + Object.keys(rooms).join(', ') + ' · ' + L.utilisation + ' ' + Math.round(pl.use * 100) + '%';
  return { g, title };
}

export function sharedSheets(R: Pick<CutResult, 'PL' | 'PW' | 'plates'>, L: Labels = PL_LABELS): string[] {
  return R.plates.map((pl, i) => {
    const r = plateSvg(pl, i, R, L);
    return `<svg viewBox="-6 -22 ${R.PL + 12} ${R.PW + 34}" role="img">${T(0, -8, r.title, 't', 'start')}${r.g}</svg>`;
  });
}
