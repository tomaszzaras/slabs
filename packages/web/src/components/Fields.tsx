import { useEffect, useState } from 'react';
import { s } from '../i18n';
import { useStore } from '../state/store';

interface NumProps {
  id: string;
  value: number;
  /** value used when the field is emptied (fields without `track`) */
  empty?: number;
  onValue: (v: number) => void;
  label?: string;
  /** the field's name as the user reads it: "Wpisz <name>" is shown when the field is empty */
  name?: string;
  step?: number | 'any';
  className?: string;
  /** plain-words problem with the value, shown under the field */
  error?: string;
  /** called on blur when the value is wrong: gives the value the field is corrected to */
  correctTo?: number;
  /** "room.key": an emptied field stays empty (flagged missing, the plan shows "brak wymiaru") until a number is typed */
  track?: string;
}

/**
 * Number input that keeps what the user types. An emptied tracked field stays empty (the project keeps its last number,
 * nothing is changed or added to the undo history) and is flagged missing everywhere until a number is typed.
 * A wrong number is explained under the field (aria-invalid + aria-describedby) and corrected on blur, so the field
 * never shows something other than what the plan uses.
 */
export function NumField({ id, value, empty = 0, onValue, label, name, step = 'any', className, error, correctTo, track }: NumProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const rev = useStore((st) => st.rev);
  const missing = useStore((st) => (track ? st.empty.includes(track) : false));
  useEffect(() => { setDraft(null); }, [rev]); // undo/redo: show what the project holds now
  const msg = missing ? s.room.fillIn(name ?? label ?? '') : error;
  const errId = msg ? `${id}-err` : undefined;
  return (
    <>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        aria-label={label}
        aria-invalid={msg ? true : undefined}
        aria-describedby={errId}
        className={className}
        value={draft ?? (missing ? '' : String(value))}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          if (v === '') {
            if (track) useStore.getState().setEmpty(track, true); else onValue(empty);
            return;
          }
          if (track) useStore.getState().setEmpty(track, false);
          onValue(Number(v));
        }}
        onBlur={() => {
          setDraft(null);
          if (!missing && error && correctTo !== undefined) onValue(correctTo);
        }}
      />
      {msg && <span id={errId} className="ferr" role="alert">{msg}</span>}
    </>
  );
}

export function CheckField({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />;
}
