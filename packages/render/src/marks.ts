// Workshop-drawing renderer ("carpenter's marks"): the drawings the app shows. The artifact-parity builders in attic.ts / flat.ts
// stay untouched for the golden tests; these build the same geometry with the marks of the design brief:
//   chalk-blue joint lines, start tick + arrow at every R, pencil X on waste (openings, slivers), face-side mark and number
//   on every piece, dashed fold lines, dimension lines with ticks. Text is never smaller than MIN_TEXT px (1 unit = 1 px).
import type { AtticModel, BoardSurface, FlatModel, GableWall, RoomModel } from '@slabs/core';
import { isAttic } from '@slabs/core';
import { PL_LABELS, f, type Drawing, type Labels } from './util';

export const MIN_TEXT = 12;
const n1 = (v: number) => v.toFixed(1);

export interface MarkOptions {
  /** pixels per cm */
  scale: number;
  /** strips narrower than this (cm) get the sliver mark */
  minStrip: number;
  /** usable plate length (cm): longer pieces are drawn with a split line */
  plateLen: number;
  /** number format for dimensions */
  nf?: (v: number) => string;
  labels?: Labels;
}

const esc = (t: string | number) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Shared <defs>: room patterns (tint + pattern, so rooms differ in black-and-white print too) and arrow heads. */
export const MARK_DEFS =
  '<defs>' +
  '<pattern id="pt-r0" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" style="fill:var(--r0)"/><path d="M0 8L8 0" style="stroke:var(--foreground);stroke-width:.6;opacity:.35"/></pattern>' +
  '<pattern id="pt-r1" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" style="fill:var(--r1)"/><circle cx="4" cy="4" r="1" style="fill:var(--foreground);opacity:.4"/></pattern>' +
  '<pattern id="pt-r2" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" style="fill:var(--r2)"/><path d="M0 0L8 8" style="stroke:var(--foreground);stroke-width:.6;opacity:.35"/></pattern>' +
  '<pattern id="pt-r3" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" style="fill:var(--r3)"/><path d="M4 0V8M0 4H8" style="stroke:var(--foreground);stroke-width:.5;opacity:.3"/></pattern>' +
  '<pattern id="pt-rb" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" style="fill:var(--rb)"/><path d="M0 4H8" style="stroke:var(--foreground);stroke-width:.6;opacity:.35"/></pattern>' +
  '<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L10 5L0 9z" style="fill:var(--primary)"/></marker>' +
  '</defs>';

export const ROOM_PATTERN: Record<string, string> = { S: 'pt-r0', Sy: 'pt-r1', 'Ł1': 'pt-r2', 'Ł2': 'pt-r3', B: 'pt-rb' };
const roomFill = (key: string) => `style="fill:url(#${ROOM_PATTERN[key] ?? 'pt-r0'})"`;

/** Collision-free text placement: remembers boxes, tries the candidate offsets in order, falls back to a leader line. */
export class LabelPlacer {
  private boxes: Array<[number, number, number, number]> = [];
  constructor(private readonly W: number, private readonly H: number) {}
  reserve(x: number, y: number, w: number, h: number) { this.boxes.push([x, y, w, h]); }
  private free(b: [number, number, number, number]) {
    if (b[0] < 0 || b[1] < 0 || b[0] + b[2] > this.W || b[1] + b[3] > this.H) return false;
    return !this.boxes.some((o) => b[0] < o[0] + o[2] && b[0] + b[2] > o[0] && b[1] < o[1] + o[3] && b[1] + b[3] > o[1]);
  }
  /** Returns the text box top-left for a label near (x, y); `dist` grows until it is free (leader line is the caller's job when moved far). */
  place(x: number, y: number, text: string, size = MIN_TEXT): { x: number; y: number; w: number; h: number; moved: boolean } {
    const w = text.length * size * 0.58 + 6, h = size + 4;
    const offs: Array<[number, number]> = [[8, -h - 4], [-w - 8, -h - 4], [8, 6], [-w - 8, 6], [-w / 2, -h - 12], [-w / 2, 12]];
    for (let ring = 0; ring < 6; ring++) {
      for (const [dx, dy] of offs) {
        const b: [number, number, number, number] = [x + dx * (1 + ring * 0.9), y + dy * (1 + ring * 0.9), w, h];
        if (this.free(b)) { this.boxes.push(b); return { x: b[0], y: b[1], w, h, moved: ring > 0 }; }
      }
    }
    const b: [number, number, number, number] = [Math.max(0, Math.min(this.W - w, x + 8)), Math.max(0, Math.min(this.H - h, y - h - 4)), w, h];
    this.boxes.push(b);
    return { x: b[0], y: b[1], w, h, moved: true };
  }
}

