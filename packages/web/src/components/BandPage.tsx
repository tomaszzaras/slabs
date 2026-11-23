import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { bandName, nf, s } from '../i18n';
import { buildRequest, hashRequest } from '../cut/request';
import { useStore } from '../state/store';
import type { BandItem } from '../state/project';
import { CheckField, NumField } from './Fields';
import { InlineName } from './InlineName';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

const SLOT = 'rozkroj';

const Row = ({ id, label, unit, children }: { id: string; label: string; unit?: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-3">
    <Label htmlFor={id}>{label}</Label>
    <div className="flex flex-wrap items-center gap-1.5">{children}{unit && <span className="text-sm text-muted-foreground">{unit}</span>}</div>
  </div>
);

/** The band as an item of the project: its measures, its pieces drawn with vertical grain, and what the cut made of it. */
export function BandPage({ band }: { band: BandItem }) {
  const project = useStore((st) => st.project);
  const entry = useStore((st) => st.cuts[SLOT]);
  const { setBand, renameBand, removeBand } = useStore.getState();
  const req = useMemo(() => buildRequest(project), [project]);
  const fresh = !!entry && entry.key === hashRequest(req);
  const R = entry?.result ?? null;
  const name = bandName(band);
  // the engine cuts one band: the first one that is on
  const active = project.bands.find((b) => b.on)?.id === band.id;
  const hasPieces = !!R && active && R.segs.length > 0;
  return (
    <main id="main" className="mx-auto flex max-w-[1100px] flex-col gap-5 p-4" data-room={'band-' + band.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight"><InlineName value={name} generic={s.band.generic} label={name} onCommit={(n) => renameBand(band.id, n)} /></h1>
          <p className="max-w-[66ch] text-sm text-muted-foreground">{s.band.intro}</p>
        </div>
        <Button variant="outline" onClick={() => removeBand(band.id)}><Trash2 />{s.band.remove}</Button>
      </div>
      <Card>
        <CardContent className="grid gap-x-8 gap-y-3 pt-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,20rem),1fr))]">
          <Row id="b_on" label={s.band.on}><CheckField id="b_on" checked={band.on} onChange={(v) => setBand(band.id, { on: v })} /></Row>
          <Row id="b_len" label={s.band.len} unit="cm"><NumField id="b_len" className="flex-1 basis-16" value={band.len} onValue={(v) => setBand(band.id, { len: Math.max(0, v) })} /></Row>
          <Row id="b_h" label={s.band.h} unit="cm"><NumField id="b_h" className="flex-1 basis-16" value={band.h} onValue={(v) => setBand(band.id, { h: Math.max(0, v) })} /></Row>
          <Row id="b_min" label={s.band.min} unit="cm"><NumField id="b_min" className="flex-1 basis-16" value={band.min} onValue={(v) => setBand(band.id, { min: Math.max(0, v) })} /></Row>
          <Row id="b_max" label={s.band.max} unit="cm"><NumField id="b_max" className="flex-1 basis-16" value={band.max} onValue={(v) => setBand(band.id, { max: Math.max(0, v) })} /></Row>
          <Row id="b_use" label={s.band.use}><CheckField id="b_use" checked={!!band.use} onChange={(v) => setBand(band.id, { use: v ? 1 : 0 })} /></Row>
          <p className="max-w-[66ch] text-xs text-muted-foreground [grid-column:1/-1]">{s.band.useNote}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{s.band.resultTitle}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3" aria-live="polite">
          {!band.on || band.len <= 0 ? <p className="text-sm text-muted-foreground">{s.band.resultNone}</p>
            : !R ? <p className="text-sm text-muted-foreground">{s.band.wait}</p>
            : !active ? <p className="text-sm text-muted-foreground">{s.band.resultNone}</p>
            : (
              <div className={fresh ? undefined : 'stale opacity-50'}>
                {R.notes.some((n) => n.code === 'bandTooTall') && <Badge variant="warning" role="status" className="mb-2">{s.band.tooTall}</Badge>}
                <p className="max-w-[80ch] text-sm" data-testid="band-result">{s.band.result(Math.round(R.fromOff), Math.round(R.bandLen - R.fromOff), R.extraPlates, R.segs.length)}</p>
                <p className="max-w-[80ch] text-sm text-muted-foreground">{s.band.saved(R.stats.separate - R.plates.length)}</p>
              </div>
            )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{s.band.drawTitle}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {hasPieces ? <BandDrawing segs={R.segs} fromOff={R.fromOff} h={R.bandH} stale={!fresh} /> : <p className="text-sm text-muted-foreground">{R ? s.band.resultNone : s.band.wait}</p>}
        </CardContent>
      </Card>
    </main>
  );
}

const VW = 640, GAP = 8, FS = 22, LAB = 84;

/** The pieces in rows, each as wide as it is long (1 cm = 1 unit) and as high as the band; vertical lines show the grain. */
function BandDrawing({ segs, fromOff, h, stale }: { segs: number[]; fromOff: number; h: number; stale: boolean }) {
  const { boxes, height } = useMemo(() => {
    const out: Array<{ x: number; y: number; w: number; off: boolean; i: number }> = [];
    let x = 0, y = 0, cum = 0;
    segs.forEach((w, i) => {
      if (x > 0 && x + w > VW) { x = 0; y += h + GAP; }
      cum += w;
      out.push({ x, y, w, off: cum <= fromOff + 1e-6, i });
      x += w + GAP;
    });
    return { boxes: out, height: y + h };
  }, [segs, fromOff, h]);
  const nOff = boxes.filter((b) => b.off).length;
  const total = segs.reduce((a, v) => a + v, 0);
  return (
    <div className="flex flex-col gap-2" data-testid="band-drawing">
      <svg viewBox={`-2 -2 ${VW + 4} ${height + 4}`} role="img" aria-label={s.band.drawLabel(segs.length, Math.round(h), Math.round(total))} className={'max-w-[720px] ' + (stale ? 'opacity-50' : '')} style={{ width: '100%', height: 'auto' }}>
        <defs>
          <pattern id="band-grain" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M4.5 0V9" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1" /></pattern>
        </defs>
        {boxes.map((b) => (
          <g key={b.i} data-seg={b.i} data-from={b.off ? 'offcuts' : 'plates'}>
            <rect x={b.x} y={b.y} width={b.w} height={h} style={{ fill: b.off ? 'color-mix(in oklab, var(--primary) 16%, var(--card))' : 'var(--muted)', stroke: 'currentColor' }} strokeWidth="1.5" strokeDasharray={b.off ? '7 4' : undefined} />
            <rect x={b.x} y={b.y} width={b.w} height={h} fill="url(#band-grain)" />
            {b.w >= LAB && <text x={b.x + b.w / 2} y={b.y + h / 2 + FS / 3} textAnchor="middle" fontSize={FS} fontWeight="600" style={{ fill: 'currentColor', paintOrder: 'stroke', stroke: 'var(--card)', strokeWidth: 4 }}>{nf(Math.round(b.w * 10) / 10, Number.isInteger(b.w) ? 0 : 1)}</text>}
          </g>
        ))}
      </svg>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label={s.band.drawTitle}>
        <li className="flex items-center gap-2"><svg width="22" height="14" aria-hidden="true"><rect x="1" y="1" width="20" height="12" style={{ fill: 'color-mix(in oklab, var(--primary) 16%, var(--card))', stroke: 'currentColor' }} strokeDasharray="5 3" /></svg>{s.band.fromOffcuts}: {nOff}</li>
        <li className="flex items-center gap-2"><svg width="22" height="14" aria-hidden="true"><rect x="1" y="1" width="20" height="12" style={{ fill: 'var(--muted)', stroke: 'currentColor' }} /></svg>{s.band.fromPlates}: {boxes.length - nOff}</li>
        <li className="text-muted-foreground">{Math.round(h)} cm · {s.band.grain}</li>
      </ul>
      <p className="max-w-[80ch] text-xs text-muted-foreground">{s.band.piecesList(segs.map((v) => nf(Math.round(v * 10) / 10, Number.isInteger(v) ? 0 : 1)).join(', '))}</p>
    </div>
  );
}
