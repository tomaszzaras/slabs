import type { CutResult } from '@slabs/core';
import { cutSheets, type SheetPiece, type SheetPlate } from '@slabs/render';
import type { Strings } from '../i18n/pl';
import { paginate, roomImages, type RoomImages } from './roomPages';
import type { Project } from '../state/project';

export interface PdfInput {
  R: CutResult;
  project: Project;
  s: Strings;
  lang: string;
  /** "Shared cut" or the room name */
  title: string;
  roomName: (key: string) => string;
  /** how a room key is written on pieces */
  prefix?: (key: string) => string;
}

const M = 10, PW_MM = 297, PH_MM = 210;
const GREY: Record<string, number> = { S: 0.92, Sy: 0.82, 'Ł1': 0.72, 'Ł2': 0.62 };

async function b64(url: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Vector PDF: cover page + one A4 landscape sheet per plate, black-and-white readable. */
export async function exportPdf(inp: PdfInput): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { R, project, s } = inp;
  const sheets = cutSheets(R, project.settings.minOffcutCm, s.pdf.bandWord, project.settings.minStripCm, inp.prefix);
  // the rooms of this cut, numbered like their tabs in the app; their drawings get pages of their own (a failure to draw one never loses the cutting sheets)
  const present = new Set(sheets.flatMap((sh) => sh.items.filter((p) => !p.band).map((p) => p.room)));
  const roomIds = project.roomOrder.filter((id) => present.has(id));
  const roomNo = (key: string) => project.roomOrder.indexOf(key) + 1;
  let images: RoomImages[] = [];
  try { images = await roomImages(project, roomIds, inp.lang === 'en' ? 'en' : 'pl'); } catch { images = []; }
  const roomPages = paginate(images, PW_MM, PH_MM, M);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const base = import.meta.env.BASE_URL ?? './';
  for (const [file, style] of [['Barlow-Regular.ttf', 'normal'], ['Barlow-Bold.ttf', 'bold']] as const) {
    doc.addFileToVFS(file, await b64(`${base}fonts/pdf/${file}`));
    doc.addFont(file, 'Barlow', style);
  }
  const font = (bold = false, size = 9) => { doc.setFont('Barlow', bold ? 'bold' : 'normal'); doc.setFontSize(size); };
  const nf = (v: number, d = 1) => new Intl.NumberFormat(inp.lang, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  const total = sheets.length + 1 + roomPages.length;
  const footer = (page: number) => { font(false, 7); doc.setTextColor(90); doc.text(`Slabs · ${project.name} · ${s.pdf.page(page, total)}`, M, PH_MM - 5); doc.setTextColor(0); };

  // ---- cover page
  font(true, 22); doc.text(project.name, M, 22);
  font(false, 12); doc.text(`${s.pdf.cover} · ${inp.title}`, M, 30);
  font(false, 9); doc.text(new Date().toLocaleDateString(inp.lang), PW_MM - M, 22, { align: 'right' });
  const st = project.settings;
  const al = st.allowances;
  const TG = inp.lang === 'en' ? ['T', 'G'] : ['P', 'W'];
  const facts: Array<[string, string]> = [
    [s.pdf.plates, String(R.plates.length)],
    [s.pdf.plateSize, `${R.PL} × ${R.PW} cm`],
    ...(R.tongue ? [[s.pdf.tgOn(R.tongue.t, st.plate.profile === 'all' ? s.settings.profileAll : s.settings.profileLong), TG[0] + ' / ' + TG[1]] as [string, string]] : []),
    [s.pdf.area, `${nf(R.stats.grossM2)} m²`],
    [s.pdf.cost, `${nf(R.stats.cost, 0)} zł (${nf(project.settings.platePrice)} zł/m²)`],
    [s.pdf.util, `${Math.round(R.stats.utilisation * 100)}%`],
    [s.pdf.kerf, `${nf(st.kerfMm, 1)} mm`],
    [s.pdf.trim, `${nf(st.trimMm, 1)} mm`],
    [s.pdf.allowances, al.enabled ? `${s.pdf.wall} ${nf(al.wall, 0)} mm, ${s.pdf.bend} ${nf(al.bend, 0)} mm, ${s.pdf.opening} ${nf(al.opening, 0)} mm` : s.pdf.none],
    [s.pdf.mode, st.guillotine ? s.pdf.guillotine : s.pdf.free],
  ];
  let y = 42;
  facts.forEach(([k, v]) => { font(false, 10); doc.text(k, M, y); font(true, 10); doc.text(v, M + 62, y); y += 6.5; });
  // plate list in columns
  font(true, 11); doc.text(s.pdf.plateList, 150, 42);
  font(false, 8);
  sheets.forEach((sh, i) => {
    const col = Math.floor(i / 24), row = i % 24;
    const rooms = [...new Set(sh.items.map((p) => (p.band ? s.pdf.bandWord : p.room)))].join(' ');
    doc.text(`${sh.no}`, 150 + col * 68, 49 + row * 5.6);
    doc.text(`${rooms}${sh.extra ? ' *' : ''}`, 160 + col * 68, 49 + row * 5.6);
    doc.text(`${Math.round(sh.use * 100)}%`, 205 + col * 68 - 4, 49 + row * 5.6, { align: 'right' });
  });
  const bandCount = new Map<string, number[]>();
  sheets.forEach((sh) => sh.items.filter((p) => p.band).forEach((p) => { const key = `${nf(p.l, 0)}×${nf(p.w, 0)}`; bandCount.set(key, [...(bandCount.get(key) ?? []), sh.no]); }));
  if (bandCount.size) {
    font(false, 8);
    const txt = [...bandCount].map(([size, plates]) => `${s.pdf.repeated(plates.length, size)} (${[...new Set(plates)].join(', ')})`).join(' · ');
    doc.text(`${s.pdf.bandList}: ${txt}`, M, Math.max(y + 8, 150), { maxWidth: 130 });
  }
  font(false, 8); doc.setTextColor(90);
  if (sheets.some((sh) => sh.extra)) doc.text(s.pdf.starMark, M, 186, { maxWidth: 270 });
  doc.text(s.pdf.cutVsFit, M, 190, { maxWidth: 270 }); doc.setTextColor(0);
  footer(1);

  // ---- one page (or more) per room: the surfaces with their field numbers
  roomPages.forEach((pg, i) => {
    doc.addPage('a4', 'landscape');
    font(true, 15); doc.text(`${s.pdf.roomNo(pg.room.no)} · ${inp.roomName(pg.room.id)}${pg.first ? '' : ' ' + s.pdf.cont}`, M, 16);
    font(false, 8.5); doc.setTextColor(90); doc.text(s.pdf.roomPagesNote, M, 22, { maxWidth: PW_MM - 2 * M }); doc.setTextColor(0);
    pg.items.forEach((it) => {
      font(true, 10); doc.text(it.s.label, it.x, it.y - 1.6, { maxWidth: Math.max(it.w, 40) });
      doc.addImage(it.s.png, 'PNG', it.x, it.y, it.w, it.h, undefined, 'FAST');
    });
    footer(i + 2);
  });

  // ---- one sheet per plate
  // the plate is drawn as large as the page allows (full width, room on the left for the width dimension)
  const ox = M + 9, oy = 38;
  const k = (PW_MM - M - ox) / R.PL; // mm on paper per cm on the plate
  const scale = Math.round(10 / k * 10) / 10;
  sheets.forEach((sh, idx) => {
    doc.addPage('a4', 'landscape');
    drawPlate(doc, sh, idx + 2 + roomPages.length);
  });

  type D = InstanceType<typeof jsPDF>;
  /** horizontal dimension line from x1 to x2 (mm) at y with the figure in a gap in the middle */
  function dimH(d: D, x1: number, x2: number, y: number, text: string, fs = 6.5) {
    font(false, fs); d.setLineWidth(0.15); d.setDrawColor(40);
    const tw = d.getTextWidth(text) + 1.4, mid = (x1 + x2) / 2;
    if (x2 - x1 > tw + 2) { d.line(x1, y, mid - tw / 2, y); d.line(mid + tw / 2, y, x2, y); } else d.line(x1, y, x2, y);
    d.line(x1, y - 0.9, x1, y + 0.9); d.line(x2, y - 0.9, x2, y + 0.9);
    d.text(text, mid, y + fs * 0.11, { align: 'center' });
    d.setDrawColor(0);
  }
  function dimV(d: D, y1: number, y2: number, x: number, text: string, fs = 6.5) {
    font(false, fs); d.setLineWidth(0.15); d.setDrawColor(40);
    const tw = d.getTextWidth(text) + 1.4, mid = (y1 + y2) / 2;
    if (y2 - y1 > tw + 2) { d.line(x, y1, x, mid - tw / 2); d.line(x, mid + tw / 2, x, y2); } else d.line(x, y1, x, y2);
    d.line(x - 0.9, y1, x + 0.9, y1); d.line(x - 0.9, y2, x + 0.9, y2);
    d.text(text, x + fs * 0.11, mid, { align: 'center', angle: 90 });
    d.setDrawColor(0);
  }

  function drawPlate(d: D, sh: SheetPlate, page: number) {
    font(true, 15); d.text(s.pdf.plateNo(sh.no, sheets.length), M, 16);
    font(false, 10);
    d.text(`${R.PL} × ${R.PW} cm · ${s.pdf.useWord} ${Math.round(sh.use * 100)}% · ${s.pdf.scale} 1:${nf(scale, 0)}${sh.extra ? ' · ' + s.pdf.extraPlate : ''}`, M, 23);
    // grain and face
    d.setLineWidth(0.3); d.line(PW_MM - M - 50, 16, PW_MM - M - 8, 16); d.triangle(PW_MM - M - 8, 16, PW_MM - M - 12, 14.5, PW_MM - M - 12, 17.5, 'F');
    font(false, 8); d.text(s.pdf.grain, PW_MM - M - 50, 13);
    d.setLineWidth(0.25); d.circle(PW_MM - M - 50, 21.5, 1.6); d.circle(PW_MM - M - 50, 21.5, 0.4, 'F'); d.text(s.pdf.face, PW_MM - M - 46, 22.4);
    // plate with its overall dimensions and the origin (0 ; 0) all x ; y are measured from
    d.setLineWidth(0.5); d.setDrawColor(0); d.rect(ox, oy, R.PL * k, R.PW * k);
    dimH(d, ox, ox + R.PL * k, oy - 4, `${R.PL} cm`, 7);
    dimV(d, oy, oy + R.PW * k, ox - 4, `${R.PW} cm`, 7);
    d.setFillColor(0, 0, 0); d.triangle(ox, oy, ox + 3.2, oy, ox, oy + 3.2, 'F');
    font(true, 7); d.text('0 ; 0', ox - 1, oy - 7.2, { align: 'left' });
    // offcuts: hatched, crossed (waste), size written, dimensioned
    sh.offcuts.forEach((o) => {
      const x = ox + o.x * k, yy = oy + o.y * k, w = o.w * k, h = o.h * k;
      d.setLineWidth(0.12); d.setDrawColor(120); hatch(d, x, yy, w, h, 1.6);
      d.setDrawColor(0); d.setLineWidth(0.2); d.rect(x, yy, w, h);
      if (!o.keep && w > 3 && h > 3) { d.setLineWidth(0.3); d.line(x, yy, x + w, yy + h); d.line(x + w, yy, x, yy + h); }
      if (w > 18 && h > 9) {
        dimH(d, x + 1, x + w - 1, yy + 2.6, nf(o.w, 0));
        dimV(d, yy + 1, yy + h - 1, x + 2.6, nf(o.h, 0));
        font(true, 6.5); d.setFillColor(255, 255, 255);
        const t = `${o.keep ? s.pdf.keep : s.pdf.waste}`; const tw = d.getTextWidth(t) + 1.6;
        d.rect(x + w / 2 - tw / 2, yy + h / 2 - 2.2, tw, 3.4, 'F'); d.text(t, x + w / 2, yy + h / 2 + 0.4, { align: 'center' });
      } else if (w > 14 && h > 4) { font(false, 6); d.text(`${nf(o.w, 0)}×${nf(o.h, 0)}`, x + w / 2, yy + h / 2 + 1, { align: 'center' }); }
    });
    // pieces
    sh.items.forEach((p) => {
      const g = p.sliver ? 1 : p.band ? 0.96 : GREY[p.room] ?? 0.85;
      d.setFillColor(g * 255, g * 255, g * 255); d.setDrawColor(0); d.setLineWidth(0.25);
      p.polys.forEach((poly) => {
        const [a, ...rest] = poly;
        const segs = rest.map((q, i) => [(q[0] - (i ? rest[i - 1]![0] : a![0])) * k, (q[1] - (i ? rest[i - 1]![1] : a![1])) * k]);
        segs.push([(a![0] - poly[poly.length - 1]![0]) * k, (a![1] - poly[poly.length - 1]![1]) * k]);
        d.lines(segs, ox + a![0] * k, oy + a![1] * k, [1, 1], 'FD', true);
      });
      const px = ox + p.x * k, py = oy + p.y * k, pw = p.l * k, ph = p.w * k;
      d.setLineWidth(0.2);
      p.folds.forEach((f) => { d.setLineDashPattern([1.4, 0.9], 0); d.line(ox + f.x1 * k, oy + f.y1 * k, ox + f.x2 * k, oy + f.y2 * k); d.setLineDashPattern([], 0); });
      p.splits.forEach((f) => { d.setLineDashPattern([0.4, 0.9], 0); d.setLineWidth(0.45); d.line(ox + f.x1 * k, oy + f.y1 * k, ox + f.x2 * k, oy + f.y2 * k); d.setLineDashPattern([], 0); d.setLineWidth(0.2); });
      // the corner x ; y is measured to
      d.setLineWidth(0.3); d.line(px - 0.9, py - 0.9, px + 1.8, py - 0.9); d.line(px - 0.9, py - 0.9, px - 0.9, py + 1.8); d.setLineWidth(0.2);
      if (p.sliver) {
        // not a normal piece: crossed out, cut on site
        d.setLineWidth(0.35); d.line(px, py, px + pw, py + ph); d.line(px + pw, py, px, py + ph); d.setLineWidth(0.2);
        if (pw > 12) { font(true, 6); d.text(p.label, px + pw / 2, py - 1.6, { align: 'center' }); }
        return;
      }
      const cx = px + pw / 2, cy = py + ph / 2;
      const fs = Math.max(5, Math.min(9, ph * 0.7));
      font(true, fs);
      if (ph >= 3.2 && pw >= d.getTextWidth(p.label) + 1) d.text(p.label, cx, cy + fs * 0.12 + (ph > 14 ? 1.5 : 0), { align: 'center' });
      if (ph >= 4 && pw > 6) { d.setLineWidth(0.15); d.circle(px + 1.8, py + ph - 1.8, 0.9); d.circle(px + 1.8, py + ph - 1.8, 0.22, 'F'); }
      // tongue (P) and groove (W) on the piece edges: the tongue is drawn outside the edge, every profiled edge gets its letter
      if (!p.band) p.edges.forEach((e) => {
        const ts = Math.max(0.5, (R.tongue?.t ?? 0) * k), letter = e.kind === 'T' ? TG[0] : TG[1];
        const hz = e.side === 'top' || e.side === 'bottom';
        if (e.kind === 'T') {
          d.setFillColor(0, 0, 0);
          if (e.side === 'top') d.rect(px, py - ts, pw, ts, 'F'); else if (e.side === 'bottom') d.rect(px, py + ph, pw, ts, 'F');
          else if (e.side === 'left') d.rect(px - ts, py, ts, ph, 'F'); else d.rect(px + pw, py, ts, ph, 'F');
        }
        if ((hz ? pw : ph) < 8) return;
        font(true, 6.5);
        const tx = hz ? px + pw * 0.82 : e.side === 'left' ? px + 1.6 : px + pw - 1.6, ty = hz ? (e.side === 'top' ? py + 4.2 : py + ph - 1.2) : py + ph * 0.2 + 1.2;
        d.text(letter, tx, ty, { align: 'center' });
      });
      // dimension lines on every piece: length along the top, width along the left side, slant offsets at their corners
      if (ph >= 6.5 && pw >= 16) {
        dimH(d, px + 0.4, px + pw - 0.4, py + 2.6, nf(p.l));
        if (ph >= 11) dimV(d, py + 1, py + ph - 1, px + 2.6 + 4, nf(p.w));
        p.slants.filter((q) => q.full).forEach((q) => {
          font(false, 6);
          const left = q.x1 < p.l / 2;
          const al = left ? 'left' : 'right';
          d.text(nf(q.x1), px + q.x1 * k + (left ? 1 : -1), py + 6, { align: al });
          d.text(nf(q.x2), px + q.x2 * k + (q.x2 < p.l / 2 ? 1 : -1), py + ph - 1.2, { align: q.x2 < p.l / 2 ? 'left' : 'right' });
        });
      }
    });
    // guillotine cuts with kerf and order
    sh.cuts.forEach((c) => {
      const kw = Math.max(0.35, (st.kerfMm / 10) * k);
      d.setFillColor(0, 0, 0);
      if (c.orient === 'h') d.rect(ox + c.from * k, oy + c.pos * k, (c.to - c.from) * k, kw, 'F');
      else if (c.orient === 'v') d.rect(ox + c.pos * k, oy + c.from * k, kw, (c.to - c.from) * k, 'F');
      const nx = c.orient === 'h' ? ox + c.from * k - 2.2 : ox + c.pos * k, ny = c.orient === 'h' ? oy + c.pos * k : oy + c.from * k - 2.2;
      d.setFillColor(255, 255, 255); d.setLineWidth(0.2); d.circle(nx, ny, 1.7, 'FD'); font(true, 6); d.text(String(c.n), nx, ny + 0.8, { align: 'center' });
    });
    font(false, 7); d.setTextColor(90);
    const nyb = oy + R.PW * k;
    if (R.tongue) d.text(s.pdf.tgLegend, M, nyb + 13, { maxWidth: 270 });
    d.text(sh.cuts.length ? s.pdf.guillotineNote(st.kerfMm) : s.pdf.kerfNote(st.kerfMm), M, nyb + 5, { maxWidth: 240 });
    d.text(s.pdf.originNote, M, nyb + 9, { maxWidth: 270 });
    d.setTextColor(0);
    // the kerf at true width (1:1), so it can be compared with the gaps on the plate
    d.setFillColor(0, 0, 0); d.rect(PW_MM - M - 22, nyb + 2.4, Math.max(0.2, st.kerfMm), 3.4, 'F');
    font(false, 7); d.text(`= ${nf(st.kerfMm, 1)} mm (1:1)`, PW_MM - M - 22 + st.kerfMm + 1.5, nyb + 5);
    // table: the "on the wall" column only exists when an allowance changed a size on this plate
    const hasFit = sh.items.some((p) => p.fitL !== undefined || p.fitW !== undefined);
    const H = s.pdf.tableHead;
    const colDefs = [
      { h: H[0]!, x: M }, { h: H[1]!, x: M + 7 }, { h: H[2]!, x: M + 30 }, { h: H[3]!, x: M + 74 },
      ...(hasFit ? [{ h: H[4]!, x: M + 108 }] : []),
      { h: H[5]!, x: hasFit ? M + 140 : M + 108 }, { h: H[6]!, x: hasFit ? M + 170 : M + 140 },
    ];
    const cx = (i: number) => colDefs[i]!.x;
    const noteX = colDefs[colDefs.length - 1]!.x;
    let ty = nyb + 16;
    const head = () => { font(true, 8); colDefs.forEach((c) => d.text(c.h, c.x, ty)); d.setLineWidth(0.3); d.line(M, ty + 1.4, PW_MM - M, ty + 1.4); ty += 5.2; };
    head();
    sh.items.forEach((p) => {
      const lines = d.splitTextToSize(noteOf(p), PW_MM - M - noteX) as string[];
      const rh = Math.max(5, 3.4 * lines.length + 1.6);
      if (ty + rh > PH_MM - 10) { footer(page); d.addPage('a4', 'landscape'); ty = 18; font(true, 11); d.text(s.pdf.plateNo(sh.no, sheets.length) + ' ' + s.pdf.cont, M, 12); head(); }
      d.setLineWidth(0.25); if (p.sliver) { d.line(cx(0), ty - 3.2, cx(0) + 3.6, ty + 0.4); d.line(cx(0) + 3.6, ty - 3.2, cx(0), ty + 0.4); } else d.rect(cx(0), ty - 3.2, 3.6, 3.6);
      let ci = 1;
      font(true, 8.5); d.text(p.label, cx(ci++), ty);
      font(false, 8); d.text(p.band ? s.pdf.bandWord : `${roomNo(p.room) ? roomNo(p.room) + ' · ' : ''}${inp.roomName(p.room)} · ${p.fields}`, cx(ci++), ty, { maxWidth: 41 });
      font(true, 8.5); d.text(`${nf(p.l)} × ${nf(p.w)}`, cx(ci++), ty);
      font(false, 8);
      if (hasFit) { if (p.fitL !== undefined || p.fitW !== undefined) d.text(`${nf(p.fitL ?? p.l)} × ${nf(p.fitW ?? p.w)}`, cx(ci), ty); ci++; }
      d.text(`${nf(p.x)} ; ${nf(p.y)}`, cx(ci++), ty);
      d.text(lines, cx(ci), ty);
      d.setLineWidth(0.1); d.setDrawColor(150); d.line(M, ty + rh - 3.2, PW_MM - M, ty + rh - 3.2); d.setDrawColor(0);
      ty += rh;
    });
    footer(page);
  }

  /** plain cut instructions for the person at the saw, no coordinate tuples */
  function noteOf(p: SheetPiece): string {
    const n: string[] = [];
    if (p.sliver) n.push(s.pdf.sliverMark);
    if (p.fitL !== undefined || p.fitW !== undefined) n.push(s.pdf.allowanceNote);
    if (p.folds.length) n.push(s.pdf.foldNote);
    if (p.splits.length) n.push(s.pdf.splitNote);
    if (!p.sliver) {
      const full = p.slants.filter((q) => q.full);
      if (full.length) full.forEach((q) => n.push(s.pdf.slantFull(nf(q.x1), nf(q.x2))));
      else if (p.slants.length) p.slants.forEach((q) => n.push(s.pdf.slantLine(`${nf(q.x1)} ; ${nf(q.y1)}`, `${nf(q.x2)} ; ${nf(q.y2)}`)));
      else if (p.corners) n.push(s.pdf.shapeNote(p.corners.map((q) => `(${nf(q[0])} ; ${nf(q[1])})`).join(' ')));
    }
    return n.join(' · ');
  }

  doc.save((project.name.replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'slabs') + '-' + (inp.title.replace(/[^\p{L}\p{N}_-]+/gu, '-')) + '.pdf');
}

/** 45° hatch lines inside a rectangle (clipped by hand, no clip paths needed). */
function hatch(d: { line: (a: number, b: number, c: number, e: number) => void }, x: number, y: number, w: number, h: number, gap: number) {
  for (let t = gap; t < w + h; t += gap) {
    const x1 = Math.min(t, w), y1 = t - x1, y2 = Math.min(t, h), x2 = t - y2;
    d.line(x + x1, y + y1, x + x2, y + y2);
  }
}
