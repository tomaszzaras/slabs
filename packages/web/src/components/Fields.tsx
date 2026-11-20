import { useEffect, useState } from 'react';
import { useStore } from '@/state/store';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

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
  /** "room.key": reports an emptied field to the store (the drawing then shows the dimension as missing) */
  track?: string;
}

/**
 * Number input that keeps what the user types (e.g. "4." or an empty field) while the model gets valid numbers.
 * A wrong value is explained under the field (aria-invalid + aria-describedby) and corrected on blur, so the field
 * never shows something other than what the plan uses.
 */
export function NumField({ id, value, empty = 0, onValue, label, step = 'any', className, error, correctTo, track }: NumProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const rev = useStore((st) => st.rev);
  useEffect(() => { setDraft(null); }, [rev]); // undo/redo: show what the project holds now
  const errId = error ? `${id}-err` : undefined;
  return (
    <>
      <Input
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
          if (track) useStore.getState().setEmpty(track, v === '');
          onValue(v === '' ? empty : Number(v));
        }}
        onBlur={() => {
          setDraft(null);
          if (track) useStore.getState().setEmpty(track, false);
          if (error && correctTo !== undefined) onValue(correctTo);
        }}
      />
      {error && <span id={errId} role="alert" className="basis-full text-[13px] leading-snug text-destructive">{error}</span>}
    </>
  );
}

export function CheckField({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />;
}