const text = (x: number, y: number, t: string | number, cls = 'mk-t', anchor = 'middle') => `<text x="${n1(x)}" y="${n1(y)}" class="${cls}" text-anchor="${anchor}">${esc(t)}</text>`;

/** Horizontal or vertical dimension line with end ticks and the figure centred on it (paper-coloured halo keeps it legible). */
function dimLine(x1: number, y1: number, x2: number, y2: number, label: string, side: 1 | -1 = 1): string {
  const horiz = Math.abs(y2 - y1) < Math.abs(x2 - x1);
  const tick = 5;
  let g = `<line x1="${n1(x1)}" y1="${n1(y1)}" x2="${n1(x2)}" y2="${n1(y2)}" class="mk-dim"/>`;
  g += horiz
    ? `<line x1="${n1(x1 - tick)}" y1="${n1(y1 + tick)}" x2="${n1(x1 + tick)}" y2="${n1(y1 - tick)}" class="mk-dim"/><line x1="${n1(x2 - tick)}" y1="${n1(y2 + tick)}" x2="${n1(x2 + tick)}" y2="${n1(y2 - tick)}" class="mk-dim"/>`
    : `<line x1="${n1(x1 - tick)}" y1="${n1(y1 + tick)}" x2="${n1(x1 + tick)}" y2="${n1(y1 - tick)}" class="mk-dim"/><line x1="${n1(x2 - tick)}" y1="${n1(y2 + tick)}" x2="${n1(x2 + tick)}" y2="${n1(y2 - tick)}" class="mk-dim"/>`;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  g += horiz ? text(mx, my + (side > 0 ? 15 : -6), label, 'mk-fig') : text(mx + (side > 0 ? 8 : -8), my + 4, label, 'mk-fig', side > 0 ? 'start' : 'end');
  return g;
}

/** Pencil cross over a rectangle (waste: openings, slivers, cut-away corners). */
function pencilX(x: number, y: number, w: number, h: number): string {
  return `<path d="M${n1(x)} ${n1(y)}L${n1(x + w)} ${n1(y + h)}M${n1(x + w)} ${n1(y)}L${n1(x)} ${n1(y + h)}" class="mk-x"/>`;
}

/** Face-side mark: a circled dot, "this side faces you, never flip". */
function faceMark(x: number, y: number): string {
  return `<circle cx="${n1(x)}" cy="${n1(y)}" r="6" class="mk-face"/><circle cx="${n1(x)}" cy="${n1(y)}" r="1.8" class="mk-face-dot"/>`;
}

/** Start tick with arrow: a heavy tick across the start line at the surface edge and an arrow in the direction the plates run. */
function startMark(x: number, y: number, dir: 'h' | 'v', len: number): string {
  if (dir === 'h') {
    return `<line x1="${n1(x)}" y1="${n1(y - 11)}" x2="${n1(x)}" y2="${n1(y + 11)}" class="mk-start-tick"/>` +
      `<line x1="${n1(x + 3)}" y1="${n1(y)}" x2="${n1(x + len)}" y2="${n1(y)}" class="mk-arrow" marker-end="url(#arr)"/>`;
  }
  return `<line x1="${n1(x - 11)}" y1="${n1(y)}" x2="${n1(x + 11)}" y2="${n1(y)}" class="mk-start-tick"/>` +
    `<line x1="${n1(x)}" y1="${n1(y + 3)}" x2="${n1(x)}" y2="${n1(y + len)}" class="mk-arrow" marker-end="url(#arr)"/>`;
}

