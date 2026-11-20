import { useState } from 'react';

interface NumProps {
  id: string;
  value: number;
  /** value used when the field is emptied */
  empty?: number;
  onValue: (v: number) => void;
  label?: string;
  step?: number | 'any';
  className?: string;
  /** plain-words problem with the value, shown under the field */
  error?: string;
  /** called on blur when the value is wrong: gives the value the field is corrected to */
  correctTo?: number;
}

/**
 * Number input that keeps what the user types (e.g. "4." or an empty field) while the model gets valid numbers.
 * A wrong value is explained under the field (aria-invalid + aria-describedby) and corrected on blur, so the field
 * never shows something other than what the plan uses.
 */
export function NumField({ id, value, empty = 0, onValue, label, step = 'any', className, error, correctTo }: NumProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const errId = error ? `${id}-err` : undefined;
  return (
    <>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={errId}
        className={className}
        value={draft ?? String(value)}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = e.target.value;
          onValue(v === '' ? empty : Number(v));
        }}
        onBlur={() => {
          setDraft(null);
          if (error && correctTo !== undefined) onValue(correctTo);
        }}
      />
      {error && <span id={errId} className="ferr" role="alert">{error}</span>}
    </>
  );
}

export function CheckField({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />;
}
