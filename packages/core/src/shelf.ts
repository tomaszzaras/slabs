// The artifact's per-room "shelf" packer. Kept for parity; the app uses the MaxRects search (nest.ts) for all cut plans.
import { polyArea } from './geometry';
import type { Piece } from './types';

export interface ShelfItem { p: Piece; x: number; y: number }
export interface ShelfPlate { shelves: Array<{ y: number; h: number; used: number }>; items: ShelfItem[]; usedW: number; area: number; use: number }

export function trapArea(p: Piece): number {
  const prof = p.prof!;
  let t = 0;
  for (let i = 0; i < prof.length - 1; i++) t += (p.w * (prof[i + 1]![0] - prof[i]![0]) * (prof[i]![1] + prof[i + 1]![1])) / 2;
  return t;
}

export function pieceArea(p: Piece): number {
  const holes = (p.holes ?? []).reduce((a, h) => a + polyArea(h), 0);
  return pieceArea0(p) - holes;
}

function pieceArea0(p: Piece): number {
  if (p.kind === 'trap') return trapArea(p);
  if (p.kind === 'nest') return p.parts!.reduce((t, q) => t + pieceArea(q.p), 0);
  if (p.kind === 'poly' && p.outline) return polyArea(p.outline);
  if (p.kind === 'pair') return (p.l - (p.gap ?? 0)) * p.w;
  return p.l * p.w;
}

export function packShelf(pcs: Piece[], PL: number, PW: number): ShelfPlate[] {
  const plates: ShelfPlate[] = [];
  pcs.slice().sort((a, b) => b.w - a.w || b.l - a.l).forEach((pc) => {
    let placed = false;
    for (let k = 0; k < plates.length && !placed; k++) {
      const pl = plates[k]!;
      for (let j = 0; j < pl.shelves.length; j++) {
        const sh = pl.shelves[j]!;
        if (sh.h >= pc.w - 1e-6 && PL - sh.used >= pc.l - 1e-6) { pl.items.push({ p: pc, x: sh.used, y: sh.y }); sh.used += pc.l; placed = true; break; }
      }
    }
    for (let k = 0; k < plates.length && !placed; k++) {
      const pl = plates[k]!;
      if (PW - pl.usedW >= pc.w - 1e-6) {
        const sh = { y: pl.usedW, h: pc.w, used: pc.l };
        pl.shelves.push(sh);
        pl.usedW += pc.w;
        pl.items.push({ p: pc, x: 0, y: sh.y });
        placed = true;
      }
    }
    if (!placed) {
      const pl: ShelfPlate = { shelves: [], items: [], usedW: pc.w, area: 0, use: 0 };
      pl.shelves.push({ y: 0, h: pc.w, used: pc.l });
      pl.items.push({ p: pc, x: 0, y: 0 });
      plates.push(pl);
    }
  });
  plates.forEach((pl) => {
    let a = 0;
    pl.items.forEach((it) => { a += it.p.kind === 'pair' ? it.p.l * it.p.w : it.p.kind === 'trap' ? trapArea(it.p) : it.p.l * it.p.w; });
    pl.area = a;
    pl.use = a / (PL * PW);
  });
  return plates;
}