/** The <svg> element for a mark drawing: 1 unit = 1 px, so text keeps its size; the container scrolls when the drawing is wider. */
export function wrapMark(d: Drawing, label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(d.w)} ${f(d.h)}" width="${f(d.w)}" height="${f(d.h)}" role="img" aria-label="${esc(label)}" class="mark">${MARK_DEFS}${d.svg}</svg>`;
}

/** The start point of a surface as an interactive handle: where it is drawn and how a drag maps to the shift parameter. */
export interface StartHandle {
  /** shift parameter in the room's inputs (o1..o9), cm */
  param: string;
  ref: string;
  /** position of the start mark, px in the drawing */
  x: number; y: number;
  /** the start line moves along this axis (y for boards, x for gable walls) */
  axis: 'x' | 'y';
  /** current value of the shift, cm */
  value: number;
  /** drawing px per cm */
  perCm: number;
  /** surface edges on that axis (cm, in the surface's own coordinates), the grid pitch and the anchor at shift 0: a joint can be snapped onto an edge */
  edges: number[];
  pitch: number;
  base: number;
  /** widths (cm) of the first and the last field with the current shift */
  firstW: number; lastW: number;
}

/** A measurement that is drawn as a dimension line and can be typed in place (it belongs to one input of the room). */
export interface MeasureTarget {
  param: string;
  /** the dimension line, px in the drawing */
  x1: number; y1: number; x2: number; y2: number;
  value: number;
  /** text of the dimension */
  label: string;
}

export interface MarkResult extends Drawing { start?: StartHandle; measures?: MeasureTarget[] }

export interface SurfaceInfo { key: number; ref: string; title: string; kind: 'board' | 'gable'; slivers: number; splitNote: boolean }

/** List of drawable surfaces of a room in reading order (boards, then gable walls). */
export function surfaceList(m: RoomModel, minStrip: number, plateLen: number): SurfaceInfo[] {
  const out: SurfaceInfo[] = m.surfs.map((s) => ({
    key: s.key, ref: s.ref, title: s.title, kind: 'board' as const,
    slivers: s.cols.filter((c) => c.b - c.a < minStrip - 1e-6).length,
    splitNote: s.u > plateLen + 1e-6,
  }));
  if (isAttic(m)) {
    m.walls.forEach((w) => out.push({
      key: w.rid, ref: w.ref, title: w.title, kind: 'gable' as const,
      slivers: w.strips.filter((c) => c.b - c.a < minStrip - 1e-6).length,
      splitNote: w.strips.some((c) => Math.max(...m.profile(c.a, c.b).map((q) => q[1])) - w.bs > plateLen + 1e-6),
    }));
  }
  return out;
}

/** plan drawings are at least this wide, so their caption always fits */
const MINPLAN = 230;
const PADL = 64, PADT = 62, PADR = 74, PADB = 56;

// ------------------------------------------------------------------ board surface (roof + wall, ceiling + walls, band)

