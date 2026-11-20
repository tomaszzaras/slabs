import { cn } from '@/lib/utils';

export function SheetGrid({ sheets }: { sheets: string[] }) {
  return (
    <div className="sheets grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,26rem),1fr))]">
      {sheets.map((svg, i) => <div key={i} className="overflow-hidden rounded-lg border bg-card p-2" dangerouslySetInnerHTML={{ __html: svg }} />)}
    </div>
  );
}

/** Key figures as a plain list of label/value rows. */
export function Stats({ items, className }: { items: Array<[string | number, string]>; className?: string }) {
  return (
    <dl className={cn('grid gap-x-8 [grid-template-columns:repeat(auto-fill,minmax(14rem,1fr))]', className)}>
      {items.map(([v, label]) => (
        <div className="stat flex items-baseline justify-between gap-3 border-b py-2" key={label}>
          <dd className="order-2 font-semibold whitespace-nowrap"><b>{v}</b></dd>
          <dt className="text-sm text-muted-foreground"><span>{label}</span></dt>
        </div>
      ))}
    </dl>
  );
}
