import { useEffect, useMemo, useRef, useState } from 'react';
import { balances, bbox, edgesOf, outlineFromLengths, type Outline } from '@slabs/core';
import { Check, AlertTriangle } from 'lucide-react';
import { nf, s } from '../i18n';
import { cn } from '@/lib/utils';

const SIZE = 360, PAD = 52;

/**
 * Wall lengths typed on the drawing, in any order. The shape does not change while the numbers are incomplete: it is redrawn once every wall has a
 * length and the walls on opposite sides add up (east = west, north = south). A live balance per direction tells what is still missing.
 * `base` gives the directions of the walls (the grid shape); `initial` pre-fills the lengths (an existing room).
 */
export function OutlineEditor({ base, initial, onValid }: { base: Outline; initial?: number[]; onValid: (o: Outline | null) => void }) {
  const [draft, setDraft] = useState<string[]>(() => base.map((_p, i) => (initial ? String(Math.round(initial[i]! * 10) / 10) : '')));
  const es = useMemo(() => edgesOf(base), [base]);
  const lens = useMemo(() => draft.map((t) => { const v = Number(t.replace(',', '.')); return t.trim() === '' || !isFinite(v) ? null : v; }), [draft]);
  const valid = useMemo(() => outlineFromLengths(base, lens), [base, lens]);
  const bal = useMemo(() => balances(base, lens), [base, lens]);
  const last = useRef<Outline | null>(valid);
  if (valid) last.current = valid;
  const cb = useRef(onValid);
  cb.current = onValid;
  useEffect(() => { cb.current(valid); }, [valid]);
  // the drawing keeps the last complete shape (the grid's, at first) until a new complete one exists
  const shown = valid ?? last.current ?? base;
  const b = bbox(shown);
  const k = Math.min((SIZE - 2 * PAD) / Math.max(b.w, 1), (SIZE - 2 * PAD) / Math.max(b.l, 1));
  const X = (x: number) => PAD + (x - b.x0) * k, Y = (y: number) => SIZE - PAD - (y - b.y0) * k;
  const sh = edgesOf(shown);
  const cx = X((b.x0 + b.x1) / 2), cy = Y((b.y0 + b.y1) / 2);
  const axisOf = (i: number) => (Math.abs(es[i]!.d[0]) > 0.5 ? 0 : 1);
  const missingAll = lens.filter((v) => v === null).length;
  const bad = (i: number) => lens[i] !== null && lens[i]! < 10;
  return (
    <div className="flex flex-col gap-3" data-outline-editor data-complete={valid ? 'yes' : 'no'}>
      <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-label={s.spec.plan} className={cn('text-foreground', !valid && 'opacity-80')}>
          <polygon points={shown.map((q) => `${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join(' ')} style={{ fill: 'var(--r0)' }} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeDasharray={valid ? undefined : '6 4'} />
        </svg>
        {sh.map((e) => {
          const mx = (X(e.a[0]) + X(e.b[0])) / 2, my = (Y(e.a[1]) + Y(e.b[1])) / 2;
          const nx = e.d[1] !== 0 ? Math.sign(mx - cx) || 1 : 0, ny = e.d[0] !== 0 ? Math.sign(my - cy) || 1 : 0;
          const unbalanced = missingAll === 0 && Math.abs(bal[axisOf(e.i)]!.diff) > 0.5;
          return (
            <input key={e.i} type="number" inputMode="decimal" data-wall={e.i} placeholder={`${e.i + 1}`} aria-label={s.wiz.wallInput(e.i + 1)} aria-invalid={bad(e.i) || undefined}
              value={draft[e.i]} onChange={(ev) => setDraft((d) => d.map((v, j) => (j === e.i ? ev.target.value : v)))}
              className={cn('absolute h-11 w-[5.5rem] -translate-x-1/2 -translate-y-1/2 rounded-md border bg-card px-2 text-center text-sm font-semibold tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', (unbalanced || bad(e.i)) && 'border-warning', draft[e.i] === '' && 'border-dashed')}
              style={{ left: mx + nx * 40, top: my + ny * 26 }} />
          );
        })}
      </div>
      <ul className="mx-auto flex max-w-[48ch] flex-col gap-1 text-sm" data-balance aria-live="polite">
        {bal.map((x) => {
          const name = x.axis === 'x' ? s.wiz.axisX : s.wiz.axisY;
          const ok = x.missing.length === 0 && Math.abs(x.diff) <= 0.5;
          return (
            <li key={x.axis} data-axis={x.axis} data-ok={ok} className={cn('flex items-start gap-2', ok ? 'text-foreground' : 'text-muted-foreground')}>
              {ok ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />}
              <span>{name}: {x.missing.length ? s.wiz.balanceMissing(x.missing.map((i) => i + 1).join(', ')) : ok ? s.wiz.balanceOk(nf(Math.round(x.plus * 10) / 10)) : s.wiz.balanceDiff(nf(Math.round(x.plus * 10) / 10), nf(Math.round(x.minus * 10) / 10), nf(Math.abs(Math.round(x.diff * 10) / 10)))}</span>
            </li>
          );
        })}
      </ul>
      <p className="mx-auto max-w-[48ch] text-center text-[13px] text-muted-foreground" data-outline-hint>{valid ? s.wiz.shapeReady : s.wiz.shapeWaits}</p>
    </div>
  );
}