export function boardMarks(s: BoardSurface, roomKey: string, o: MarkOptions, selected = true, ctx?: { shift: number; pitch: number; measures?: Array<{ param: string; value: number; kind: 'u0' | 'u1' | 'u2' | 'u' | 'z' }> }): MarkResult {
  const L = o.labels ?? PL_LABELS, nf = o.nf ?? ((v: number) => String(f(v)));
  const sc = o.scale;
  const X = (v: number) => PADL + v * sc, Y = (z: number) => PADT + (z - s.z0) * sc;
  const u = s.u, notch = s.notch ?? null;
  const cuts = s.cuts ?? (s.cut ? [s.cut] : []);
  const W = X(u) + PADR, H = Y(s.z1) + PADB;
  const place = new LabelPlacer(W, H);
  let g = '';
  const poly: Array<[number, number]> = notch ? [[0, s.z0], [u, s.z0], [u, s.z1], [notch[1], s.z1], [notch[1], notch[0]], [0, notch[0]]] : [[0, s.z0], [u, s.z0], [u, s.z1], [0, s.z1]];
  g += `<polygon points="${poly.map((q) => `${n1(X(q[0]))},${n1(Y(q[1]))}`).join(' ')}" class="mk-edge" ${roomFill(roomKey)}/>`;
  if (notch) {
    g += pencilX(X(0), Y(notch[0]), (notch[1]) * sc, (s.z1 - notch[0]) * sc);
    g += `<rect x="${n1(X(0))}" y="${n1(Y(notch[0]))}" width="${n1(notch[1] * sc)}" height="${n1((s.z1 - notch[0]) * sc)}" class="mk-waste"/>`;
  }
  // slivers and field numbers
  s.cols.forEach((c) => {
    const st = notch && c.a >= notch[0] ? notch[1] : 0, en = cuts.length ? cuts[0]! : u;
    const sliver = c.b - c.a < o.minStrip - 1e-6;
    if (sliver) {
      g += pencilX(X(st), Y(c.a), (u - st) * sc, (c.b - c.a) * sc);
      g += text(X(u) + 34, Y((c.a + c.b) / 2) - 6, `${L.sliver} ${nf(c.b - c.a)}`, 'mk-warn', 'start');
    }
    const cy = Y((c.a + c.b) / 2);
    const cx = X((st + Math.min(en, u)) / 2);
    g += `<g class="mk-field"><text x="${n1(cx)}" y="${n1(cy + 5)}" class="mk-num" text-anchor="middle">${c.id}</text></g>` + ((c.b - c.a) * sc >= 22 ? faceMark(X(st) + 14, Y(c.a) + 13) : '');
  });
  // plate joints: chalk lines, the start line heavier
  s.cols.slice(1).forEach((c) => {
    const x0 = notch && c.a > notch[0] ? notch[1] : 0;
    const start = Math.abs(c.a - s.anchor) < 0.5;
    g += `<line x1="${n1(X(x0))}" y1="${n1(Y(c.a))}" x2="${n1(X(u))}" y2="${n1(Y(c.a))}" class="${start ? 'mk-chalk mk-start' : 'mk-chalk'}"/>`;
  });
  // boards longer than a plate are split at plate length
  if (o.plateLen > 0) for (let k = 1; k * o.plateLen < u - 1e-6; k++) {
    g += `<line x1="${n1(X(k * o.plateLen))}" y1="${n1(Y(s.z0))}" x2="${n1(X(k * o.plateLen))}" y2="${n1(Y(s.z1))}" class="mk-split"/>`;
    g += text(X(k * o.plateLen) + 4, Y(s.z0) - 4, L.split, 'mk-note', 'start');
  }
  // fold lines (roof/wall, ceiling/wall)
  cuts.forEach((c, i) => {
    g += `<line x1="${n1(X(c))}" y1="${n1(Y(s.z0) - 8)}" x2="${n1(X(c))}" y2="${n1(Y(s.z1) + 8)}" class="mk-fold"/>`;
    if (i === 0) g += text(X(c) + 5, Y(s.z1) + 22, L.fold, 'mk-note', 'start');
  });
  if (s.flat && s.cut) g += `<line x1="${n1(X(s.flat))}" y1="${n1(Y(s.z0))}" x2="${n1(X(s.flat))}" y2="${n1(Y(s.z1))}" class="mk-chalk"/>`;
  // dimensions: total length on top (and the parts), widths on the right
  const top = PADT - 12;
  if (cuts.length) {
    const b = [0, ...cuts, u];
    for (let i = 0; i < b.length - 1; i++) g += dimLine(X(b[i]!), top, X(b[i + 1]!), top, nf(b[i + 1]! - b[i]!), -1);
  } else g += dimLine(X(0), top, X(u), top, nf(u), -1);
  s.cols.forEach((c) => { g += dimLine(X(u) + 14, Y(c.a), X(u) + 14, Y(c.b), nf(c.b - c.a), 1); });
  // title and start mark
  g += `<text x="${n1(PADL)}" y="${n1(18)}" class="mk-title" text-anchor="start">${esc(s.title)}</text>`;
  const rx = X(s.ur), ry = Y(s.zr);
  g += startMark(rx, ry, 'h', Math.min(70, (u - s.ur) * sc * 0.4));
  const pb = place.place(rx - 6, ry, s.ref);
  g += `<g class="mk-ref${selected ? ' sel' : ''}"><rect x="${n1(pb.x)}" y="${n1(pb.y)}" width="${n1(pb.w)}" height="${n1(pb.h)}" rx="2"/><text x="${n1(pb.x + pb.w / 2)}" y="${n1(pb.y + pb.h - 5)}" text-anchor="middle">${esc(s.ref)}</text></g>`;
  const res: MarkResult = { svg: g, w: W, h: H };
  if (ctx) {
    const first = s.cols[0]!, last = s.cols[s.cols.length - 1]!;
    res.start = { param: 'o' + s.key, ref: s.ref, x: rx, y: ry, axis: 'y', value: ctx.shift, perCm: sc, edges: [s.z0, s.z1], pitch: ctx.pitch, base: s.anchor - ctx.shift, firstW: first.b - first.a, lastW: last.b - last.a };
    res.measures = (ctx.measures ?? []).map((q) => {
      const b = cuts.length ? [0, ...cuts, u] : [0, u];
      if (q.kind === 'z') return { param: q.param, x1: X(u) + 40, y1: Y(s.z0), x2: X(u) + 40, y2: Y(s.z1), value: q.value, label: nf(q.value) };
      const i = q.kind === 'u0' ? 0 : q.kind === 'u1' ? 1 : q.kind === 'u2' ? 2 : -1;
      const a0 = i < 0 ? 0 : b[i] ?? 0, a1 = i < 0 ? u : b[i + 1] ?? u;
      return { param: q.param, x1: X(a0), y1: top, x2: X(a1), y2: top, value: q.value, label: nf(q.value) };
    });
  }
  return res;
}

