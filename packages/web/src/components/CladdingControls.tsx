import { useState } from 'react';
import type { WoodMode } from '../state/specEdit';
import { finishOf, dirOf, type Dir, type RoomModel } from '@slabs/core';
import { s, nf } from '../i18n';
import { useRoomEngine } from '../state/engine';
import { useStore } from '../state/store';
import type { RoomRef } from '../state/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from './Segmented';
import { NumField } from './Fields';

type FinishKind = 'wood' | 'other' | 'split';

/** Small drawings of the directions: boards as lines on a square (the roof ones are drawn as slope + ridge). */
function DirIcon({ d }: { d: Dir }) {
  const lines = [4, 8, 12, 16];
  const vertical = d === 'vertical' || d === 'slope';
  return (
    <svg viewBox="0 0 20 20" className="size-5 shrink-0" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" />
      {lines.map((v) => (vertical ? <line key={v} x1={v + 1} y1="2" x2={v + 1} y2="18" stroke="currentColor" strokeWidth="1" /> : <line key={v} x1="2" y1={v + 1} x2="18" y2={v + 1} stroke="currentColor" strokeWidth="1" />))}
    </svg>
  );
}

/**
 * Okładzina of one surface: what covers it (wood / other / split by a height), the direction of the boards and the start of the grid.
 * The drawing under it shows the result at once.
 */
export function CladdingControls({ id, surf, model }: { id: RoomRef; surf: number; model: RoomModel }) {
  const spec = useStore((st) => st.project.rooms[id]!.spec);
  const { params } = useRoomEngine(id);
  const { setSurface, setParam } = useStore.getState();
  const flat = spec.ceiling.kind === 'flat';
  const roofish = surf === 1;
  const fin = finishOf(spec, surf);
  const dir = dirOf(spec, surf);
  const H = spec.ceiling.kind === 'flat' ? spec.ceiling.h : null;
  const kind: FinishKind = fin.kind;
  const ids = `c_${id}_${surf}`;
  const fc = model.faces?.find((x) => x.key === surf);
  const noWood = fin.kind === 'other';
  const dirOptions: Array<{ value: Dir; label: string }> = roofish
    ? (flat ? [{ value: 'slope', label: s.spec.dirAcross }, { value: 'ridge', label: s.spec.dirAlong }] : [{ value: 'slope', label: s.spec.dirSlope }, { value: 'ridge', label: s.spec.dirRidge }])
    : [{ value: 'vertical', label: s.spec.dirVertical }, { value: 'horizontal', label: s.spec.dirHorizontal }];
  const dirNow: Dir = dir ?? (roofish ? 'slope' : 'vertical');
  const setFinish = (k: FinishKind) => {
    if (k === 'wood') setSurface(id, surf, { finish: undefined });
    else if (k === 'other') setSurface(id, surf, { finish: { kind: 'other', ...(fin.kind === 'split' && fin.label ? { label: fin.label } : {}) } });
    else setSurface(id, surf, { finish: { kind: 'split', at: fin.kind === 'split' ? fin.at : Math.round((H ?? model.TOPH) * 0.5), wood: fin.kind === 'split' ? fin.wood : 'above', ...(fin.kind === 'other' && fin.label ? { label: fin.label } : {}) } });
  };
  const finishOptions: Array<{ value: FinishKind; label: string }> = [{ value: 'wood', label: s.spec.finishWood }, { value: 'other', label: s.spec.finishOther }, ...(roofish ? [] : [{ value: 'split' as const, label: s.spec.finishSplit }])];
  const label = fin.kind === 'other' || fin.kind === 'split' ? fin.label ?? '' : '';
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3" data-cladding={surf}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{s.spec.finish}</span>
          <Segmented label={s.spec.finish} testid="finish" value={kind} options={finishOptions} onChange={setFinish} />
        </div>
        {!noWood && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{s.spec.direction}</span>
            <Segmented label={s.spec.direction} testid="dir" value={dirNow} options={dirOptions.map((o) => ({ ...o, icon: <DirIcon d={o.value} /> }))} onChange={(d) => setSurface(id, surf, { dir: d === (roofish ? 'slope' : 'vertical') ? undefined : d })} />
          </div>
        )}
        {!noWood && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${ids}_start`} className="text-sm font-medium">{s.spec.start}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <NumField id={`${ids}_start`} className="w-24 flex-none" value={params['o' + surf] ?? 0} label={s.spec.start} name={s.spec.start} onValue={(v) => setParam(id, 'o' + surf, v)} track={`${id}.o${surf}`} />
              <span className="text-sm text-muted-foreground">cm</span>
            </div>
          </div>
        )}
      </div>
      {fin.kind === 'split' && (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3" data-split>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${ids}_at`} className="text-sm font-medium">{fin.wood === 'above' ? s.spec.woodStartsAt : s.spec.woodEndsAt}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <NumField id={`${ids}_at`} className="w-24 flex-none" value={fin.at} label={fin.wood === 'above' ? s.spec.woodStartsAt : s.spec.woodEndsAt} name={s.spec.splitAt} onValue={(v) => setSurface(id, surf, { finish: { ...fin, at: Math.max(0, v) } })} />
              <span className="text-sm text-muted-foreground">cm</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{s.spec.splitWood}</span>
            <Segmented label={s.spec.splitWood} testid="wood-part" value={fin.wood} options={[{ value: 'above', label: s.spec.splitAbove }, { value: 'below', label: s.spec.splitBelow }]} onChange={(w) => setSurface(id, surf, { finish: { ...fin, wood: w } })} />
          </div>
          {H !== null && <p className="text-[13px] text-muted-foreground" data-testid="split-hint">{s.spec.splitHint(Math.round(fin.wood === 'above' ? H - fin.at : fin.at), Math.round(H))}</p>}
        </div>
      )}
      {(fin.kind === 'other' || fin.kind === 'split') && (
        <div className="flex max-w-xs flex-col gap-1.5">
          <Label htmlFor={`${ids}_label`} className="text-sm font-medium">{s.spec.otherLabel}</Label>
          <Input id={`${ids}_label`} maxLength={40} placeholder={s.spec.otherPlaceholder} defaultValue={label} key={`${surf}-${label}`} onBlur={(e) => { const v = e.target.value.trim(); if (v !== label) setSurface(id, surf, { finish: { ...fin, ...(v ? { label: v } : { label: undefined }) } as typeof fin }); }} />
        </div>
      )}
      {noWood && <p className="text-sm text-muted-foreground" role="note">{s.spec.noWoodHere}</p>}
      {fc && fc.otherArea > 0 && <p className="text-[13px] text-muted-foreground">{s.spec.woodM2}: {nf(fc.woodArea / 1e4, 2)} m² · {s.spec.otherM2}: {nf(fc.otherArea / 1e4, 2)} m²</p>}
    </div>
  );
}

