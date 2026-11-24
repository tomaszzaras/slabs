import { useEffect, useRef, useState } from 'react';
import { bbox, edgesOf, setWallLength, type Outline } from '@slabs/core';
import { nf, s } from '../i18n';
import { cn } from '@/lib/utils';

const SIZE = 340, PAD = 44;

/**
 * The floor plan with the length of every wall on the drawing: click a length, type a number, the shape is redrawn (angles stay 90 degrees).
 * The lengths are real buttons / inputs placed over the drawing, so they work with keyboard and touch.
 */
export function OutlineEditor({ outline, onChange }: { outline: Outline; onChange: (o: Outline) => void }) {
  const [active, setActive] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [bad, setBad] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const b = bbox(outline);
  const k = Math.min((SIZE - 2 * PAD) / Math.max(b.w, 1), (SIZE - 2 * PAD) / Math.max(b.l, 1));
  const X = (x: number) => PAD + (x - b.x0) * k, Y = (y: number) => SIZE - PAD - (y - b.y0) * k; // y up
  const es = edgesOf(outline);
  useEffect(() => { if (active !== null) input.current?.select(); }, [active]);
  const commit = () => {
    if (active === null) return;
    const v = Number(text.replace(',', '.'));
    const next = setWallLength(outline, active, v);
    if (!next) { setBad(true); return; }
    setBad(false);
    setActive(null);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2" data-outline-editor>
      <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-label={s.spec.plan} className="text-foreground">
          <polygon points={outline.map((q) => `${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join(' ')} style={{ fill: 'var(--r0)' }} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        {es.map((e) => {
          const mx = (X(e.a[0]) + X(e.b[0])) / 2, my = (Y(e.a[1]) + Y(e.b[1])) / 2;
          // the label sits outside the wall: away from the polygon's centre
          const cx = X((b.x0 + b.x1) / 2), cy = Y((b.y0 + b.y1) / 2);
          const nx = e.d[1] !== 0 ? Math.sign(mx - cx) || 1 : 0, ny = e.d[0] !== 0 ? Math.sign(my - cy) || 1 : 0;
          const left = mx + nx * 26, top = my + ny * 18;
          const on = active === e.i;
          return on ? (
            <input key={e.i} ref={input} type="number" inputMode="decimal" aria-label={s.wiz.wallInput(e.i + 1)} aria-invalid={bad || undefined} value={text}
              className={cn('absolute h-11 w-24 -translate-x-1/2 -translate-y-1/2 rounded-md border bg-card px-2 text-sm', bad && 'border-destructive')} style={{ left, top }}
              onChange={(ev) => { setText(ev.target.value); setBad(false); }} onBlur={commit}
              onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); commit(); } if (ev.key === 'Escape') { ev.stopPropagation(); setActive(null); setBad(false); } }} />
          ) : (
            <button key={e.i} type="button" data-wall={e.i} aria-label={s.wiz.wallLabel(e.i + 1, Math.round(e.len))} onClick={() => { setActive(e.i); setText(String(Math.round(e.len))); setBad(false); }}
              className="absolute inline-flex h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border bg-card px-2 text-sm font-semibold tabular-nums outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50" style={{ left, top }}>
              {nf(Math.round(e.len))}
            </button>
          );
        })}
      </div>
      {bad && <p className="text-center text-sm text-destructive" role="alert" data-wall-bad>{s.wiz.wallBad}</p>}
    </div>
  );
}