// ------------------------------------------------------------------ gable wall

export function gableMarks(m: AtticModel, w: GableWall, roomKey: string, o: MarkOptions, ctx?: { shift: number; pitch: number }): MarkResult {
  const L = o.labels ?? PL_LABELS, nf = o.nf ?? ((v: number) => String(f(v)));
  const sc = o.scale;
  const X = (x: number) => PADL + (x - w.x0) * sc, Yh = (h: number) => PADT + (m.TOPH - h) * sc;
  const W = X(w.x1) + PADR - 30, H = Yh(0) + PADB;
  const place = new LabelPlacer(W, H);
  let g = '';
  const base = Yh(w.bs);
  w.strips.forEach((s) => {
    const top = m.profile(s.a, s.b);
    const pts: Array<[number, number]> = [[X(s.a), base], ...top.map((q): [number, number] => [X(q[0]), Yh(q[1])]), [X(s.b), base]];
    g += `<polygon points="${pts.map((q) => `${n1(q[0])},${n1(q[1])}`).join(' ')}" class="mk-edge" ${roomFill(roomKey)}/>`;
    const hmax = Math.max(...top.map((q) => q[1])), width = s.b - s.a;
    const sliver = width < o.minStrip - 1e-6;
    if (sliver) {
      g += pencilX(X(s.a), Yh(hmax), width * sc, (hmax - w.bs) * sc);
      g += text((X(s.a) + X(s.b)) / 2, Yh(hmax) - 8, `${nf(width)}`, 'mk-warn');
    }
    const cx = (X(s.a) + X(s.b)) / 2;
    g += `<text x="${n1(cx)}" y="${n1(Yh((Math.min(hmax, m.y(s.a), m.y(s.b)) + w.bs) / 2) + 5)}" class="mk-num" text-anchor="middle">${s.id}</text>`;
    g += faceMark(X(s.a) + 11, Yh(Math.min(m.y(s.a), m.y(s.b)) - 6));
    g += dimLine(X(s.a), base + 14, X(s.b), base + 14, nf(width), 1);
    // strips taller than the plate are cut across, like boards
    if (o.plateLen > 0 && hmax - w.bs > o.plateLen + 1e-6) {
      const ys = Yh(w.bs + o.plateLen);
      g += `<line x1="${n1(X(s.a))}" y1="${n1(ys)}" x2="${n1(X(s.b))}" y2="${n1(ys)}" class="mk-split"/>`;
      if (width * sc > 40) g += text(cx, ys - 4, L.split, 'mk-note');
    }
  });
  w.strips.slice(1).forEach((s) => {
    const start = Math.abs(s.a - w.anchor) < 0.5;
    g += `<line x1="${n1(X(s.a))}" y1="${n1(Yh(Math.max(m.y(s.a), 0)))}" x2="${n1(X(s.a))}" y2="${n1(base)}" class="${start ? 'mk-chalk mk-start' : 'mk-chalk'}"/>`;
  });
  if (w.z === 0 && m.win) {
    const wp = m.win.map((q): [number, number] => [X(q[0]), Yh(q[1])]);
    g += `<polygon points="${wp.map((q) => `${n1(q[0])},${n1(q[1])}`).join(' ')}" class="mk-hole"/>`;
    if (wp.length === 4) g += `<path d="M${n1(wp[0]![0])} ${n1(wp[0]![1])}L${n1(wp[2]![0])} ${n1(wp[2]![1])}M${n1(wp[1]![0])} ${n1(wp[1]![1])}L${n1(wp[3]![0])} ${n1(wp[3]![1])}" class="mk-x"/>`;
    const cxw = wp.reduce((a, q) => a + q[0], 0) / wp.length, cyw = wp.reduce((a, q) => a + q[1], 0) / wp.length;
    g += text(cxw, cyw - 22, L.window, 'mk-note');
  }
  if (w.bs > 0) {
    g += `<rect x="${n1(X(w.x0))}" y="${n1(Yh(w.bs))}" width="${n1((w.x1 - w.x0) * sc)}" height="${n1(w.bs * sc)}" class="mk-hole"/>`;
    g += pencilX(X(w.x0), Yh(w.bs), (w.x1 - w.x0) * sc, w.bs * sc);
    g += text(X((w.x0 + w.x1) / 2), Yh(w.bs / 2) + 4, `${L.cutout} ${nf(w.bs)}`, 'mk-note');
  }
  g += `<text x="${n1(PADL)}" y="18" class="mk-title" text-anchor="start">${esc(w.title)}</text>`;
  const rx = X(w.xr);
  g += startMark(rx, base, 'v', -Math.max(30, Math.min(60, (m.TOPH - w.bs) * sc * 0.3)));
  const pb = place.place(rx, base, w.ref);
  g += `<g class="mk-ref sel"><rect x="${n1(pb.x)}" y="${n1(pb.y)}" width="${n1(pb.w)}" height="${n1(pb.h)}" rx="2"/><text x="${n1(pb.x + pb.w / 2)}" y="${n1(pb.y + pb.h - 5)}" text-anchor="middle">${esc(w.ref)}</text></g>`;
  const res: MarkResult = { svg: g, w: W, h: H };
  if (ctx) {
    const first = w.strips[0]!, last = w.strips[w.strips.length - 1]!;
    res.start = { param: 'o' + w.rid, ref: w.ref, x: rx, y: base, axis: 'x', value: ctx.shift, perCm: sc, edges: [w.x0, w.x1], pitch: ctx.pitch, base: w.anchor - ctx.shift, firstW: first.b - first.a, lastW: last.b - last.a };
  }
  return res;
}

