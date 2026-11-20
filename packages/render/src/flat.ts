import type { BoardSurface, FlatModel } from '@slabs/core';
import { M, SC, T, f, pts, refMark, type Drawing } from './util';

function drawBoard(s: BoardSurface, ox: number, oy: number): { g: string; w: number; h: number } {
  const X = (v: number) => ox + v * SC, Yz = (z: number) => oy + (z - s.z0) * SC, u = s.u, cuts = s.cuts ?? [];
  let g = `<polygon points="${pts([[0, s.z0], [u, s.z0], [u, s.z1], [0, s.z1]].map((q): [number, number] => [X(q[0]!), Yz(q[1]!)]))}" class="sl"/>`;
  s.cols.slice(1).forEach((c) => { g += `<line x1="${X(0).toFixed(1)}" y1="${Yz(c.a).toFixed(1)}" x2="${X(u).toFixed(1)}" y2="${Yz(c.a).toFixed(1)}" class="${Math.abs(c.a - s.anchor) < 0.5 ? 'js' : 'j'}"/>`; });
  cuts.forEach((x) => { g += `<line x1="${X(x).toFixed(1)}" y1="${Yz(s.z0).toFixed(1)}" x2="${X(x).toFixed(1)}" y2="${Yz(s.z1).toFixed(1)}" class="cut"/>`; });
  const mid = cuts.length > 1 ? (cuts[0]! + cuts[1]!) / 2 : u / 2;
  s.cols.forEach((c) => { const big = c.b - c.a >= 20; g += T(X(mid), Yz((c.a + c.b) / 2) + (big ? 5 : 3), c.id, big ? 'n' : 'n s') + T(X(u) + 4, Yz((c.a + c.b) / 2) + 3, f(c.b - c.a), 't3', 'start'); });
  if (cuts.length > 1) g += T(X(cuts[0]! / 2), Yz(s.z1) + 12, 'ściana ' + f(cuts[0]!)) + T(X(mid), Yz(s.z1) + 12, 'sufit ' + f(cuts[1]! - cuts[0]!)) + T(X((cuts[1]! + u) / 2), Yz(s.z1) + 12, 'ściana ' + f(u - cuts[1]!));
  else g += T(X(u / 2), Yz(s.z1) + 12, (s.lab || 'dł.') + ' ' + f(u));
  g += T(X(0), Yz(s.z0) - 6, s.title, 't', 'start');
  g += refMark(X(s.ur), Yz(s.zr), s.ref, 8, -7);
  return { g, w: X(u) + 34, h: Yz(s.z1) + 20 };
}

export function flatBoards(m: FlatModel): Drawing {
  let out = '';
  const oy = M + 18;
  const r = drawBoard(m.surfs[0]!, M, oy);
  out += r.g;
  let maxw = r.w, y_ = r.h + 34;
  m.surfs.slice(1).forEach((s) => { const d = drawBoard(s, M, y_ + 10); out += d.g; maxw = Math.max(maxw, d.w); y_ = d.h + 34; });
  return { svg: out, w: maxw + M, h: y_ + M - 20 };
}

export function flatGables(m: FlatModel): Drawing {
  let g = '', x = M;
  const y0 = M + 26, hbs = m.hb * SC;
  const seq: Array<[string, number]> = [['pasek', m.Lc], ['zawinięcie', m.Wc], ['pasek', m.Lc], ['zawinięcie', m.Wc]];
  let si = 0;
  seq.forEach((q) => {
    const w = q[1] * SC, dark = q[0] === 'zawinięcie';
    g += `<rect x="${x.toFixed(1)}" y="${y0}" width="${w.toFixed(1)}" height="${hbs.toFixed(1)}" class="sl" style="${dark ? 'fill-opacity:.7' : ''}"/>`;
    g += T(x + w / 2, y0 + hbs / 2 + 4, dark ? 'z sufitu' : 'pasek ' + m.surfs[1 + si]!.cols.map((c) => c.id).join('+'), 't');
    if (!dark) si++;
    g += T(x + w / 2, y0 + hbs + 14, f(q[1]) + ' × ' + f(m.hb));
    x += w + 8;
  });
  g += T(M, y0 - 8, 'Obwód ' + f(2 * (m.Lc + m.Wc)) + ' cm, wysokość opaski ' + f(m.hb) + ' cm', 't', 'start');
  return { svg: g, w: x + M, h: y0 + hbs + 40 };
}

export function flatPlan(m: FlatModel): Drawing {
  const bx = m.p.bx!, bz = m.p.bz!, X = (x: number) => M + x * SC, Z = (z: number) => M + 18 + z * SC;
  let g = `<polygon points="${pts([[0, 0], [bx, 0], [bx, bz], [0, bz]].map((q): [number, number] => [X(q[0]!), Z(q[1]!)]))}" class="sl"/>`;
  const s = m.surfs[0]!;
  s.cols.slice(1).forEach((c) => {
    const cl = Math.abs(c.a - s.anchor) < 0.5 ? 'js' : 'j';
    g += m.dz
      ? `<line x1="${X(c.a).toFixed(1)}" y1="${Z(0).toFixed(1)}" x2="${X(c.a).toFixed(1)}" y2="${Z(bz).toFixed(1)}" class="${cl}"/>`
      : `<line x1="${X(0).toFixed(1)}" y1="${Z(c.a).toFixed(1)}" x2="${X(bx).toFixed(1)}" y2="${Z(c.a).toFixed(1)}" class="${cl}"/>`;
  });
  g += m.dz ? refMark(X(s.zr), Z(0), 'R1', 6, -8) : refMark(X(0), Z(s.zr), 'R1', -8, -7, 'end');
  m.surfs.slice(1).forEach((s2, qi) => {
    const wc = qi ? m.Wc : 0, px = m.dz ? wc : s2.zr, pz = m.dz ? s2.zr : wc;
    g += refMark(X(px), Z(pz), s2.ref, 6, qi ? 14 : -8);
  });
  g += T(X(bx / 2), Z(bz) + 30, 'szerokość ' + f(bx) + ', długość ' + f(bz) + '; deski wzdłuż ' + (m.dz ? 'z' : 'x'));
  return { svg: g, w: X(bx) + M + 60, h: Z(bz) + M + 20 };
}
