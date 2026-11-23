import { useRef, useState } from 'react';
import { asRect, type Opening } from '@slabs/core';
import type { MarkResult, StartHandle } from '@slabs/render';
import type { SplitId } from '@slabs/core';
import { dragVertex, moveSnapped } from './openingEdit';
import { nf, s } from '../i18n';
import { MeasureEntry } from './MeasureEntry';
import { Pan } from './Pan';

/** Candidate shifts where a plate joint lies exactly on a surface edge (the first or last field then has no sliver). */
export function edgeShifts(h: StartHandle, around: number): number[] {
  const out: number[] = [];
  for (const e of h.edges) {
    const k0 = Math.round((around + h.base - e) / h.pitch);
    for (let k = k0 - 1; k <= k0 + 1; k++) out.push(e + k * h.pitch - h.base);
  }
  return out;
}

/** Snap a shift: whole centimetres (Shift = free), and a magnet to edge alignments within 6 px. */
export function snapShift(h: StartHandle, raw: number, free: boolean): number {
  let v = free ? Math.round(raw * 10) / 10 : Math.round(raw);
  if (!free) {
    const near = edgeShifts(h, raw).filter((c) => Math.abs(c - raw) * h.perCm <= 6).sort((a, b) => Math.abs(a - raw) - Math.abs(b - raw))[0];
    if (near !== undefined) v = Math.round(near * 10) / 10;
  }
  return Math.max(-1000, Math.min(1000, v));
}

interface Props {
  html: string;
  drawing: MarkResult;
  onShift: (param: string, value: number) => void;
  onMeasure: (param: string, value: number) => void;
  /** fields of the room the user has emptied: their dimension is drawn dashed with "?" */
  empty: string[];
  nameOf: (param: string) => string;
  /** open the measurement panel at this field */
  onShowInPanel?: (param: string) => void;
  /** name of the surface, for the drag handle's accessible name */
  title: string;
  /** plain-words problem with a typed value for that input (with the reason), or null */
  validate: (param: string, value: number) => string | null;
  onEmpty: (param: string) => void;
  /** the zoom factor asked for by a pinch gesture */
  onPinch?: (factor: number) => void;
  ops?: OpeningEditing;
  sheet?: SheetEditing;
}

/** What a click on the roof sheet does: split / join a fold line of a strip, add / move / remove a cross-cut. */
export interface SheetEditing {
  onToggle: (strip: number, id: SplitId, on: boolean) => void;
  onAddCut: (strip: number, u: number) => void;
  onMoveCut: (strip: number, from: number, to: number) => void;
  onRemoveCut: (strip: number, u: number) => void;
  /** keyboard: add a cross-cut in the middle of the longest piece */
  onKeyAddCut: (strip: number) => void;
}

interface CDrag { strip: number; u0: number; cur: number; sx: number; live: boolean; moved: boolean }

/** Openings of the drawn surface and what to do with them. */
export interface OpeningEditing {
  openings: Opening[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, pts: Array<[number, number]>) => void;
  onRemove: (id: string) => void;
  kindName: (k: string) => string;
}

interface ODrag { id: string; mode: 'move' | number; sx: number; sy: number; pts0: Array<[number, number]>; live: boolean }

const HOLD_MS = 280;

