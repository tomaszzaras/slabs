import { useRef, useState } from 'react';
import type { MarkResult, StartHandle } from '@slabs/render';
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
  /** name of the surface, for the drag handle's accessible name */
  title: string;
  /** plain-words problem with a typed value for that input (with the reason), or null */
  validate: (param: string, value: number) => string | null;
  onEmpty: (param: string) => void;
  /** the zoom factor asked for by a pinch gesture */
  onPinch?: (factor: number) => void;
}

const HOLD_MS = 280;

/** The surface drawing with a draggable start point and measurements that can be typed on the drawing. */
export function SurfaceEditor({ html, drawing, onShift, onMeasure, empty, nameOf, title, validate, onEmpty, onPinch }: Props) {
  const h = drawing.start;
  const [drag, setDrag] = useState<{ startX: number; startY: number; startVal: number; live: boolean } | null>(null);
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const [editing, setEditing] = useState<number | null>(null);
  const measures = drawing.measures ?? [];

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
    const d = h.axis === 'y' ? dy : dx;
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
            onSave={(v) => onMeasure(m.param, v)} onEmpty={() => onEmpty(m.param)}
            onDone={(next) => setEditing(next && editing + 1 < measures.length ? editing + 1 : null)} />
        );
      })()}
    </Pan>
  );
}
