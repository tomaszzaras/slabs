import { wrap, type Drawing } from '@slabs/render';

/** Renders SVG produced by @slabs/render (our own strings, never user text). */
export function SvgDrawing({ d, className = 'draw' }: { d: Drawing; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: wrap(d) }} />;
}

export function SheetGrid({ sheets }: { sheets: string[] }) {
  return (
    <div className="sheets">
      {sheets.map((svg, i) => <div key={i} dangerouslySetInnerHTML={{ __html: svg }} />)}
    </div>
  );
}

export function Stats({ items }: { items: Array<[string | number, string]> }) {
  return (
    <div className="stats">
      {items.map(([v, label]) => <div className="stat" key={label}><b>{v}</b><span>{label}</span></div>)}
    </div>
  );
}
