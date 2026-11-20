import type { AtticModel, BoardSurface, GableWall } from '@slabs/core';
import { M, SC, T, f, pts, refMark, type Drawing } from './util';

function drawBoard(s: BoardSurface, ox: number, oy: number): { g: string; w: number; h: number } {
  const X = (v: number) => ox + v * SC, Yz = (z: number) => oy + (z - s.z0) * SC, u = s.u;
  let g = '';
  const notch = s.notch ?? null;
  const poly: Array<[number, number]> = notch ? [[0, s.z0], [u, s.z0], [u, s.z1], [notch[1], s.z1], [notch[1], notch[0]], [0, notch[0]]] : [[0, s.z0], [u, s.z0], [u, s.z1], [0, s.z1]];
  g += `<polygon points="${pts(poly.map((q): [number, number] => [X(q[0]), Yz(q[1])]))}" class="sl"/>`;
  s.cols.slice(1).forEach((c) => {
    const x0 = notch && c.a > notch[0] ? notch[1] : 0;
    g += `<line x1="${X(x0).toFixed(1)}" y1="${Yz(c.a).toFixed(1)}" x2="${X(u).toFixed(1)}" y2="${Yz(c.a).toFixed(1)}" class="${Math.abs(c.a - s.anchor) < 0.5 ? 'js' : 'j'}"/>`;
  });
  if (s.cut) g += `<line x1="${X(s.cut).toFixed(1)}" y1="${Yz(s.z0).toFixed(1)}" x2="${X(s.cut).toFixed(1)}" y2="${Yz(s.z1).toFixed(1)}" class="cut"/>`;
  s.cols.forEach((c) => {
    const st = notch && c.a >= notch[0] ? notch[1] : 0, en = s.cut || u, cx = X((st + en) / 2), big = c.b - c.a >= 20;
    g += T(cx, Yz((c.a + c.b) / 2) + (big ? 5 : 3), c.id, big ? 'n' : 'n s') + T(X(u) + 4, Yz((c.a + c.b) / 2) + 3, f(c.b - c.a), 't3', 'start');
  });
  if (s.flat && s.cut) {
    g += `<line x1="${X(s.flat).toFixed(1)}" y1="${Yz(s.z0).toFixed(1)}" x2="${X(s.flat).toFixed(1)}" y2="${Yz(s.z1).toFixed(1)}" class="j"/>` + T(X(s.flat / 2), Yz(s.z1) + 12, 'sufit ' + f(s.flat)) +
      (s.cut - s.flat > 0.5 ? T(X((s.flat + s.cut) / 2), Yz(s.z1) + 12, 'skos ' + f(s.cut - s.flat)) : '') + T(X((s.cut + u) / 2), Yz(s.z1) + 12, 'ściana ' + f(u - s.cut));
  } else if (s.cut) g += T(X(s.cut / 2), Yz(s.z1) + 12, 'dach ' + f(s.cut)) + T(X((s.cut + u) / 2), Yz(s.z1) + 12, 'ściana ' + f(u - s.cut));
  else g += T(X(u / 2), Yz(s.z1) + 12, 'wys. ' + f(u));
  g += T(X(0), Yz(s.z0) - 6, s.title, 't', 'start');
  g += refMark(X(s.ur), Yz(s.zr), s.ref, 8, -7);
  return { g, w: X(u) + 34, h: Yz(s.z1) + 20 };
}

/** Roof + wall boards unrolled flat. */
export function atticBoards(m: AtticModel): Drawing {
  let out = '';
  const colx = M + m.surfs[0]!.u * SC + 110, oy = M + 18;
  const r = drawBoard(m.surfs[0]!, M, oy);
  out += r.g;
  const maxh = r.h;
  let y_ = oy, right = 0;
  m.surfs.slice(1).forEach((s) => { const d = drawBoard(s, colx, y_); out += d.g; right = Math.max(right, d.w); y_ = d.h + 34; });
  return { svg: out, w: Math.max(right, colx + 10) + M, h: Math.max(maxh, y_) + M };
}

