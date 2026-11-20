// Data model of the printable cutting sheets: one sheet per plate, everything needed to cut it without the app.
// The PDF writer (packages/web/src/pdf) and the tests read this; it has no drawing code.
import type { CutResult, GuillotineCut, Piece, Pt, Rect } from '@slabs/core';
import { placedPolygons, polyArea } from '@slabs/core';

export interface SheetPiece {
  /** what is written on the piece, e.g. S12a (room prefix, field numbers, part letter) */
  label: string;
  room: string;
  /** field numbers of the grid (where the piece goes on the wall, matches the R points) */
  fields: string;
  /** cut size = fit size + allowances, cm */
  l: number;
  w: number;
  /** size the wall needs, only when an allowance changed it */
  fitL?: number;
  fitW?: number;
  /** top-left of the bounding box on the plate, cm from the plate corner */
  x: number;
  y: number;
  /** outline(s) in plate coordinates */
  polys: Pt[][];
  /** the outline is not a plain rectangle: corner coordinates relative to the piece's top-left corner (bounding box) */
  corners?: Pt[];
  /** slanted cut lines relative to the piece's top-left corner; `full` = runs from the top edge to the bottom edge */
  slants: Array<{ x1: number; y1: number; x2: number; y2: number; full: boolean }>;
  /** narrower than the minimum strip width: not a normal piece, to be trimmed to fit on site */
  sliver: boolean;
  /** bend lines (x on the plate) and split lines (segments) drawn on the piece */
  folds: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  splits: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  band: boolean;
  area: number;
}

export interface SheetPlate {
  no: number;
  extra: boolean;
  use: number;
  items: SheetPiece[];
  offcuts: Array<Rect & { keep: boolean }>;
  /** guillotine mode: cuts in cutting order */
  cuts: GuillotineCut[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const bbox = (polys: Pt[][]) => {
  const xs = polys.flat().map((p) => p[0]), ys = polys.flat().map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
};

function sheetPiece(p: Piece, polys: Pt[][], room: string, bandLabel: string, minStrip: number): SheetPiece {
  const b = bbox(polys);
  const label = p.band ? bandLabel : `${room}${p.ids.join('+')}${p.seg ?? ''}`;
  const rect = p.kind === 'rect';
  const folds: SheetPiece['folds'] = [], splits: SheetPiece['splits'] = [];
  if (rect) {
    (p.cuts ?? (p.cut ? [p.cut] : [])).forEach((c) => folds.push({ x1: b.x + c, y1: b.y, x2: b.x + c, y2: b.y2 }));
  }
  (p.splits ?? []).forEach((s) => { const x = s.edge === 'l0' ? b.x : b.x + p.l; splits.push({ x1: x, y1: b.y, x2: x, y2: b.y2 }); });
  const fitChanged = (p.fitL !== undefined && Math.abs(p.fitL - p.l) > 1e-6) || (p.fitW !== undefined && Math.abs(p.fitW - p.w) > 1e-6);
  const slants: SheetPiece['slants'] = [];
  if (!rect) {
    const q = polys[0]!, h = b.y2 - b.y;
    q.forEach((a, i) => {
      const c = q[(i + 1) % q.length]!;
      if (Math.abs(a[0] - c[0]) < 1e-6 || Math.abs(a[1] - c[1]) < 1e-6) return;
      const top = a[1] < c[1] ? a : c, bot = a[1] < c[1] ? c : a;
      slants.push({ x1: r1(top[0] - b.x), y1: r1(top[1] - b.y), x2: r1(bot[0] - b.x), y2: r1(bot[1] - b.y), full: Math.abs(top[1] - b.y) < 1e-6 && Math.abs(bot[1] - b.y2) < 1e-6 && h > 0 });
    });
  }
  const sliver = !p.band && minStrip > 0 && Math.min(p.fitW ?? p.w, p.w) < minStrip - 1e-6;
  return {
    sliver, slants,
    label, room: p.room ?? '', fields: p.ids.join(', '), l: r1(p.l), w: r1(p.w),
    fitL: fitChanged ? r1(p.fitL ?? p.l) : undefined, fitW: fitChanged ? r1(p.fitW ?? p.w) : undefined,
    x: r1(b.x), y: r1(b.y), polys, corners: rect ? undefined : polys[0]!.map((q): Pt => [r1(q[0] - b.x), r1(q[1] - b.y)]),
    folds, splits, band: !!p.band, area: polys.reduce((a, q) => a + polyArea(q), 0),
  };
}

/** One sheet per plate of a cut result. `bandLabel` is the word written on band pieces. */
export function cutSheets(R: Pick<CutResult, 'plates'>, minOffcut: number, bandLabel = 'op.', minStrip = 0): SheetPlate[] {
  return R.plates.map((pl, i) => {
    const items: SheetPiece[] = [];
    pl.items.forEach((it) => {
      const p = it.p;
      if (p.kind === 'nest') {
        const polys = placedPolygons(p, it.x, it.y);
        p.parts!.forEach((t, k) => items.push(sheetPiece({ ...t.p, room: t.p.room ?? p.room }, [polys[k]!], t.p.room ?? p.room ?? '', bandLabel, minStrip)));
      } else if (p.kind === 'pair') {
        const polys = placedPolygons(p, it.x, it.y);
        p.ids.forEach((id, k) => items.push(sheetPiece({ ...p, ids: [id], l: Math.max(...polys[k]!.map((q) => q[0])) - Math.min(...polys[k]!.map((q) => q[0])), kind: 'poly' }, [polys[k]!], p.room ?? '', bandLabel, minStrip)));
      } else items.push(sheetPiece(p, placedPolygons(p, it.x, it.y), p.room ?? '', bandLabel, minStrip));
    });
    return { no: i + 1, extra: !!pl.extra, use: pl.use, items, offcuts: (pl.offcuts ?? []).map((o) => ({ ...o, keep: o.w >= minOffcut && o.h >= minOffcut })), cuts: pl.cuts ?? [] };
  });
}

/** Piece list as CSV (one row per piece), for a shop list or a spreadsheet. */
export function piecesCsv(sheets: SheetPlate[]): string {
  const rows = [['plate', 'piece', 'room', 'fields', 'cut_length_cm', 'cut_width_cm', 'fit_length_cm', 'fit_width_cm', 'x_cm', 'y_cm']];
  sheets.forEach((s) => s.items.forEach((p) => rows.push([String(s.no), p.label, p.room, p.fields, String(p.l), String(p.w), String(p.fitL ?? p.l), String(p.fitW ?? p.w), String(p.x), String(p.y)])));
  return rows.map((r) => r.map((c) => (/[",;\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
}
