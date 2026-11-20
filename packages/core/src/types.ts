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
}

export type EdgeKind = 'wall' | 'joint' | 'bend' | 'opening' | 'gap';
/** l0/l1: the two ends along the plate (l), w0/w1: the two sides across it (w). */
export interface PieceEdges { l0: EdgeKind; l1: EdgeKind; w0: EdgeKind; w1: EdgeKind }

export interface NestPart {
  p: Piece;
  rot: 0 | 1;
  ox: number;
  oy: number;
}

export interface RoomModelBase {
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
