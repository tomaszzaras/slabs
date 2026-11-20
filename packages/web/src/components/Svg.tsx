import { useMemo } from 'react';
import type { CutResult } from '@slabs/core';
import { sharedPlateMarks, wrap, type Drawing } from '@slabs/render';
import { drawingLabels, nf, roomPrefix } from '../i18n';
import { useWidth } from './Pan';

/** Renders SVG produced by @slabs/render (our own strings, never user text). */
export function SvgDrawing({ d, className = 'draw' }: { d: Drawing; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: wrap(d) }} />;
}

const nfi = (v: number) => nf(Math.round(v * 10) / 10, Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1);
const CARD = 480, GAP = 18;

/** The plates of a cut. Drawn at 1 px per unit (the width is chosen from the container), so text is never scaled below its size. */
export function SheetGrid({ R, minOffcut, minStrip }: { R: Pick<CutResult, 'PL' | 'PW' | 'plates'>; minOffcut: number; minStrip: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const cols = Math.max(1, Math.floor((w + GAP) / (CARD + GAP)));
  const cardW = (w - GAP * (cols - 1)) / cols;
  const scale = Math.round(Math.max(0.5, Math.min(1.15, (cardW - 20) / R.PL)) * 100) / 100;
  const svgs = useMemo(() => (w ? sharedPlateMarks(R, minOffcut, minStrip, { scale, labels: drawingLabels, nf: nfi, prefix: roomPrefix }) : []), [R, minOffcut, minStrip, scale, w]);
  return (
    <div className="sheets" ref={ref} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {svgs.map((svg, i) => <div key={i} className="plate-card" dangerouslySetInnerHTML={{ __html: svg }} />)}
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
