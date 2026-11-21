import { useEffect, useRef, useState } from 'react';
import { s } from '../i18n';

interface Props {
  name: string;
  value: number;
  unit?: string;
  /** plain-words problem with a typed number, or null when it is acceptable */
  validate: (v: number) => string | null;
  /** an acceptable number was entered */
  onSave: (v: number) => void;
  /** the field was emptied and left: it is flagged missing, nothing else changes */
  onEmpty?: () => void;
  /** finished: `next` = go on to the next measurement */
  onDone: (next: boolean) => void;
  /** "show in the panel": the quick edit stays here, the panel is for everything else */
  onMore?: () => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Number entry for one measurement, as a popover on the drawing (desk) or a bottom sheet (phone, by CSS).
 * Enter checks the number first: a wrong one stays open with the reason, so it never jumps on to the next measurement.
 */
export function MeasureEntry({ name, value, unit = 'cm', validate, onSave, onEmpty, onDone, onMore, style, children }: Props) {
  const [v, setV] = useState(String(value));
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const check = (): { ok: boolean; n: number } => {
    if (v.trim() === '') { setErr(s.room.fillIn(name)); return { ok: false, n: NaN }; }
    const n = Number(v);
    if (!isFinite(n)) { setErr(s.room.fillIn(name)); return { ok: false, n }; }
    const problem = validate(n);
    setErr(problem);
    return { ok: !problem, n };
  };
  const commit = (next: boolean) => {
    const r = check();
    if (!r.ok) { if (v.trim() === '') onEmpty?.(); return; }
    done.current = true;
    if (r.n !== value) onSave(r.n);
    onDone(next);
  };
  const id = 'meas-' + name.replace(/\W+/g, '');
  return (
    <div className="meas-edit" style={style} role="dialog" aria-label={name}>
      <label htmlFor={id} className="meas-name">{name}</label>
      {children}
      <div className="meas-row">
        <input ref={ref} id={id} type="number" inputMode="decimal" value={v} aria-invalid={err ? true : undefined} aria-describedby={err ? id + '-e' : undefined}
          onChange={(e) => { setV(e.target.value); setErr(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(true); } else if (e.key === 'Escape') { e.preventDefault(); done.current = true; onDone(false); } }}
          onBlur={() => { if (done.current) return; const r = check(); if (r.ok) commit(false); else if (v.trim() === '') { onEmpty?.(); onDone(false); } else onDone(false); }} />
        <span className="unit">{unit}</span>
        <button type="button" className="pri" onMouseDown={(e) => e.preventDefault()} onClick={() => commit(true)}>{s.room.measureNext}</button>
      </div>
      {err && <p id={id + '-e'} className="ferr" role="alert">{err}</p>}
      {onMore && <button type="button" className="text-sm text-primary underline underline-offset-4" onMouseDown={(e) => e.preventDefault()} onClick={() => { done.current = true; onMore(); onDone(false); }}>{s.panel.showInPanel}</button>}
    </div>
  );
}