// ------------------------------------------------------------------ plan view (small floor plan)

export function planMarks(m: RoomModel, roomKey: string, o: MarkOptions): Drawing {
  const L = o.labels ?? PL_LABELS, nf = o.nf ?? ((v: number) => String(f(v)));
  const sc = o.scale, P = 26;
  let g = '';
  if (isAttic(m)) {
    const l1 = m.XT !== undefined;
    const rawW = (l1 ? m.XR - m.XT! : m.XR + m.hw) * sc + 2 * P, off = Math.max(0, (MINPLAN - rawW) / 2);
    const X = l1 ? (x: number) => P + off + (x - m.XT!) * sc : (x: number) => P + off + (x + m.hw) * sc;
    const Z = (z: number) => P + z * sc;
    const W = Math.max(rawW, MINPLAN), H = Z(m.L) + P + 18;
    const place = new LabelPlacer(W, H);
    const poly: Array<[number, number]> = l1 ? [[m.XT!, 0], [m.XR, 0], [m.XR, m.L], [m.XT!, m.L]] : [[-m.hw, 0], [m.XA, 0], [m.XA, m.ZA], [m.XR, m.ZA], [m.XR, m.L], [m.XB, m.L], [m.XB, m.ZB], [-m.hw, m.ZB]];
    g += `<polygon points="${poly.map((q) => `${n1(X(q[0]))},${n1(Z(q[1]))}`).join(' ')}" class="mk-edge" ${roomFill(roomKey)}/>`;
    m.surfs.forEach((s) => {
      if (s.key === 5) return;
      const xa = l1 ? m.XT! : s.key === 1 ? -m.hw : 0, xb = l1 ? m.XR : s.key === 1 ? 0 : s.key === 2 ? m.XA : m.XR;
      s.cols.slice(1).forEach((c) => {
        const x0 = s.key === 4 && c.a > m.ZB ? m.XB : xa;
        g += `<line x1="${n1(X(x0))}" y1="${n1(Z(c.a))}" x2="${n1(X(xb))}" y2="${n1(Z(c.a))}" class="${Math.abs(c.a - s.anchor) < 0.5 ? 'mk-chalk mk-start' : 'mk-chalk'}"/>`;
      });
    });
    const rx = l1 ? m.XT! : 0;
    const xr = m.cap ? -m.xc : rx;
    g += `<line x1="${n1(X(xr))}" y1="${n1(Z(0))}" x2="${n1(X(xr))}" y2="${n1(Z(m.ZB))}" class="mk-fold"/>`;
    const refs: Array<[number, number, string]> = [];
    m.surfs.forEach((s) => { if (s.kind === 'board' && !s.top) refs.push([X(rx), Z(s.zr), s.ref]); });
    m.walls.forEach((w) => refs.push([X(w.xr), Z(w.z), w.ref]));
    refs.forEach(([x, y, t]) => {
      const pb = place.place(x, y, t);
      g += `<circle cx="${n1(x)}" cy="${n1(y)}" r="4" class="mk-dot"/>`;
      if (pb.moved) g += `<line x1="${n1(x)}" y1="${n1(y)}" x2="${n1(pb.x + pb.w / 2)}" y2="${n1(pb.y + pb.h / 2)}" class="mk-leader"/>`;
      g += `<g class="mk-ref"><rect x="${n1(pb.x)}" y="${n1(pb.y)}" width="${n1(pb.w)}" height="${n1(pb.h)}" rx="2"/><text x="${n1(pb.x + pb.w / 2)}" y="${n1(pb.y + pb.h - 5)}" text-anchor="middle">${esc(t)}</text></g>`;
    });
    g += text(W / 2, H - 4, `${L.widthWord} ${nf(l1 ? m.XR - m.XT! : m.p.W!)} × ${L.lengthWord} ${nf(m.L)}`, 'mk-fig');
    return { svg: g, w: W, h: H };
  }
  const fm = m as FlatModel;
  const bx = fm.p.bx!, bz = fm.p.bz!;
  const rawW = bx * sc + 2 * P, off = Math.max(0, (MINPLAN - rawW) / 2);
  const X = (x: number) => P + off + x * sc, Z = (z: number) => P + z * sc;
  const W = Math.max(rawW, MINPLAN), H = Z(bz) + P + 18;
  const place = new LabelPlacer(W, H);
  g += `<polygon points="${[[0, 0], [bx, 0], [bx, bz], [0, bz]].map((q) => `${n1(X(q[0]!))},${n1(Z(q[1]!))}`).join(' ')}" class="mk-edge" ${roomFill(roomKey)}/>`;
  const s0 = fm.surfs[0]!;
  s0.cols.slice(1).forEach((c) => {
    const cl = Math.abs(c.a - s0.anchor) < 0.5 ? 'mk-chalk mk-start' : 'mk-chalk';
    g += fm.dz ? `<line x1="${n1(X(c.a))}" y1="${n1(Z(0))}" x2="${n1(X(c.a))}" y2="${n1(Z(bz))}" class="${cl}"/>` : `<line x1="${n1(X(0))}" y1="${n1(Z(c.a))}" x2="${n1(X(bx))}" y2="${n1(Z(c.a))}" class="${cl}"/>`;
  });
  const refs: Array<[number, number, string]> = [fm.dz ? [X(s0.zr), Z(0), 'R1'] : [X(0), Z(s0.zr), 'R1']];
  fm.surfs.slice(1).forEach((s2, qi) => { const wc = qi ? fm.Wc : 0; refs.push([X(fm.dz ? wc : s2.zr), Z(fm.dz ? s2.zr : wc), s2.ref]); });
  refs.forEach(([x, y, t]) => {
    const pb = place.place(x, y, t);
    g += `<circle cx="${n1(x)}" cy="${n1(y)}" r="4" class="mk-dot"/>`;
    if (pb.moved) g += `<line x1="${n1(x)}" y1="${n1(y)}" x2="${n1(pb.x + pb.w / 2)}" y2="${n1(pb.y + pb.h / 2)}" class="mk-leader"/>`;
    g += `<g class="mk-ref"><rect x="${n1(pb.x)}" y="${n1(pb.y)}" width="${n1(pb.w)}" height="${n1(pb.h)}" rx="2"/><text x="${n1(pb.x + pb.w / 2)}" y="${n1(pb.y + pb.h - 5)}" text-anchor="middle">${esc(t)}</text></g>`;
  });
  g += text(W / 2, H - 4, `${L.widthWord} ${nf(bx)} × ${L.lengthWord} ${nf(bz)}`, 'mk-fig');
  return { svg: g, w: W, h: H };
}

