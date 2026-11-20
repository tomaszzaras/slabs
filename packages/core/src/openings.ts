// Openings (windows, doors, cut-outs) cut out of pieces. An opening is a polygon in the coordinates of its surface:
// boards (u along the plate, z across), gable walls (x across, h = height from the floor). Pieces are clipped with
// polygon-clipping; a hole that stays inside a piece keeps the piece's kind (so nesting and pairing are unchanged),
// an opening that cuts through an edge turns the piece into one or more polygon pieces (nested by bounding box).
import polygonClipping from 'polygon-clipping';
import { pieceOutline, polyArea } from './geometry';
import type { Piece, Pt } from './types';

export type OpeningKind = 'window' | 'door' | 'cutout';
export interface Opening { id: string; kind: OpeningKind; surface: number; pts: Pt[] }

export const rectPts = (a: number, b: number, w: number, h: number): Pt[] => [[a, b], [a + w, b], [a + w, b + h], [a, b + h]];
export const rectOpening = (id: string, kind: OpeningKind, surface: number, a: number, b: number, w: number, h: number): Opening => ({ id, kind, surface, pts: rectPts(a, b, w, h) });

/** An axis-aligned rectangle (4 points)? Then it can be edited by position and size. */
export function asRect(pts: Pt[]): { a: number; b: number; w: number; h: number } | null {
  if (pts.length !== 4) return null;
  const xs = [...new Set(pts.map((q) => Math.round(q[0] * 1000)))], ys = [...new Set(pts.map((q) => Math.round(q[1] * 1000)))];
  if (xs.length !== 2 || ys.length !== 2) return null;
  const x0 = Math.min(...xs) / 1000, x1 = Math.max(...xs) / 1000, y0 = Math.min(...ys) / 1000, y1 = Math.max(...ys) / 1000;
  return { a: x0, b: y0, w: x1 - x0, h: y1 - y0 };
}

type Ring = Array<[number, number]>;
const open = (r: Ring): Pt[] => { const q = r.slice(); const f0 = q[0]!, l = q[q.length - 1]!; if (f0[0] === l[0] && f0[1] === l[1]) q.pop(); return q as Pt[]; };
const bbox = (pts: Pt[]) => ({ x0: Math.min(...pts.map((q) => q[0])), y0: Math.min(...pts.map((q) => q[1])), x1: Math.max(...pts.map((q) => q[0])), y1: Math.max(...pts.map((q) => q[1])) });

/** Opening polygon in a piece's own coordinates (x along the plate, y across). */
function toLocal(o: Opening, p: Piece): Pt[] {
  const s = p.src!;
  return o.pts.map((q): Pt => (s.kind === 'board' ? [q[0] - s.u0, q[1] - s.z0] : [q[1] - s.u0, q[0] - s.z0]));
}

function clipOne(p: Piece, holes: Pt[][]): Piece[] | null {
  const outline = pieceOutline(p);
  const bb = bbox(outline);
  const hit = holes.filter((h) => { const hb = bbox(h); return hb.x0 < bb.x1 && hb.x1 > bb.x0 && hb.y0 < bb.y1 && hb.y1 > bb.y0; });
  if (!hit.length) return null;
  if (!hit.some((h) => polygonClipping.intersection([outline as Ring], [h as Ring]).length)) return null;
  const diff = polygonClipping.difference([outline as Ring], ...hit.map((h) => [h as Ring]));
  const oa = polyArea(outline);
  const polys = diff.map((poly) => ({ outer: open(poly[0]!), holes: poly.slice(1).map(open) })).filter((q) => polyArea(q.outer) > 1);
  if (polys.length === 1 && Math.abs(polyArea(polys[0]!.outer) - oa) < 1e-4) {
    if (!polys[0]!.holes.length) return null;
    return [{ ...p, holes: [...(p.holes ?? []), ...polys[0]!.holes] }];
  }
  polys.sort((a, b) => bbox(a.outer).x0 - bbox(b.outer).x0 || bbox(a.outer).y0 - bbox(b.outer).y0);
  const cuts = p.cuts ?? (p.cut ? [p.cut] : []);
  return polys.map((q, i): Piece => {
    const b = bbox(q.outer);
    const shift = (r: Pt[]) => r.map((v): Pt => [v[0] - b.x0, v[1] - b.y0]);
    const mine = cuts.map((c) => c - b.x0).filter((c) => c > 0.5 && c < b.x1 - b.x0 - 0.5);
    const out: Piece = {
      kind: 'poly', l: b.x1 - b.x0, w: b.y1 - b.y0, ids: p.ids, room: p.room, outline: shift(q.outer),
      seg: polys.length > 1 ? (p.seg ?? '') + String.fromCharCode(97 + i) : p.seg,
    };
    if (q.holes.length) out.holes = q.holes.map(shift);
    if (mine.length) { out.cuts = mine; out.cut = mine[0]!; }
    if (p.splits) out.splits = p.splits;
    if (p.tg) {
      // an edge of the original piece stays profiled where the new piece still touches it
      const e = 1e-6, g: NonNullable<Piece['tg']> = {};
      if (p.tg.l0 && Math.abs(b.x0 - bb.x0) < e) g.l0 = p.tg.l0;
      if (p.tg.l1 && Math.abs(b.x1 - bb.x1) < e) g.l1 = p.tg.l1;
      if (p.tg.w0 && Math.abs(b.y0 - bb.y0) < e) g.w0 = p.tg.w0;
      if (p.tg.w1 && Math.abs(b.y1 - bb.y1) < e) g.w1 = p.tg.w1;
      if (g.l0 || g.l1 || g.w0 || g.w1) out.tg = g;
    }
    return out;
  });
}

/** Cuts the openings out of the pieces. Pieces without `src`, or on surfaces without openings, are returned unchanged. */
export function applyOpenings(pieces: Piece[], openings: Opening[]): Piece[] {
  if (!openings.length) return pieces;
  const out: Piece[] = [];
  const holesOf = (p: Piece) => openings.filter((o) => o.surface === p.src!.surf).map((o) => toLocal(o, p));
  pieces.forEach((p) => {
    if (!p.src || !openings.some((o) => o.surface === p.src!.surf)) { out.push(p); return; }
    if (p.kind === 'pair') {
      const s = p.src;
      const a: Piece = { kind: 'trap', l: Math.max(p.ya!, p.yb!), w: p.w, ids: [p.ids[0]!], room: p.room, ha: p.ya, hb: p.yb, prof: [[0, p.ya!], [1, p.yb!]], edges: p.edges && { ...p.edges, w1: 'joint' }, src: s };
      const b: Piece = { kind: 'trap', l: Math.max(p.yb!, p.yc!), w: p.w, ids: [p.ids[1]!], room: p.room, ha: p.yb, hb: p.yc, prof: [[0, p.yb!], [1, p.yc!]], edges: p.edges && { ...p.edges, w0: 'joint' }, src: { ...s, z0: s.z0 + p.w } };
      const ra = clipOne(a, holesOf(a)), rb = clipOne(b, holesOf(b));
      if (!ra && !rb) out.push(p); else { out.push(...(ra ?? [a]), ...(rb ?? [b])); }
      return;
    }
    if (p.kind === 'nest') { out.push(p); return; }
    const r = clipOne(p, holesOf(p));
    out.push(...(r ?? [p]));
  });
  return out;
}