function wallDraw(m: AtticModel, w: GableWall, ox: number, oy: number): { g: string; w: number; h: number } {
  const X = (x: number) => ox + (x - w.x0) * SC, Y = (h: number) => oy + (m.TOPH - h) * SC;
  let g = '';
  const base = Y(w.bs);
  w.strips.forEach((s) => {
    const top = m.profile(s.a, s.b);
    const poly: Array<[number, number]> = [[X(s.a), base], ...top.map((q): [number, number] => [X(q[0]), Y(q[1])]), [X(s.b), base]];
    g += `<polygon points="${pts(poly)}" class="sl"/>`;
    const hmax = Math.max(...top.map((q) => q[1])), big = s.b - s.a >= 20;
    g += T(X((s.a + s.b) / 2), Y((hmax + w.bs) / 2) + 5, s.id, big ? 'n' : 'n s') + T(X((s.a + s.b) / 2), base + 12, f(s.b - s.a)) + T(X(s.a) + 2, Y(m.y(s.a)) - 3, f(m.y(s.a)), 't3', 'start');
  });
  if (w.z === 0 && m.win) g += `<polygon points="${pts(m.win.map((q): [number, number] => [X(q[0]), Y(q[1])]))}" class="win"/>` + T(X(m.win[0]![0] / 2), Y(m.win[0]![1] + 60), 'okno', 't3');
  if (w.bs > 0) g += `<polygon points="${pts([[X(w.x0), Y(0)], [X(w.x1), Y(0)], [X(w.x1), Y(w.bs)], [X(w.x0), Y(w.bs)]])}" class="hole"/>` + T(X((w.x0 + w.x1) / 2), Y(w.bs / 2) + 3, 'wycięcie ' + f(w.bs) + ' cm', 't3');
  g += T(X(w.x0), Y(m.TOPH) - 16, w.title, 't', 'start');
  g += refMark(X(w.xr), base, w.ref, 6, -8);
  return { g, w: (w.x1 - w.x0) * SC, h: m.TOPH * SC };
}

/** Gable walls seen from inside, two per row. */
export function atticGables(m: AtticModel): Drawing {
  const ws = m.walls, rowH = m.TOPH * SC + 60, gap = 50, rows = Math.ceil(ws.length / 2);
  let out = '', maxw = 0;
  for (let r = 0; r < rows; r++) {
    let x = M;
    const oy = M + 26 + r * rowH;
    for (let c = 0; c < 2; c++) {
      const w = ws[r * 2 + c];
      if (!w) continue;
      const d = wallDraw(m, w, x, oy);
      out += d.g;
      x += d.w + gap;
    }
    maxw = Math.max(maxw, x - gap);
  }
  return { svg: out, w: maxw + M, h: M + 26 + rows * rowH - 20 };
}

/** View from above. */
export function atticPlan(m: AtticModel): Drawing {
  const l1 = m.XT !== undefined;
  const X = l1 ? (x: number) => M + (x - m.XT!) * SC : (x: number) => M + (x + m.hw) * SC;
  const Z = (z: number) => M + 18 + z * SC;
  let g = '';
  const poly: Array<[number, number]> = l1 ? [[m.XT!, 0], [m.XR, 0], [m.XR, m.L], [m.XT!, m.L]] : [[-m.hw, 0], [m.XA, 0], [m.XA, m.ZA], [m.XR, m.ZA], [m.XR, m.L], [m.XB, m.L], [m.XB, m.ZB], [-m.hw, m.ZB]];
  g += `<polygon points="${pts(poly.map((q): [number, number] => [X(q[0]), Z(q[1])]))}" class="sl"/>`;
  m.surfs.forEach((s) => {
    if (s.key === 5) return;
    const xa = l1 ? m.XT! : s.key === 1 ? -m.hw : 0, xb = l1 ? m.XR : s.key === 1 ? 0 : s.key === 2 ? m.XA : m.XR;
    s.cols.slice(1).forEach((c) => {
      const x0 = s.key === 4 && c.a > m.ZB ? m.XB : xa;
      g += `<line x1="${X(x0).toFixed(1)}" y1="${Z(c.a).toFixed(1)}" x2="${X(xb).toFixed(1)}" y2="${Z(c.a).toFixed(1)}" class="${Math.abs(c.a - s.anchor) < 0.5 ? 'js' : 'j'}"/>`;
    });
  });
  const ridgeX = l1 ? m.XT! : 0;
  if (m.cap) {
    g += `<line x1="${X(-m.xc).toFixed(1)}" y1="${Z(0).toFixed(1)}" x2="${X(-m.xc).toFixed(1)}" y2="${Z(m.ZB).toFixed(1)}" class="rd"/>`;
    g += T(X(0), Z(18), 'sufit płaski ' + f(m.TOPH), 't3');
  } else {
    g += `<line x1="${X(ridgeX).toFixed(1)}" y1="${Z(0).toFixed(1)}" x2="${X(ridgeX).toFixed(1)}" y2="${Z(m.ZB).toFixed(1)}" class="rd"/>` + T(X(ridgeX) + 4, Z(18), l1 ? 'ścianka działowa' : 'kalenica', 't3', 'start');
  }
  m.surfs.forEach((s) => { if (s.kind === 'board' && !s.top) g += refMark(X(ridgeX), Z(s.zr), s.ref, -8, -7, 'end'); });
  m.walls.forEach((w) => { g += refMark(X(w.xr), Z(w.z), w.ref, 6, w.z === 0 ? -8 : 14); });
  g += l1 ? T(X((m.XT! + m.XR) / 2), Z(m.L) + 30, 'szerokość ' + f(m.XR - m.XT!) + ', długość ' + f(m.L)) : T(X(0), Z(m.L) + 30, 'szerokość ' + f(m.p.W!) + ', długość ' + f(m.L));
  return { svg: g, w: X(m.XR) + M + 60, h: Z(m.L) + M + 20 };
}