/** Drawing of one surface of a room (by its R key), with the marks. */
export function surfaceMarks(m: RoomModel, key: number, roomKey: string, o: MarkOptions): MarkResult | null {
  const pitch = m.p.PW! - 2 * (m.p.trim ?? 0);
  const shift = m.p['o' + key] ?? 0;
  const b = m.surfs.find((s) => s.key === key);
  if (b) return boardMarks(b, roomKey, o, true, { shift, pitch, measures: measuresOf(m, b) });
  if (isAttic(m)) {
    const w = m.walls.find((x) => x.rid === key);
    if (w) return gableMarks(m, w, roomKey, o, { shift, pitch });
  }
  return null;
}

/**
 * Dimensions of a board surface that are directly one input of the room (so they can be typed in place):
 * the flat-ceiling room (all of them), and the knee wall height / room length of the attic boards.
 */
function measuresOf(m: RoomModel, s: BoardSurface): Array<{ param: string; value: number; kind: 'u0' | 'u1' | 'u2' | 'u' | 'z' }> {
  if (!isAttic(m)) {
    const dz = m.dz, out: Array<{ param: string; value: number; kind: 'u0' | 'u1' | 'u2' | 'u' | 'z' }> = [];
    if (s.key === 1) {
      out.push({ param: 'hb', value: m.hb, kind: 'u0' }, { param: dz ? 'bz' : 'bx', value: m.Lc, kind: 'u1' }, { param: 'hb', value: m.hb, kind: 'u2' }, { param: dz ? 'bx' : 'bz', value: m.Wc, kind: 'z' });
    } else {
      out.push({ param: 'hb', value: m.hb, kind: 'u' }, { param: dz ? 'bz' : 'bx', value: m.Lc, kind: 'z' });
    }
    return out;
  }
  if (s.key === 1 && s.cut) {
    const out: Array<{ param: string; value: number; kind: 'u0' | 'u1' | 'u2' | 'u' | 'z' }> = [{ param: 'HL', value: m.HL, kind: 'u1' }];
    if (m.preset !== 'salon') out.push({ param: 'L', value: m.L, kind: 'z' });
    return out;
  }
  return [];
}

/** Scale (px per cm) that makes a drawing fit `width` px, but never smaller than `min`; the container scrolls below that. */
export function fitScale(contentCm: number, width: number, min = 0.3, max = 1.1): number {
  const avail = Math.max(120, width - PADL - PADR);
  return Math.min(max, Math.max(min, avail / Math.max(1, contentCm)));
}
export const surfaceWidthCm = (m: RoomModel, key: number): number => {
  const b = m.surfs.find((s) => s.key === key);
  if (b) return b.u;
  if (isAttic(m)) { const w = m.walls.find((x) => x.rid === key); if (w) return w.x1 - w.x0; }
  return 400;
};
