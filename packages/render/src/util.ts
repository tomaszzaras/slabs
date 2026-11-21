import type { Pt } from '@slabs/core';

export const f = (v: number): number => Math.round(v);
export const SC = 0.62;
export const M = 30;
export const pts = (a: Pt[]): string => a.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
export const T = (x: number, y: number, t: string | number, c?: string, a?: string): string =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="${c || 't2'}" text-anchor="${a || 'middle'}">${t}</text>`;
export const refMark = (x: number, y: number, label: string, dx?: number, dy?: number, anchor?: string): string =>
  `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" class="ref"/>` + T(x + (dx || 8), y + (dy || -7), label, 'rl', anchor || 'start');

/** Texts inside the drawings. Polish is what the artifact draws (parity tests); English is the other catalogue. */
export interface Labels {
  wall: string; ceiling: string; slope: string; roof: string; height: string; len: string;
  window: string; door: string; cutout: string; widthWord: string; lengthWord: string; ridge: string; partition: string; flatCeiling: string;
  strip: string; wrapWord: string; fromCeiling: string; alongAxis: string;
  perimeter: (len: number, h: number) => string;
  plate: string; fieldsWord: string; utilisation: string; band: string; bandShort: string; extraPlate: string;
  /** fold line (roof/wall bend) and the chalk line where a strip taller than the plate is divided */
  fold: string; split: string; face: string; start: string; sliver: string; zoomHint: string;
  /** letters written on a piece edge: tongue and groove */
  tongue: string; groove: string;
  /** names of the fold lines of the roof sheet, and of the room's centre line where there is no ridge (flat ceiling) */
  ridgeFold: string; centreFold: string; eaveFold: string; capFold: string; wallFold: string; partitionFold: string; crossCut: string; roofSheet: string;
}
export const PL_LABELS: Labels = {
  wall: 'ściana', ceiling: 'sufit', slope: 'skos', roof: 'dach', height: 'wys.', len: 'dł.',
  window: 'okno', door: 'drzwi', cutout: 'wycięcie', widthWord: 'szerokość', lengthWord: 'długość', ridge: 'kalenica', partition: 'ścianka działowa', flatCeiling: 'sufit płaski',
  strip: 'pasek', wrapWord: 'zawinięcie', fromCeiling: 'z sufitu', alongAxis: 'deski wzdłuż',
  perimeter: (len, h) => `Obwód ${len} cm, wysokość opaski ${h} cm`,
  plate: 'Płyta', fieldsWord: 'pola', utilisation: 'wykorzystanie', band: 'opaska', bandShort: 'op.', extraPlate: 'dokupiona na opaskę',
  fold: 'zgięcie', split: 'podział', face: 'lico', start: 'start', sliver: 'wąski pasek', zoomHint: 'Powiększ dwoma palcami, przesuń jednym', tongue: 'P', groove: 'W',
  ridgeFold: 'kalenica', centreFold: 'oś pomieszczenia', eaveFold: 'zgięcie dach/ściana', capFold: 'zgięcie sufit/skos', wallFold: 'ściana wycięcia', partitionFold: 'ścianka działowa', crossCut: 'cięcie poprzeczne', roofSheet: 'Dach',
};
export const EN_LABELS: Labels = {
  wall: 'wall', ceiling: 'ceiling', slope: 'slope', roof: 'roof', height: 'h.', len: 'len.',
  window: 'window', door: 'door', cutout: 'cut-out', widthWord: 'width', lengthWord: 'length', ridge: 'ridge', partition: 'partition wall', flatCeiling: 'flat ceiling',
  strip: 'strip', wrapWord: 'wrap', fromCeiling: 'from ceiling', alongAxis: 'boards along',
  perimeter: (len, h) => `Perimeter ${len} cm, band height ${h} cm`,
  plate: 'Plate', fieldsWord: 'fields', utilisation: 'utilisation', band: 'band', bandShort: 'band', extraPlate: 'extra, for the band',
  fold: 'fold', split: 'split', face: 'face', start: 'start', sliver: 'narrow strip', zoomHint: 'Pinch to zoom, drag to pan', tongue: 'T', groove: 'G',
  ridgeFold: 'ridge', centreFold: 'room centre line', eaveFold: 'fold roof/wall', capFold: 'fold ceiling/slope', wallFold: 'cut-out wall', partitionFold: 'partition wall', crossCut: 'cross-cut', roofSheet: 'Roof',
};
export const LABELS = { pl: PL_LABELS, en: EN_LABELS };

export interface Drawing { svg: string; w: number; h: number }
export const wrap = (r: Drawing): string => `<svg viewBox="0 0 ${f(r.w)} ${f(r.h)}" role="img">${r.svg}</svg>`;

/** Classes used by all drawings. The web app defines them with CSS variables (light/dark); exports use EXPORT_CSS. */
export const EXPORT_CSS =
  '.bd{fill:#f1f1f1;stroke:#222;stroke-width:1}svg text{fill:#1c2630;font-family:Arial,Helvetica,sans-serif}.sl{fill:#e3c196;stroke:#222;stroke-width:1.4}.j{stroke:#222;stroke-width:.8}.js{stroke:#c8372d;stroke-width:1.8}.cut{stroke:#c8372d;stroke-width:1.2;stroke-dasharray:4 2}.sp{stroke:#2f5d9c;stroke-width:2;stroke-dasharray:6 3}.rd{stroke:#c8372d;stroke-width:1;stroke-dasharray:5 3;fill:none}.win{fill:#9ec9e0;stroke:#222;stroke-width:.8}.hole{fill:#c8372d;fill-opacity:.4;stroke:#222;stroke-dasharray:4 2}.ref{fill:#c8372d;stroke:#fff;stroke-width:1.5}.t{font-size:12px;font-weight:700}.t2{font-size:11px}.t3{font-size:9px}.n{font-size:15px;font-weight:700}.n.s{font-size:9px}.rl{font-size:11px;font-weight:700;fill:#c8372d}.h{font-size:20px;font-weight:700}.sm{font-size:12px;fill:#444}.r0{fill:#e3c196}.r1{fill:#b8d3a8}.r2{fill:#a9c7e4}.r3{fill:#e4b3c8}.rb{fill:#f3e19a;stroke-dasharray:5 3}';

export const ROOM_COLORS = [
  { k: 'S', c: 'r0', col: '#e3c196' },
  { k: 'Sy', c: 'r1', col: '#b8d3a8' },
  { k: 'Ł1', c: 'r2', col: '#a9c7e4' },
  { k: 'Ł2', c: 'r3', col: '#e4b3c8' },
];
