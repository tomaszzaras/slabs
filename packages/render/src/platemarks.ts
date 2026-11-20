// Plates of the shared cut drawn with the same carpenter's marks as the surfaces: room pattern + prefix, face-side dot,
// pencil X on offcuts and slivers, dashed fold lines, dotted split lines. 1 unit = 1 px, so text keeps its size on a phone;
// labels are placed with collision checks and dropped (never overlapped) when a piece is too small for them.
import type { CutResult } from '@slabs/core';
import { cutSheets, type SheetPiece, type SheetPlate } from './cutsheet';
import { LabelPlacer, MARK_DEFS, ROOM_PATTERN, holeMark, MINSLIVER } from './marks';
import { PL_LABELS, f, type Labels } from './util';

const n1 = (v: number) => v.toFixed(1);
const esc = (t: string | number) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const PAD = 10, TOP = 30;

export interface PlateOptions {
  /** px per cm */
  scale: number;
  labels?: Labels;
  nf?: (v: number) => string;
  /** plate-local text for the part of a piece list, e.g. "keep" */
  keep?: string;
  /** how a room key is written on pieces (English: S → LR) */
  prefix?: (key: string) => string;
}

export interface PlateDrawing { svg: string; w: number; h: number; title: string; collisions: number }

const tw = (t: string, size: number) => t.length * size * 0.58 + 4;

