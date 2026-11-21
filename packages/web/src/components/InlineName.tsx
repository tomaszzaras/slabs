import { useEffect, useRef, useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { s } from '../i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * A name that can be changed where it stands: the text with a pencil, or (editing) a text field. Enter or leaving the field keeps the
 * name, Escape drops the change, an empty name goes back to the generic one. `editing` lets a parent open it (double-click on a tab).
 */
export function InlineName({ value, generic, onCommit, label, className, editing: ext, onEditing, hidePencil }: {
  /** the name now (custom or generic) */
  value: string;
  generic: string;
  onCommit: (name: string) => void;
  /** accessible name of the field and the pencil, e.g. the thing being renamed */
  label?: string;
  className?: string;
  editing?: boolean;
  onEditing?: (v: boolean) => void;
  hidePencil?: boolean;
}) {
  const [own, setOwn] = useState(false);
  const editing = ext ?? own;
  const set = (v: boolean) => { setOwn(v); onEditing?.(v); };
  const [text, setText] = useState(value);
  const done = useRef(false);
  useEffect(() => { if (editing) { setText(value === generic ? '' : value); done.current = false; } }, [editing]);
  const name = label ?? value;
  const commit = () => {
    if (done.current) return;
    done.current = true;
    const t = text.trim();
    if (t !== (value === generic ? '' : value)) onCommit(t);
    set(false);
  };
  if (editing) {
    return (
      <span className={'inline-flex items-center gap-1 ' + (className ?? '')} data-inline-name="edit">
        <Input
          autoFocus
          className="h-10 w-56 max-w-full text-base font-normal"
          aria-label={s.names.nameOf(name)}
          placeholder={generic}
          value={text}
          maxLength={60}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.stopPropagation(); done.current = true; set(false); }
          }}
        />
        <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={s.names.rename} onMouseDown={(e) => e.preventDefault()} onClick={commit}><Check /></Button>
      </span>
    );
  }
  return (
    <span className={'inline-flex items-center gap-0.5 ' + (className ?? '')} data-inline-name="show">
      <span>{value}</span>
      {!hidePencil && <Button type="button" variant="ghost" size="icon" className="size-11 text-muted-foreground" aria-label={s.names.renameOf(name)} title={s.names.rename} onClick={() => set(true)}><Pencil className="size-4" /></Button>}
    </span>
  );
}
