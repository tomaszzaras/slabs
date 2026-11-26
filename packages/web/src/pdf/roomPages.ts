// The room pages of the PDF: every room of the cut, numbered like its tab in the app, with the drawing of each of its surfaces and
// the field numbers the pieces on the plate sheets refer to ("Room · fields" column). The drawings are the app's own SVG marks, turned into
// images with the light print palette (the PDF is white paper whatever theme the app is in).
import { paletteKey } from '@slabs/core';
import { LABELS, fitScale, surfaceList, surfaceMarks, surfaceWidthCm, wrapMark } from '@slabs/render';
import { roomModel } from '../cut/request';
import type { Project, RoomRef } from '../state/project';

export interface RoomSurfaceImage { label: string; png: string; w: number; h: number }
export interface RoomImages { id: RoomRef; no: number; surfaces: RoomSurfaceImage[] }
export interface PlacedImage { s: RoomSurfaceImage; x: number; y: number; w: number; h: number }
export interface RoomPage { room: RoomImages; first: boolean; items: PlacedImage[] }

/** The theme tokens the drawings use, as light-mode values (an image cannot see the page's CSS variables). */
const INK: Record<string, string> = {
  foreground: '#1d2230', 'muted-foreground': '#565c6b', card: '#ffffff', background: '#fafafa', primary: '#2f5bd3', 'primary-foreground': '#fafafa',
  destructive: '#cf3329', win: '#bfdcf0', r0: '#f1d9ad', r1: '#cfe3bd', r2: '#bcd6ef', r3: '#efc9db', rb: '#f3e7ad',
  'other-bg': '#e6e6e3', 'other-ink': '#a3a3a0', border: '#e3e4e8', 'font-sans': 'Helvetica, Arial, sans-serif',
};

/** The drawing classes of the render package (the same rules as the app's index.css, without the editor overlay). */
const CSS = `
svg text { fill: var(--foreground); font-family: var(--font-sans); font-variant-numeric: tabular-nums; }
.mk-edge { stroke: var(--foreground); stroke-width: 1.4; }
.mk-chalk { stroke: var(--primary); stroke-width: 1.6; }
.mk-chalk.mk-start { stroke-width: 3; }
.mk-start-tick { stroke: var(--primary); stroke-width: 3.5; stroke-linecap: round; }
.mk-arrow { stroke: var(--primary); stroke-width: 2; fill: none; }
.mk-fold { stroke: var(--destructive); stroke-width: 1.6; stroke-dasharray: 7 4; }
.mk-split { stroke: var(--primary); stroke-width: 1.8; stroke-dasharray: 2 4; }
.mk-dim { stroke: var(--muted-foreground); stroke-width: 1; fill: none; }
.mk-x { stroke: var(--foreground); stroke-width: 2; stroke-linecap: round; opacity: .7; fill: none; }
.mk-waste { fill: none; stroke: var(--foreground); stroke-width: 1; stroke-dasharray: 3 3; }
.mk-hole { fill: var(--win); fill-opacity: .55; stroke: var(--foreground); stroke-width: 1; stroke-dasharray: 5 3; }
.mk-other { stroke-dasharray: none; }
.mk-other-t { font-size: 13px; font-weight: 600; fill: var(--foreground); paint-order: stroke; stroke: var(--card); stroke-width: 4px; stroke-linejoin: round; }
.mk-face { stroke: var(--foreground); stroke-width: 1.4; fill: none; }
.mk-face-dot { fill: var(--foreground); }
.mk-dot { fill: var(--primary); stroke: var(--card); stroke-width: 1.5; }
.mk-leader { stroke: var(--primary); stroke-width: 1; }
.mk-t, .mk-fig, .mk-note, .mk-warn { font-size: 12px; paint-order: stroke; stroke: var(--card); stroke-width: 3px; stroke-linejoin: round; }
.mk-fig { font-weight: 500; }
.mk-note { fill: var(--muted-foreground); }
.mk-warn { fill: var(--destructive); font-weight: 600; }
.mk-num { font-size: 18px; font-weight: 700; paint-order: stroke; stroke: var(--card); stroke-width: 4px; stroke-linejoin: round; }
.mk-title { font-size: 15px; font-weight: 600; }
.mk-ref rect { fill: var(--card); stroke: var(--primary); stroke-width: 1.5; }
.mk-ref text { font-size: 12px; font-weight: 700; }
.mk-sliver { fill: var(--card); stroke: var(--destructive); stroke-width: 1.2; }
.mk-plate { fill: var(--card); stroke: var(--foreground); stroke-width: 2; }
.mk-bold { font-weight: 700; }
.mk-tongue-strip { fill: var(--foreground); fill-opacity: .55; stroke: none; }
.mk-edgeletter { font-size: 12px; font-weight: 700; fill: var(--foreground); paint-order: stroke; stroke: var(--card); stroke-width: 3px; }
.mk-sp-on { stroke: var(--foreground); stroke-width: 3.5; stroke-linecap: butt; }
.mk-xcut { stroke: var(--primary); stroke-width: 3; }
.sp-hit { fill: transparent; }
svg .sl { fill: var(--r0); stroke: var(--foreground); stroke-width: 1.4; }
svg .sl.r0 { fill: url(#pt-r0); } svg .sl.r1 { fill: url(#pt-r1); } svg .sl.r2 { fill: url(#pt-r2); } svg .sl.r3 { fill: url(#pt-r3); }
svg .sl.rb { fill: url(#pt-rb); stroke-dasharray: 5 3; }
svg .j { stroke: var(--primary); stroke-width: 1; }
svg .js { stroke: var(--primary); stroke-width: 2.2; }
svg .cut { stroke: var(--destructive); stroke-width: 1.4; stroke-dasharray: 4 2; }
svg .sp { stroke: var(--primary); stroke-width: 2; stroke-dasharray: 2 4; }
svg .bd { fill: var(--card); stroke: var(--foreground); stroke-width: 1.2; }
svg .t { font-size: 12px; font-weight: 700; } svg .t2 { font-size: 12px; } svg .t3 { font-size: 12px; fill: var(--muted-foreground); }
svg .n { font-size: 15px; font-weight: 700; } svg .n.s { font-size: 11px; }
svg .rl { font-size: 12px; font-weight: 700; }
`;