export function plateMarks(sh: SheetPlate, PL: number, PW: number, o: PlateOptions): PlateDrawing {
  const L = o.labels ?? PL_LABELS, nf = o.nf ?? ((v: number) => String(f(v)));
  const k = o.scale;
  const W = PL * k + 2 * PAD, H = PW * k + TOP + PAD;
  const X = (v: number) => PAD + v * k, Y = (v: number) => TOP + v * k;
  const place = new LabelPlacer(W, H);
  let g = `<rect x="${n1(X(0))}" y="${n1(Y(0))}" width="${n1(PL * k)}" height="${n1(PW * k)}" class="mk-plate"/>`;
  // offcuts: pencil X (waste), size written when it fits
  sh.offcuts.forEach((c) => {
    const bx = X(c.x), by = Y(c.y), bw = c.w * k, bh = c.h * k;
    g += holeMark([[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]]);
    const t = `${nf(c.w)}×${nf(c.h)}`;
    if (bw >= tw(t, 12) + 4 && bh >= 18 && place.fits(bx + bw / 2 - tw(t, 12) / 2, by + bh / 2 - 8, tw(t, 12), 16)) {
      place.take(bx + bw / 2 - tw(t, 12) / 2, by + bh / 2 - 8, tw(t, 12), 16);
      g += `<text x="${n1(bx + bw / 2)}" y="${n1(by + bh / 2 + 4)}" class="mk-fig" text-anchor="middle">${t}</text>`;
    }
  });
  // pieces, each outline first so labels (placed afterwards) sit on top
  sh.items.forEach((p) => {
    const room = p.band ? 'B' : p.room;
    p.polys.forEach((poly) => { g += `<polygon points="${poly.map((q) => `${n1(X(q[0]))},${n1(Y(q[1]))}`).join(' ')}" class="mk-edge" style="fill:url(#${ROOM_PATTERN[room] ?? 'pt-r0'})"/>`; });
    p.folds.forEach((l) => { g += `<line x1="${n1(X(l.x1))}" y1="${n1(Y(l.y1))}" x2="${n1(X(l.x2))}" y2="${n1(Y(l.y2))}" class="mk-fold"/>`; });
    p.splits.forEach((l) => { g += `<line x1="${n1(X(l.x1))}" y1="${n1(Y(l.y1))}" x2="${n1(X(l.x2))}" y2="${n1(Y(l.y2))}" class="mk-split"/>`; });
  });
  sh.items.forEach((p) => {
    const bx = X(p.x), by = Y(p.y), bw = p.l * k, bh = p.w * k;
    if (p.sliver) {
      const t = Math.max(MINSLIVER, bh);
      g += `<rect x="${n1(bx)}" y="${n1(by + bh / 2 - t / 2)}" width="${n1(bw)}" height="${n1(t)}" class="mk-sliver"/>`;
      g += `<path d="M${n1(bx)} ${n1(by + bh / 2 - t / 2)}L${n1(bx + t)} ${n1(by + bh / 2 + t / 2)}M${n1(bx + t)} ${n1(by + bh / 2 - t / 2)}L${n1(bx)} ${n1(by + bh / 2 + t / 2)}" class="mk-x"/>`;
      place.take(bx, by, bw, bh);
      return;
    }
    // face-side dot at the lower left, where the piece is large enough
    if (bw >= 26 && bh >= 22) {
      g += `<circle cx="${n1(bx + 10)}" cy="${n1(by + bh - 10)}" r="6" class="mk-face"/><circle cx="${n1(bx + 10)}" cy="${n1(by + bh - 10)}" r="1.8" class="mk-face-dot"/>`;
      place.take(bx + 3, by + bh - 17, 14, 14);
    }
    // the number written on the piece: 18 px where it fits, else 12 px, else only in the table
    const label = p.label;
    const cand: Array<{ size: number; cls: string }> = [{ size: 18, cls: 'mk-num' }, { size: 12, cls: 'mk-fig mk-bold' }];
    let done = false;
    for (const c of cand) {
      const w = tw(label, c.size), h = c.size + 4;
      if (bw < w + 4 || bh < h + 2) continue;
      for (const [fx, fy] of [[0.5, 0.5], [0.3, 0.5], [0.7, 0.5], [0.5, 0.3], [0.5, 0.7]] as const) {
        const x0 = bx + bw * fx - w / 2, y0 = by + bh * fy - h / 2;
        if (x0 < bx || x0 + w > bx + bw || y0 < by || y0 + h > by + bh) continue;
        if (place.fits(x0, y0, w, h)) { place.take(x0, y0, w, h); g += `<text x="${n1(x0 + w / 2)}" y="${n1(y0 + h - 4)}" class="${c.cls}" text-anchor="middle">${esc(label)}</text>`; done = true; break; }
      }
      if (done) break;
    }
    // size, bottom right, only where it does not touch anything
    const size = `${nf(p.l)}×${nf(p.w)}`, w2 = tw(size, 12), h2 = 16;
    const x2 = bx + bw - w2 - 2, y2 = by + bh - h2 - 1;
    if (x2 >= bx + 2 && y2 >= by && place.fits(x2, y2, w2, h2)) {
      place.take(x2, y2, w2, h2);
      g += `<text x="${n1(x2 + w2 / 2)}" y="${n1(y2 + h2 - 4)}" class="mk-note" text-anchor="middle">${size}</text>`;
    }
  });
  const rooms = [...new Set(sh.items.map((p: SheetPiece) => (p.band ? L.band : (o.prefix ?? ((k) => k))(p.room))))].join(', ');
  const title = `${L.plate} ${sh.no}${sh.extra ? ' (' + L.extraPlate + ')' : ''}: ${rooms} · ${L.utilisation} ${Math.round(sh.use * 100)}%`;
  g += `<text x="${PAD}" y="18" class="mk-title" text-anchor="start">${esc(title)}</text>`;
  return { svg: g, w: W, h: H, title, collisions: 0 };
}

/** SVG strings of the shared cut plates, one per plate, 1 unit = 1 px. */
export function sharedPlateMarks(R: Pick<CutResult, 'PL' | 'PW' | 'plates'>, minOffcut: number, minStrip: number, o: PlateOptions): string[] {
  const L = o.labels ?? PL_LABELS;
  return cutSheets(R, minOffcut, L.bandShort, minStrip, o.prefix).map((sh) => {
    const d = plateMarks(sh, R.PL, R.PW, o);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(d.w)} ${Math.round(d.h)}" width="${Math.round(d.w)}" height="${Math.round(d.h)}" role="img" aria-label="${esc(d.title)}" class="mark plate">${MARK_DEFS}${d.svg}</svg>`;
  });
}
