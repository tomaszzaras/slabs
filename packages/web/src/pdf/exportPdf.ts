import type { CutResult } from '@slabs/core';
import { cutSheets, type SheetPiece, type SheetPlate } from '@slabs/render';
import type { Strings } from '../i18n/pl';
import type { Project } from '../state/project';

export interface PdfInput {
  R: CutResult;
  project: Project;
  s: Strings;
  lang: string;
  /** "Shared cut" or the room name */
  title: string;
  roomName: (key: string) => string;
}

const M = 10, PW_MM = 297, PH_MM = 210;
const GREY: Record<string, number> = { S: 0.92, Sy: 0.82, 'Ł1': 0.72, 'Ł2': 0.62 };

async function b64(url: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Largest nice scale (1:n) at which the plate fits the page width. */
export const sheetScale = (PLcm: number): number => [10, 12.5, 15, 20, 25, 30, 40].find((n) => (PLcm * 10) / n <= PW_MM - 2 * M) ?? 50;

/** Vector PDF: cover page + one A4 landscape sheet per plate, black-and-white readable. */
export async function exportPdf(inp: PdfInput): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { R, project, s } = inp;
  const sheets = cutSheets(R, project.settings.minOffcutCm, s.pdf.bandWord);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const base = import.meta.env.BASE_URL ?? './';
  for (const [file, style] of [['Barlow-Regular.ttf', 'normal'], ['Barlow-Bold.ttf', 'bold']] as const) {
    doc.addFileToVFS(file, await b64(`${base}fonts/pdf/${file}`));
    doc.addFont(file, 'Barlow', style);
  }
  const font = (bold = false, size = 9) => { doc.setFont('Barlow', bold ? 'bold' : 'normal'); doc.setFontSize(size); };
  const nf = (v: number, d = 1) => new Intl.NumberFormat(inp.lang, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  const total = sheets.length + 1;
  const footer = (page: number) => { font(false, 7); doc.setTextColor(90); doc.text(`Slabs · ${project.name} · ${s.pdf.page(page, total)}`, M, PH_MM - 5); doc.setTextColor(0); };

  // ---- cover page
  font(true, 22); doc.text(project.name, M, 22);
  font(false, 12); doc.text(`${s.pdf.cover} · ${inp.title}`, M, 30);
  font(false, 9); doc.text(new Date().toLocaleDateString(inp.lang), PW_MM - M, 22, { align: 'right' });
  const st = project.settings;
  const al = st.allowances;
  const facts: Array<[string, string]> = [
    [s.pdf.plates, String(R.plates.length)],
    [s.pdf.plateSize, `${R.PL} × ${R.PW} cm`],
    [s.pdf.area, `${nf(R.stats.grossM2)} m²`],
    [s.pdf.cost, `${nf(R.stats.cost, 0)} zł (${nf(project.shared.price)} zł/m²)`],
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
  const bandPieces = sheets.flatMap((sh) => sh.items.filter((p) => p.band).map((p) => `${sh.no}: ${nf(p.l, 0)}×${nf(p.w, 0)}`));
  if (bandPieces.length) { font(false, 8); doc.text(`${s.pdf.bandList}: ${bandPieces.join(' · ')}`, M, Math.max(y + 8, 160), { maxWidth: 130 }); }
  font(false, 8); doc.setTextColor(90); doc.text(s.pdf.starNote, M, 190, { maxWidth: 270 }); doc.setTextColor(0);
  footer(1);

  // ---- one sheet per plate
  const scale = sheetScale(R.PL);
  const k = 10 / scale; // mm on paper per cm on the plate
  sheets.forEach((sh, idx) => {
    doc.addPage('a4', 'landscape');
    drawPlate(doc, sh, idx + 2);
  });

  function drawPlate(d: InstanceType<typeof jsPDF>, sh: SheetPlate, page: number) {
    const ox = M, oy = 34;
    font(true, 15); d.text(s.pdf.plateNo(sh.no, sheets.length), M, 16);
    font(false, 10);
    d.text(`${R.PL} × ${R.PW} cm · ${s.pdf.useWord} ${Math.round(sh.use * 100)}% · ${s.pdf.scale} 1:${scale}${sh.extra ? ' · ' + s.pdf.extraPlate : ''}`, M, 23);
    // grain and face
    d.setLineWidth(0.3); d.line(PW_MM - M - 50, 16, PW_MM - M - 8, 16); d.triangle(PW_MM - M - 8, 16, PW_MM - M - 12, 14.5, PW_MM - M - 12, 17.5, 'F');
    font(false, 8); d.text(s.pdf.grain, PW_MM - M - 50, 13);
    d.setLineWidth(0.25); d.circle(PW_MM - M - 50, 21.5, 1.6); d.circle(PW_MM - M - 50, 21.5, 0.4, 'F'); d.text(s.pdf.face, PW_MM - M - 46, 22.4);
    // plate
    d.setLineWidth(0.5); d.setDrawColor(0); d.rect(ox, oy, R.PL * k, R.PW * k);
    font(false, 7); d.text(`${R.PL} cm`, ox + (R.PL * k) / 2, oy - 2, { align: 'center' }); d.text(`${R.PW} cm`, ox - 2, oy + (R.PW * k) / 2, { align: 'center', angle: 90 });
    // offcuts: hatched, crossed (waste), size written
    sh.offcuts.forEach((o) => {
      const x = ox + o.x * k, yy = oy + o.y * k, w = o.w * k, h = o.h * k;
      d.setLineWidth(0.12); d.setDrawColor(120); hatch(d, x, yy, w, h, 1.6);
      d.setDrawColor(0); d.setLineWidth(0.2); d.rect(x, yy, w, h);
      if (w > 14 && h > 4) { font(false, 6); d.text(`${nf(o.w, 0)}×${nf(o.h, 0)} ${o.keep ? s.pdf.keep : s.pdf.waste}`, x + w / 2, yy + h / 2 + 1, { align: 'center' }); }
    });
    // pieces
    sh.items.forEach((p) => {
      const g = p.band ? 0.96 : GREY[p.room] ?? 0.85;
      d.setFillColor(g * 255, g * 255, g * 255); d.setDrawColor(0); d.setLineWidth(0.25);
      p.polys.forEach((poly) => {
        const [a, ...rest] = poly;
        const segs = rest.map((q, i) => [(q[0] - (i ? rest[i - 1]![0] : a![0])) * k, (q[1] - (i ? rest[i - 1]![1] : a![1])) * k]);
        segs.push([(a![0] - poly[poly.length - 1]![0]) * k, (a![1] - poly[poly.length - 1]![1]) * k]);
        d.lines(segs, ox + a![0] * k, oy + a![1] * k, [1, 1], 'FD', true);
      });
      d.setLineWidth(0.2);
      p.folds.forEach((f) => { d.setLineDashPattern([1.4, 0.9], 0); d.line(ox + f.x1 * k, oy + f.y1 * k, ox + f.x2 * k, oy + f.y2 * k); d.setLineDashPattern([], 0); });
      p.splits.forEach((f) => { d.setLineDashPattern([0.4, 0.9], 0); d.setLineWidth(0.45); d.line(ox + f.x1 * k, oy + f.y1 * k, ox + f.x2 * k, oy + f.y2 * k); d.setLineDashPattern([], 0); d.setLineWidth(0.2); });
      const cx = ox + (p.x + p.l / 2) * k, cy = oy + (p.y + p.w / 2) * k;
      const fs = Math.max(5, Math.min(9, p.w * k * 0.7));
      font(true, fs);
      if (p.w * k >= 3.2 && p.l * k >= d.getTextWidth(p.label) + 1) d.text(p.label, cx, cy + fs * 0.12, { align: 'center' });
      if (p.w * k >= 4 && p.l * k > 6) { d.setLineWidth(0.15); d.circle(ox + p.x * k + 1.8, oy + p.y * k + 1.8, 0.9); d.circle(ox + p.x * k + 1.8, oy + p.y * k + 1.8, 0.22, 'F'); }
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
    d.text(sh.cuts.length ? s.pdf.guillotineNote(st.kerfMm) : s.pdf.kerfNote(st.kerfMm), M, oy + R.PW * k + 5);
    d.setTextColor(0);
    // the kerf at true width (1:1), so it can be compared with the gaps on the plate
    d.setFillColor(0, 0, 0); d.rect(PW_MM - M - 22, oy + R.PW * k + 2.4, Math.max(0.2, st.kerfMm), 3.4, 'F');
    font(false, 7); d.text(`= ${nf(st.kerfMm, 1)} mm (1:1)`, PW_MM - M - 22 + st.kerfMm + 1.5, oy + R.PW * k + 5);
    // table
    let ty = oy + R.PW * k + 11;
    const cols = [M, M + 7, M + 30, M + 78, M + 118, M + 152, M + 178];
    const head = () => { font(true, 8); s.pdf.tableHead.forEach((h, i) => d.text(h, cols[i]!, ty)); d.setLineWidth(0.3); d.line(M, ty + 1.4, PW_MM - M, ty + 1.4); ty += 5.2; };
    head();
    sh.items.forEach((p) => {
      const note = noteOf(p);
      const lines = d.splitTextToSize(note, PW_MM - M - cols[6]!) as string[];
      const rh = Math.max(5, 3.6 * lines.length + 1.4);
      if (ty + rh > PH_MM - 10) { footer(page); d.addPage('a4', 'landscape'); ty = 18; font(true, 11); d.text(s.pdf.plateNo(sh.no, sheets.length) + ' ' + s.pdf.cont, M, 12); head(); }
      d.setLineWidth(0.25); d.rect(cols[0]!, ty - 3.2, 3.6, 3.6);
      font(true, 8.5); d.text(p.label, cols[1]!, ty);
      font(false, 8); d.text(`${inp.roomName(p.room)}${p.band ? '' : ' · ' + p.fields}`, cols[2]!, ty, { maxWidth: 45 });
      font(true, 8.5); d.text(`${nf(p.l)} × ${nf(p.w)}`, cols[3]!, ty);
      font(false, 8); d.text(p.fitL !== undefined || p.fitW !== undefined ? `${nf(p.fitL ?? p.l)} × ${nf(p.fitW ?? p.w)}` : '=', cols[4]!, ty);
      d.text(`${nf(p.x)} ; ${nf(p.y)}`, cols[5]!, ty);
      d.text(lines, cols[6]!, ty);
      d.setLineWidth(0.1); d.setDrawColor(150); d.line(M, ty + rh - 3.2, PW_MM - M, ty + rh - 3.2); d.setDrawColor(0);
      ty += rh;
    });
    footer(page);
  }

  function noteOf(p: SheetPiece): string {
    const n: string[] = [];
    if (p.fitL !== undefined || p.fitW !== undefined) n.push(s.pdf.allowanceNote);
    if (p.folds.length) n.push(s.pdf.foldNote);
    if (p.splits.length) n.push(s.pdf.splitNote);
    if (p.corners) n.push(p.corners.map((q) => `(${nf(q[0])};${nf(q[1])})`).join(' '));
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