/** The surface drawing with a draggable start point and measurements that can be typed on the drawing. */
export function SurfaceEditor({ html, drawing, onShift, onMeasure, empty, nameOf, onShowInPanel, title, validate, onEmpty, onPinch, ops, sheet }: Props) {
  const h = drawing.start;
  const [drag, setDrag] = useState<{ startX: number; startY: number; startVal: number; live: boolean } | null>(null);
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const [editing, setEditing] = useState<number | null>(null);
  const measures = drawing.measures ?? [];
  const map = drawing.map;
  const [od, setOd] = useState<ODrag | null>(null);
  const oHold = useRef<ReturnType<typeof setTimeout>>();
  const [cd, setCd] = useState<CDrag | null>(null);
  const cHold = useRef<ReturnType<typeof setTimeout>>();
  const hits = drawing.sheet;
  const uFromEvent = (e: { clientX: number; currentTarget: Element }) => {
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    const r = svg?.getBoundingClientRect();
    return hits && r ? Math.round(hits.uAt(e.clientX - r.left)) : 0;
  };
  // a cross-cut: mouse drags at once, touch needs a short hold (so scrolling stays easy); a click without moving removes it
  const cBegin = (e: React.PointerEvent, strip: number, u: number) => {
    e.stopPropagation();
    const el = e.currentTarget as Element;
    const st: CDrag = { strip, u0: u, cur: u, sx: e.clientX, live: false, moved: false };
    setCd(st);
    if (e.pointerType === 'mouse') { el.setPointerCapture(e.pointerId); setCd({ ...st, live: true }); }
    else {
      const pid = e.pointerId;
      cHold.current = setTimeout(() => { try { el.setPointerCapture(pid); } catch { /* ignore */ } navigator.vibrate?.(15); setCd((d) => (d ? { ...d, live: true } : d)); }, HOLD_MS);
    }
  };
  const cMove = (e: React.PointerEvent) => {
    if (!cd || !hits || !sheet) return;
    const dx = e.clientX - cd.sx;
    if (!cd.live) { if (Math.abs(dx) > 8) { clearTimeout(cHold.current); setCd(null); } return; }
    if (Math.abs(dx) < 3 && !cd.moved) return;
    e.preventDefault();
    const u = uFromEvent(e);
    if (u !== cd.cur) { sheet.onMoveCut(cd.strip, cd.cur, u); setCd({ ...cd, cur: u, moved: true }); }
  };
  const cEnd = (e: React.PointerEvent) => {
    clearTimeout(cHold.current);
    // a click (no drag) on a cross-cut removes it; automatic cuts are only moved
    if (cd && !cd.moved && e.type === 'pointerup' && sheet && !(hits?.cuts.find((c) => c.strip === cd.strip && Math.abs(c.u - cd.u0) < 0.5)?.auto)) sheet.onRemoveCut(cd.strip, cd.u0);
    setCd(null);
  };
  const cKey = (e: React.KeyboardEvent, strip: number, u: number, auto: boolean) => {
    if (!sheet) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && !auto) { e.preventDefault(); sheet.onRemoveCut(strip, u); return; }
    const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    sheet.onMoveCut(strip, u, u + d * (e.shiftKey ? 10 : 1));
  };

  const oBegin = (e: React.PointerEvent, op: Opening, mode: 'move' | number) => {
    if (!ops) return;
    e.stopPropagation();
    ops.onSelect(op.id);
    const el = e.currentTarget as Element;
    const st: ODrag = { id: op.id, mode, sx: e.clientX, sy: e.clientY, pts0: op.pts.map((q): [number, number] => [q[0], q[1]]), live: false };
    setOd(st);
    if (e.pointerType === 'mouse') { el.setPointerCapture(e.pointerId); setOd({ ...st, live: true }); }
    else {
      const pid = e.pointerId;
      oHold.current = setTimeout(() => { try { el.setPointerCapture(pid); } catch { /* ignore */ } navigator.vibrate?.(15); setOd((d) => (d ? { ...d, live: true } : d)); }, HOLD_MS);
    }
  };
  const oMove = (e: React.PointerEvent) => {
    if (!od || !map || !ops) return;
    const dx = e.clientX - od.sx, dy = e.clientY - od.sy;
    if (!od.live) { if (Math.hypot(dx, dy) > 8) { clearTimeout(oHold.current); setOd(null); } return; }
    e.preventDefault();
    const others = ops.openings.filter((o) => o.id !== od.id);
    if (od.mode === 'move') {
      const p0 = map.toCm(0, 0), p1 = map.toCm(dx, dy);
      ops.onChange(od.id, moveSnapped(od.pts0, p1[0] - p0[0], p1[1] - p0[1], map, others, e.shiftKey));
    } else {
      const v = map.toPx(od.pts0[od.mode]![0], od.pts0[od.mode]![1]);
      const c = map.toCm(v[0] + dx, v[1] + dy);
      ops.onChange(od.id, dragVertex(od.pts0, od.mode, c[0], c[1], map, e.shiftKey));
    }
  };
  const oEnd = () => { clearTimeout(oHold.current); setOd(null); };
  const oKey = (e: React.KeyboardEvent, op: Opening, vertex: number | null) => {
    if (!ops || !map) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (vertex === null) ops.onRemove(op.id);
      else if (op.pts.length > 3 && !asRect(op.pts)) ops.onChange(op.id, op.pts.filter((_q, i) => i !== vertex).map((q): [number, number] => [q[0], q[1]]));
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    // on the drawing "up" is smaller y; for gable walls the second coordinate (height) grows upwards
    const up = map.toCm(0, -1)[1] - map.toCm(0, 0)[1];
    const d = e.key === 'ArrowLeft' ? [-step, 0] : e.key === 'ArrowRight' ? [step, 0] : e.key === 'ArrowUp' ? [0, up * step] : e.key === 'ArrowDown' ? [0, -up * step] : null;
    if (!d) return;
    e.preventDefault();
    const pts = op.pts.map((q): [number, number] => [q[0], q[1]]);
    if (vertex === null) ops.onChange(op.id, moveSnapped(pts, d[0]!, d[1]!, map, [], true));
    else ops.onChange(op.id, dragVertex(pts, vertex, pts[vertex]![0] + d[0]!, pts[vertex]![1] + d[1]!, map, true));
  };

  const begin = (e: React.PointerEvent) => {
    if (!h) return;
    const el = e.currentTarget as Element;
    const st = { startX: e.clientX, startY: e.clientY, startVal: h.value, live: false };
    setDrag(st);
    if (e.pointerType === 'mouse') { el.setPointerCapture(e.pointerId); setDrag({ ...st, live: true }); }
    else {
      // touch and pen: a short hold starts the drag, so scrolling and pinching stay easy
      const pid = e.pointerId;
      holdTimer.current = setTimeout(() => { try { el.setPointerCapture(pid); } catch { /* ignore */ } setHolding(true); setDrag((d) => (d ? { ...d, live: true } : d)); navigator.vibrate?.(15); }, HOLD_MS);
    }
  };
  const move = (e: React.PointerEvent) => {
    if (!h || !drag) return;
    const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    if (!drag.live) { if (Math.hypot(dx, dy) > 8) { clearTimeout(holdTimer.current); setDrag(null); } return; }
    e.preventDefault();
    const d = (h.axis === 'y' ? dy : dx) * (h.flip ? -1 : 1);
    onShift(h.param, snapShift(h, drag.startVal + d / h.perCm, e.shiftKey));
  };
  const end = () => { clearTimeout(holdTimer.current); setDrag(null); setHolding(false); };
  const key = (e: React.KeyboardEvent) => {
    if (!h) return;
    const step = e.shiftKey ? 10 : 1;
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
    if (!dir) return;
    e.preventDefault();
    onShift(h.param, Math.max(-1000, Math.min(1000, h.value + dir * step)));
  };

  const live = drag?.live ?? false;
  const firstLast = h ? s.room.firstLast(nf(h.firstW, 1), nf(h.lastW, 1)) : '';
  return (
    <Pan html={html} size={{ w: drawing.w, h: drawing.h }} onPinch={onPinch}>
      <svg className="overlay" width={drawing.w} height={drawing.h} viewBox={`0 0 ${Math.round(drawing.w)} ${Math.round(drawing.h)}`} aria-label={s.room.editLayer}>
        {hits && sheet && hits.strips.map((st) => st.cells.map((c, ci) => (
          <rect key={`${st.strip}.${ci}`} x={c.x0} y={c.y0} width={Math.max(0, c.x1 - c.x0)} height={Math.max(0, c.y1 - c.y0)} className="sp-strip"
            {...(ci === 0 ? { tabIndex: 0, role: 'button', 'aria-label': s.sheet.addCutAria(st.stripId) } : {})}
            onClick={(e) => { const u = uFromEvent(e); sheet.onAddCut(st.strip, u); }}
            onKeyDown={ci === 0 ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sheet.onKeyAddCut(st.strip); } } : undefined} />
        )))}
        {hits && sheet && hits.lines.map((ln) => (
          <g key={`${ln.strip}.${ln.id}`} className="sp-seg" tabIndex={0} role="switch" aria-checked={ln.on} aria-label={s.sheet.lineAria(ln.stripId, ln.label, ln.on)}
            onClick={() => sheet.onToggle(ln.strip, ln.id, !ln.on)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sheet.onToggle(ln.strip, ln.id, !ln.on); } }}>
            {ln.segs.map((sg, i) => <rect key={i} x={sg.x - 12} y={sg.y1} width={24} height={Math.max(0, sg.y2 - sg.y1)} className="sp-hit" />)}
          </g>
        ))}
        {hits && sheet && hits.cuts.map((c, ci, all) => (
          // the key does not contain the position: a cross-cut that is moved stays the same element (keeps focus and the pointer capture)
          <g key={`${c.strip}.${c.y1}.${all.slice(0, ci).filter((q) => q.strip === c.strip && q.y1 === c.y1).length}`} className={'sp-cut' + (cd?.live && cd.strip === c.strip ? ' live' : '')} tabIndex={0} role="slider" aria-label={s.sheet.cutAria(c.stripId, c.auto)} aria-valuenow={Math.round(c.u)} aria-valuetext={s.sheet.cutValue(nf(Math.abs(c.u), 0), c.u < 0)}
            onPointerDown={(e) => cBegin(e, c.strip, c.u)} onPointerMove={cMove} onPointerUp={cEnd} onPointerCancel={cEnd} onKeyDown={(e) => cKey(e, c.strip, c.u, c.auto)}>
            <rect x={c.x - 12} y={c.y1} width={24} height={Math.max(0, c.y2 - c.y1)} className="sp-hit" />
          </g>
        ))}
        {measures.map((m, i) => {
          const missing = empty.includes(m.param);
          const cx = (m.x1 + m.x2) / 2, cy = (m.y1 + m.y2) / 2;
          return (
            <g key={i} className={'meas' + (missing ? ' missing' : '')} tabIndex={0} role="button" aria-label={s.room.measureLabel(nameOf(m.param), m.label)}
              onClick={() => setEditing(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(i); } }}>
              <rect x={Math.min(m.x1, m.x2) - 4} y={Math.min(m.y1, m.y2) - 22} width={Math.abs(m.x2 - m.x1) + 8} height={Math.abs(m.y2 - m.y1) + 44} className="meas-hit" />
              {missing && <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} className="meas-dash" />}
              {missing && <text x={cx} y={cy - 8} textAnchor="middle" className="meas-q">?</text>}
            </g>
          );
        })}
        {ops && map && ops.openings.map((op) => {
          const q = op.pts.map((v) => map.toPx(v[0], v[1]));
          const sel = ops.selected === op.id;
          const nm = ops.kindName(op.kind);
          const live = od?.id === op.id && od.live;
          return (
            <g key={op.id} className={'opening' + (sel ? ' sel' : '') + (live ? ' live' : '')}>
              <polygon points={q.map((v) => v.join(',')).join(' ')} className="op-body" tabIndex={0} role="button" aria-label={s.openings.handleMove(nm)} aria-pressed={sel}
                onPointerDown={(e) => oBegin(e, op, 'move')} onPointerMove={oMove} onPointerUp={oEnd} onPointerCancel={oEnd} onKeyDown={(e) => oKey(e, op, null)} onFocus={() => ops.onSelect(op.id)} />
              {sel && q.map((v, i) => (
                <g key={i} className="op-vertex" tabIndex={0} role="slider" aria-label={s.openings.handleVertex(nm, i + 1)} aria-valuenow={0} aria-valuetext={`${nf(op.pts[i]![0], 1)} ; ${nf(op.pts[i]![1], 1)}`}
                  onPointerDown={(e) => oBegin(e, op, i)} onPointerMove={oMove} onPointerUp={oEnd} onPointerCancel={oEnd} onKeyDown={(e) => oKey(e, op, i)}>
                  <circle cx={v[0]} cy={v[1]} r={24} className="handle-hit" />
                  <circle cx={v[0]} cy={v[1]} r={21} className="handle-ring" />
                  <circle cx={v[0]} cy={v[1]} r={7} className="handle-dot" />
                </g>
              ))}
            </g>
          );
        })}
        {h && (
          <g className={'handle' + (live ? ' live' : '') + (holding ? ' hold' : '')} role="slider" tabIndex={0} aria-label={s.room.handleName(h.ref, title)}
            aria-valuemin={-1000} aria-valuemax={1000} aria-valuenow={h.value} aria-valuetext={`${nf(h.value, 1)} cm`}
            onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={key}>
            <circle cx={h.x} cy={h.y} r={24} className="handle-hit" />
            <circle cx={h.x} cy={h.y} r={21} className="handle-ring" />
            <circle cx={h.x} cy={h.y} r={holding ? 14 : 9} className="handle-dot" />
          </g>
        )}
        {h && live && (
          <g className="readout" pointerEvents="none">
            <rect x={Math.min(h.x + 16, drawing.w - 210)} y={Math.max(h.y - 52, 4)} width={200} height={44} rx={3} />
            <text x={Math.min(h.x + 24, drawing.w - 202)} y={Math.max(h.y - 52, 4) + 18}>{h.ref} {h.value > 0 ? '+' : ''}{nf(h.value, 1)} cm</text>
            <text x={Math.min(h.x + 24, drawing.w - 202)} y={Math.max(h.y - 52, 4) + 36}>{firstLast}</text>
          </g>
        )}
      </svg>
      {editing !== null && measures[editing] && (() => {
        const m = measures[editing]!;
        const cx = (m.x1 + m.x2) / 2, cy = (m.y1 + m.y2) / 2;
        return (
          <MeasureEntry key={editing} name={nameOf(m.param)} value={m.value} validate={(v) => validate(m.param, v)}
            style={{ left: Math.max(4, cx - 60), top: Math.max(4, cy + 6) }}
            onSave={(v) => onMeasure(m.param, v)} onEmpty={() => onEmpty(m.param)} onMore={onShowInPanel ? () => onShowInPanel(m.param) : undefined}
            onDone={(next) => setEditing(next && editing + 1 < measures.length ? editing + 1 : null)} />
        );
      })()}
    </Pan>
  );
}
