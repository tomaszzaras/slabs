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
}

/** Number input that keeps what the user types (e.g. "4." or an empty field) while the model gets valid numbers. */
export function NumField({ id, value, empty = 0, onValue, label, step = 'any', className }: NumProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      step={step}
      aria-label={label}
      className={className}
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        const v = e.target.value;
        onValue(v === '' ? empty : Number(v));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

export function CheckField({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />;
}
