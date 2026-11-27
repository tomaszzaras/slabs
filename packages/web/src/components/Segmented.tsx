import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SegOption<T extends string> { value: T; label: string; icon?: ReactNode; disabled?: boolean }

/** A row of mutually exclusive choices (buttons with aria-pressed), 44 px high so a thumb hits them. */
export function Segmented<T extends string>({ label, value, options, onChange, testid, className }: { label: string; value: T; options: Array<SegOption<T>>; onChange: (v: T) => void; testid?: string; className?: string }) {
  return (
    <div role="group" aria-label={label} data-seg={testid} className={cn('inline-flex max-w-full flex-wrap rounded-md border p-0.5', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" data-v={o.value} aria-pressed={value === o.value} disabled={o.disabled} onClick={() => onChange(o.value)}
          className={cn('inline-flex min-h-11 min-w-11 flex-1 items-center justify-center gap-1.5 rounded-[5px] px-3 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50',
            value === o.value ? 'bg-primary text-primary-foreground font-semibold' : 'text-foreground hover:bg-muted')}>
          {o.icon}<span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
