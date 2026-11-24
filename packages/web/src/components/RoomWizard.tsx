import { useEffect, useMemo, useState } from 'react';
import { cellsToOutline, presetSpec, rectOutline, type Outline } from '@slabs/core';
import { s } from '../i18n';
import { jumpToField } from '../state/focusField';
import { useStore } from '../state/store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { OutlineEditor } from './OutlineEditor';

const N = 5;
type Step = 'height' | 'grid' | 'dims' | 'name';
const STEPS: Step[] = ['height', 'grid', 'dims', 'name'];

/** The shape editor: a 5 x 5 grid of 1 m cells (topology), see `OutlineEditor` for the lengths. */
export function CellGrid({ cells, onToggle }: { cells: boolean[][]; onToggle: (r: number, c: number) => void }) {
  return (
    <div className="grid w-fit gap-1" style={{ gridTemplateColumns: `repeat(${N}, 2.75rem)` }} role="group" aria-label={s.wiz.gridTitle} data-grid>
      {cells.map((row, r) => row.map((on, c) => (
        <button key={r + '-' + c} type="button" data-cell={`${r}-${c}`} aria-pressed={on} aria-label={s.wiz.gridLabel(r + 1, c + 1, on)} onClick={() => onToggle(r, c)}
          className={cn('size-11 rounded-md border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', on ? 'border-foreground bg-[var(--r0)]' : 'bg-card hover:bg-accent')} />
      )))}
    </div>
  );
}

/** "Kreator": the new room with a ceiling, step by step (height, shape on a grid, wall lengths on the drawing, name). Areas are set on the room page. */
export function RoomWizard() {
  const open = useStore((st) => st.wizardOpen);
  const { setWizardOpen, addRoomSpec } = useStore.getState();
  const [step, setStep] = useState<Step>('height');
  const [height, setHeight] = useState(250);
  const [cells, setCells] = useState<boolean[][]>(() => Array.from({ length: N }, () => Array(N).fill(false)));
  const [outline, setOutline] = useState<Outline | null>(null);
  const [name, setName] = useState('');
  useEffect(() => {
    if (!open) return;
    setStep('height'); setHeight(250); setName(''); setOutline(null);
    setCells(Array.from({ length: N }, (_v, r) => Array.from({ length: N }, (_w, c) => r >= 2 && r <= 3 && c >= 1 && c <= 2)));
  }, [open]);
  const shape = useMemo(() => cellsToOutline(cells, 100), [cells]);
  const idx = STEPS.indexOf(step);
  const next = () => {
    if (step === 'grid' && 'outline' in shape) setOutline(shape.outline);
    setStep(STEPS[idx + 1]!);
  };
  const create = () => {
    const base = presetSpec('lazienka-2');
    const ol = outline ?? rectOutline(100, 100);
    const spec = { ...base, ceiling: { kind: 'flat' as const, h: Math.max(100, Math.min(500, height)) }, join: false, outline: ol, w: Math.max(...ol.map((q) => q[0])), l: Math.max(...ol.map((q) => q[1])), surf: {} };
    const id = addRoomSpec(spec, name.trim());
    if (id) { setWizardOpen(false); jumpToField(id, 'h'); }
  };
  const gridOk = 'outline' in shape;
  return (
    <Dialog open={open} onOpenChange={setWizardOpen}>
      <DialogContent closeLabel={s.rooms.picker.close} data-testid="wizard" onEscapeKeyDown={(e) => { if ((document.activeElement as HTMLElement | null)?.closest?.('[data-outline-editor]') && document.activeElement?.tagName === 'INPUT') e.preventDefault(); }}>
        <DialogTitle className="pr-10 text-lg font-semibold tracking-tight">{s.wiz.open}</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">{s.wiz.stepOf(idx + 1, STEPS.length)}</DialogDescription>
        {step === 'height' && (
          <div className="flex flex-col gap-2" data-step="height">
            <h3 className="text-base font-semibold">{s.wiz.heightTitle}</h3>
            <p className="text-sm text-muted-foreground">{s.wiz.heightHelp}</p>
            <Label htmlFor="wiz-height">{s.wiz.heightLabel}</Label>
            <Input id="wiz-height" type="number" inputMode="decimal" className="w-32" value={height} onChange={(e) => setHeight(Number(e.target.value))} autoFocus />
          </div>
        )}
        {step === 'grid' && (
          <div className="flex flex-col gap-3" data-step="grid">
            <h3 className="text-base font-semibold">{s.wiz.gridTitle}</h3>
            <p className="max-w-[56ch] text-sm text-muted-foreground">{s.wiz.gridHelp}</p>
            <CellGrid cells={cells} onToggle={(r, c) => setCells((x) => x.map((row, i) => (i === r ? row.map((v, j) => (j === c ? !v : v)) : row)))} />
            {!gridOk && <p className="text-sm text-destructive" role="alert" data-grid-error>{s.wiz.gridErrors[(shape as { error: 'empty' | 'disconnected' | 'hole' | 'pinch' }).error]}</p>}
          </div>
        )}
        {step === 'dims' && outline && (
          <div className="flex flex-col gap-2" data-step="dims">
            <h3 className="text-base font-semibold">{s.wiz.dimsTitle}</h3>
            <p className="max-w-[56ch] text-sm text-muted-foreground">{s.wiz.dimsHelp}</p>
            <OutlineEditor outline={outline} onChange={setOutline} />
          </div>
        )}
        {step === 'name' && (
          <div className="flex flex-col gap-2" data-step="name">
            <h3 className="text-base font-semibold">{s.wiz.nameTitle}</h3>
            <Label htmlFor="wiz-name">{s.rooms.picker.nameLabel}</Label>
            <Input id="wiz-name" maxLength={60} placeholder={s.rooms.picker.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <p className="max-w-[56ch] text-sm text-muted-foreground">{s.wiz.areasHelp}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" disabled={idx === 0} onClick={() => setStep(STEPS[idx - 1]!)}>{s.wiz.back}</Button>
          <span className="flex-1" />
          <Button type="button" variant="outline" onClick={() => setWizardOpen(false)}>{s.wiz.cancel}</Button>
          {step === 'name'
            ? <Button type="button" data-a="wizard-create" onClick={create}>{s.wiz.create}</Button>
            : <Button type="button" data-a="wizard-next" disabled={(step === 'grid' && !gridOk) || (step === 'height' && !(height >= 100 && height <= 500))} onClick={next}>{s.wiz.next}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