const resolve = (t: string): string => t.replace(/var\(--([\w-]+)\)/g, (_m, k: string) => INK[k] ?? '#000');

/** A complete <svg> string (with its patterns) as a PNG data URL on a white ground, twice the drawing's pixel size so print stays sharp. */
async function svgToPng(svg: string, w: number, h: number, ratio = 2): Promise<string> {
  const styled = resolve(svg.replace(/^(<svg[^>]*>)/, `$1<style>${CSS}</style><rect width="100%" height="100%" fill="#ffffff"/>`));
  const url = URL.createObjectURL(new Blob([styled], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('svg image')); img.src = url; });
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * ratio)); c.height = Math.max(1, Math.round(h * ratio));
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

/** Drawings of every surface of the given rooms, in the order given. `no` is the room's number: its place among the project's rooms. */
export async function roomImages(project: Project, ids: RoomRef[], lang: 'pl' | 'en'): Promise<RoomImages[]> {
  const out: RoomImages[] = [];
  const nfi = (v: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(Math.round(v * 10) / 10);
  for (const id of ids) {
    const m = roomModel(project, id, lang);
    const minStrip = project.settings.minStripCm;
    const plateLen = (m.p.PL ?? 0) - 2 * (m.p.trimL ?? m.p.trim ?? 0);
    const surfaces: RoomSurfaceImage[] = [];
    for (const sf of surfaceList(m, minStrip, plateLen)) {
      const scale = fitScale(surfaceWidthCm(m, sf.key), 1000);
      const mk = surfaceMarks(m, sf.key, paletteKey(id), { scale, minStrip, plateLen, nf: nfi, labels: LABELS[lang], openings: (project.openings[id] ?? []).filter((o) => o.surface === sf.key) });
      if (!mk) continue;
      surfaces.push({ label: sf.label, png: await svgToPng(wrapMark(mk, sf.label), mk.w, mk.h), w: mk.w, h: mk.h });
    }
    out.push({ id, no: project.roomOrder.indexOf(id) + 1, surfaces });
  }
  return out;
}

const MM_PER_PX = 25.4 / 96;

/** Puts the drawings on A4 landscape pages: a room starts on a new page; drawings go left to right in rows (small ones side by side), never cut by a page end. */
export function paginate(rooms: RoomImages[], pageW: number, pageH: number, margin: number, top = 26, bottom = 12, caption = 6, gap = 6): RoomPage[] {
  const maxW = pageW - 2 * margin, bodyH = pageH - bottom - top;
  const pages: RoomPage[] = [];
  for (const room of rooms) {
    let page: RoomPage = { room, first: true, items: [] };
    pages.push(page);
    let x = margin, rowTop = top, rowH = 0;
    for (const sf of room.surfaces) {
      let w = Math.min(maxW, sf.w * MM_PER_PX), h = (w * sf.h) / sf.w;
      if (h + caption > bodyH) { h = bodyH - caption; w = (h * sf.w) / sf.h; }
      if (x > margin && x + w > pageW - margin) { rowTop += rowH + 4; x = margin; rowH = 0; }
      if (page.items.length && rowTop + caption + h > top + bodyH) { page = { room, first: false, items: [] }; pages.push(page); rowTop = top; x = margin; rowH = 0; }
      page.items.push({ s: sf, x, y: rowTop + caption, w, h });
      x += w + gap; rowH = Math.max(rowH, caption + h);
    }
  }
  return pages;
}