/** "Wszystkie ściany: drewno do wysokości …": every wall gets the same wood zone in one step. */
export function QuickWalls({ id }: { id: RoomRef }) {
  const spec = useStore((st) => st.project.rooms[id]!.spec);
  const setAllWalls = useStore((st) => st.setAllWalls);
  const showToast = useStore((st) => st.showToast);
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(120);
  const [mode, setMode] = useState<WoodMode>('start');
  const flat = spec.ceiling.kind === 'flat';
  return (
    <div className="mt-3 flex flex-col gap-2" data-quick>
      <Button variant="outline" className="h-auto min-h-11 justify-start whitespace-normal text-left" aria-expanded={open} data-a="quick-walls" onClick={() => setOpen(!open)}>{s.spec.quick}</Button>
      {open && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <Segmented label={s.spec.quick} testid="quick-from" value={mode} options={[{ value: 'start', label: s.spec.quickStart }, { value: 'upto', label: s.spec.quickUpto }, ...(flat ? [{ value: 'band' as const, label: s.spec.quickBand }] : [])]} onChange={setMode} />
          <Label htmlFor={`q_${id}_h`} className="text-sm font-medium">{mode === 'band' ? s.spec.quickBandHeight : s.spec.quickHeight}</Label>
          <div className="flex flex-wrap items-center gap-2"><NumField id={`q_${id}_h`} className="w-24 flex-none" value={h} label={s.spec.quickHeight} onValue={(v) => setH(Math.max(1, v))} /><span className="text-sm text-muted-foreground">cm</span></div>
          <Button data-a="quick-apply" onClick={() => { setAllWalls(id, h, flat || mode !== 'band' ? mode : 'start'); showToast(s.spec.quickDone, true); setOpen(false); }}>{s.spec.quickApply}</Button>
        </div>
      )}
    </div>
  );
}
