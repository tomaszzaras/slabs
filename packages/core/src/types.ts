import type { Params } from './util';

export type Pt = [number, number];

export interface FieldDef {
  group: string;
  key: string;
  label: string;
  /** 'cm', '°' or 'chk' for a checkbox */
  unit: string;
}

export interface Col {
  id: number;
  a: number;
  b: number;
}

export interface RefPoint {
  id: string;
  name: string;
  fields: string;
  where: string;
  coord: string;
}

/** A board surface (roof + wall in one piece, or ceiling + wrapped walls). u runs along the plate, z across the joints. */
export interface BoardSurface {
  key: number;
  kind: 'board';
  anchor: number;
  title: string;
  u: number;
  z0: number;
  z1: number;
  cut?: number | null;
  cuts?: number[];
  notch?: Pt | null;
  cols: Col[];
  zr: number;
  ur: number;
  ref: string;
  flat?: number;
  desc?: string;
  top?: { x: number; h: number };
  lab?: string;
  /** user-language name of the surface and its coordinates (secondary); `title` is the artifact's text */
  label?: string;
  detail?: string;
}

export interface GableWall {
  on: number;
  z: number;
  x0: number;
  x1: number;
  bs: number;
  title: string;
  anchor: number;
  rid: number;
  strips: Col[];
  xr: number;
  ref: string;
  label?: string;
  detail?: string;
}

export type PieceKind = 'rect' | 'pair' | 'trap' | 'nest' | 'poly';

/**
 * A piece to cut. `l` runs along the plate (grain), `w` across it.
 * rect/trap/pair are the artifact's kinds; every piece can also be described as a polygon (see pieceOutline).
 */
export interface Piece {
  kind: PieceKind;
  l: number;
  w: number;
  ids: number[];
  room?: string;
  cut?: number | null;
  cuts?: number[];
  part?: string;
  seg?: string;
  band?: boolean;
  // trap
  ha?: number;
  hb?: number;
  prof?: Pt[];
  // pair (gap: extra distance between the two halves along the plate, for the saw cut)
  gap?: number;
  ya?: number;
  yb?: number;
  yc?: number;
  // nest
  parts?: NestPart[];
  // poly: outline in plate-local (x along l, y across w) coordinates, origin at the piece's top-left
  outline?: Pt[];
  // fitting allowances (cm): fit size is l x w before allowances
  fitL?: number;
  fitW?: number;
  /** what each edge touches (decides the fitting allowance) */
  edges?: PieceEdges;
  /** where this piece was cut from a longer one (taller than the plate): `at` = distance of the split line from the original l0 end, cm */
  splits?: PieceSplit[];
  /** where the piece sits on its surface (surface key, offset along the plate and across it, cm); `gable`: u0 = base height, z0 = x of the strip start */
  src?: PieceSrc;
  /** holes (windows, doors, cut-outs) inside the outline, plate-local like `outline`; the area is not wood */
  holes?: Pt[][];
  /** tongue (T) / groove (G) the edge needs; an edge that is not listed is a plain cut (wall, fold, opening, split by the user) */
  tg?: Tg;
  /** joined across a fold on purpose (roof sheet): the cut must not split it at its bend lines */
  noSplit?: boolean;
}

export type Prof = 'T' | 'G';
/** Typed edge profiles: l0/l1 = the two ends along the plate, w0/w1 = the two sides across it (same names as PieceEdges). */
export interface Tg { l0?: Prof; l1?: Prof; w0?: Prof; w1?: Prof }

/** `dir` -1: the plate runs toward smaller u (the roof sheet's left side); u0 is the u of the piece's l0 end */
export interface PieceSrc { kind: 'board' | 'gable'; surf: number; u0: number; z0: number; dir?: 1 | -1 }

export interface PieceSplit { edge: 'l0' | 'l1'; at: number }

export type EdgeKind = 'wall' | 'joint' | 'bend' | 'opening' | 'gap';
/** l0/l1: the two ends along the plate (l), w0/w1: the two sides across it (w). */
export interface PieceEdges { l0: EdgeKind; l1: EdgeKind; w0: EdgeKind; w1: EdgeKind }

export interface NestPart {
  p: Piece;
  rot: 0 | 1;
  ox: number;
  oy: number;
}

import type { RoomFace } from './face';
import type { RoomSpec } from './spec';

export interface RoomModelBase {
  /** surfaces drawn with the generic boards (cladding.ts); the preset surfaces in `legacyOff` are not drawn by the preset code */
  faces?: RoomFace[];
  legacyOff?: number[];
  spec?: RoomSpec;
  p: Params;
  warn: string[];
  surfs: BoardSurface[];
  refs: RefPoint[];
  areaCm2: number;
  areaM2: number;
  fields: number;
  plate: number;
  minPlates: number;
  present: Record<number, number>;
  TOPH: number;
}
