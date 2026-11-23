import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MoveHorizontal } from 'lucide-react';
import { faceMarks } from '@slabs/render';
import { drawingLabels, nf, s } from '@/i18n';
import { useLang } from '@/i18n/useLang';
import { Button } from '@/components/ui/button';
import { PITCH, SAMPLE_W, sampleWall, wrapShift } from './sample';

const START0 = 47;
/** the start where a plate joint lies on the left wall: the fewest plates, no sliver */
const BEST = sampleWall(0).plates;

/** Whole centimetres, with a magnet to the start where a joint lies on the wall (within 8 px). */
function snap(v: number, perCm: number): number {
  const k = Math.round(v / PITCH);
  return Math.abs(v - k * PITCH) * perCm <= 8 ? k * PITCH : Math.round(v);
}

/**
 * The live sample wall: one roof slope drawn by the app's own renderer, cut by the app's own engine. Drag the start point R (or the
 * wall itself, or use the arrow keys / buttons): the joints move and the plate count and waste are recalculated. Nothing is saved.
 */
export function LiveWall() {
  useLang();
  const frame = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(0);
  const [shift, setShift] = useState(START0);
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);
  const [announce, setAnnounce] = useState('');
  const drag = useRef<{ x: number; from: number; perCm: number } | null>(null);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCw(el.clientWidth));
    ro.observe(el);
    setCw(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => sampleWall(shift), [shift]);
  const drawing = useMemo(() => {
    if (!cw) return null;
    const opts = { minStrip: 10, plateLen: 499, nf: (v: number) => nf(Math.round(v * 10) / 10, Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1), labels: drawingLabels };
    const pads = faceMarks(data.face, 'S', { ...opts, scale: 1 }).w - SAMPLE_W;
    const scale = Math.max(0.25, Math.min(1.6, (cw - pads) / SAMPLE_W));
    return faceMarks(data.face, 'S', { ...opts, scale }, { shift: wrapShift(shift), pitch: PITCH });
  }, [data, cw, shift]);

  const set = (v: number, say = true) => {
    setTouched(true);
    setShift(v);
    if (say) { const r = sampleWall(v); setAnnounce(s.landing.wall.announce(`${r.plates} ${s.bar.plates(r.plates)}`, s.bar.waste(Math.round(r.waste * 100)))); }
  };
  const cm = Math.round(wrapShift(shift));
  const pct = Math.round(data.waste * 100);
  const h = drawing?.start;
  const note = data.slivers > 0 ? s.landing.wall.sliver : data.plates === BEST ? s.landing.wall.best : s.landing.wall.more(data.plates - BEST);

  return (
    <figure className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:p-4" aria-label={s.landing.wall.title}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-semibold">{s.landing.wall.title}</span>
        <span className="text-muted-foreground">{s.landing.wall.note}</span>
      </figcaption>
      <div
        ref={frame}
        data-live-wall
        className={`relative select-none overflow-hidden rounded-lg border bg-background [touch-action:pan-y] ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ height: drawing?.h ?? 260 }}
        onPointerDown={(e) => {
          if (!h || e.button > 0) return;
          drag.current = { x: e.clientX, from: shift, perCm: h.perCm };
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) set(snap(d.from + (e.clientX - d.x) / d.perCm, d.perCm), false);
        }}
        onPointerUp={() => { if (drag.current) { drag.current = null; setDragging(false); set(shift); } }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
      >
        {drawing && (
          <svg data-wall-svg width={drawing.w} height={drawing.h} viewBox={`0 0 ${drawing.w} ${drawing.h}`} role="img" aria-label={s.landing.wall.aria} className="block max-w-none" dangerouslySetInnerHTML={{ __html: drawing.svg }} />
        )}
        {h && (
          <div
            role="slider" tabIndex={0} data-a="wall-handle"
            aria-label={s.landing.wall.handle} aria-valuemin={0} aria-valuemax={PITCH - 1} aria-valuenow={cm} aria-valuetext={s.landing.wall.handleValue(cm)}
            className={`absolute grid size-11 -translate-x-1/2 place-items-center rounded-full border-2 border-primary bg-card text-primary shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${touched ? '' : 'hand-hint'}`}
            style={{ left: h.x, top: h.y + 26 }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 10 : 1;
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(Math.round(shift) + step); }
              else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(Math.round(shift) - step); }
              else if (e.key === 'PageUp') { e.preventDefault(); set(Math.round(shift) + 10); }
              else if (e.key === 'PageDown') { e.preventDefault(); set(Math.round(shift) - 10); }
              else if (e.key === 'Home') { e.preventDefault(); set(0); }
              else if (e.key === 'End') { e.preventDefault(); set(PITCH - 1); }
            }}
          >
            <MoveHorizontal className="size-5" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <dl className="flex items-end gap-8" data-live-figures>
          <div>
            <dd className="text-[clamp(2.5rem,6vw,3.5rem)] font-semibold leading-none tracking-tight" data-fig="plates">{data.plates}</dd>
            <dt className="mt-1 text-sm text-muted-foreground">{s.bar.plates(data.plates)}</dt>
          </div>
          <div>
            <dd className="text-[clamp(2.5rem,6vw,3.5rem)] font-semibold leading-none tracking-tight" data-fig="waste">{pct}%</dd>
            <dt className="mt-1 text-sm text-muted-foreground">{s.landing.wall.wasteLabel}</dt>
          </div>
        </dl>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label={s.landing.wall.left} data-a="wall-left" onClick={() => set(Math.round(shift) - 5)}><ChevronLeft /></Button>
          <span className="min-w-20 text-center text-sm tabular-nums" data-a="wall-start">{s.landing.wall.start(cm)}</span>
          <Button variant="outline" size="icon" aria-label={s.landing.wall.right} data-a="wall-right" onClick={() => set(Math.round(shift) + 5)}><ChevronRight /></Button>
        </div>
      </div>
      <p className="max-w-[60ch] text-sm leading-snug" data-a="wall-note">{note}</p>
      <p className="max-w-[60ch] text-[13px] leading-snug text-muted-foreground">{s.landing.wall.hint}</p>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
    </figure>
  );
}
