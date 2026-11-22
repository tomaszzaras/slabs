import { useEffect, useRef, useState } from 'react';
import { ROOM_TEMPLATES, type AddTemplateId } from '@slabs/core';
import { ArrowLeft } from 'lucide-react';
import { s } from '../i18n';
import { MAX_ROOMS } from '../state/project';
import { jumpToField } from '../state/focusField';
import { bandTab, useStore } from '../state/store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { TemplateDrawing } from './RoomDrawings';

/**
 * "+ Dodaj pomieszczenie": first a template (small section drawing + one line each), then the name. The room opens on its dimensions with
 * the first measurement it needs focused.
 */
export function AddRoomDialog() {
  const open = useStore((st) => st.addOpen);
  const bands = useStore((st) => st.project.bands);
  const full = useStore((st) => st.project.roomOrder.length >= MAX_ROOMS);
  const { setAddOpen, addRoom, addBand, setTab } = useStore.getState();
  const [step, setStep] = useState<'pick' | 'name'>('pick');
  const [tpl, setTpl] = useState<AddTemplateId>('under-roof');
  const [side, setSide] = useState<'left' | 'right'>('left');
  const [name, setName] = useState('');
  const created = useRef(false);
  useEffect(() => { if (open) { setStep('pick'); setName(''); setSide('left'); created.current = false; } }, [open]);

  const pick = (id: AddTemplateId) => {
    if (id === 'band') {
      const exists = bands[0];
      if (exists) setTab(bandTab(exists.id)); else addBand();
      created.current = true;
      setAddOpen(false);
      return;
    }
    if (full) return;
    setTpl(id);
    setStep('name');
  };
  const create = () => {
    const t = ROOM_TEMPLATES.find((x) => x.id === tpl)!;
    const id = addRoom(tpl, name.trim(), t.sides ? side : undefined);
    if (!id) return;
    created.current = true;
    setAddOpen(false);
    jumpToField(id, t.focus);
  };
  const t = ROOM_TEMPLATES.find((x) => x.id === tpl)!;
  const texts = s.rooms.picker.templates as Record<string, { name: string; desc: string }>;
  return (
    <Dialog open={open} onOpenChange={setAddOpen}>
      <DialogContent closeLabel={s.rooms.picker.close} data-testid="add-room" onCloseAutoFocus={(e) => { if (created.current) e.preventDefault(); }}>
        {step === 'pick' ? (
          <>
            <DialogTitle className="pr-10 text-lg font-semibold tracking-tight">{s.rooms.picker.title}</DialogTitle>
            <DialogDescription className="max-w-[60ch] text-sm text-muted-foreground">{s.rooms.picker.intro}</DialogDescription>
            {full && <p className="rounded-md border border-warning/50 bg-warning/10 p-2 text-sm" role="status">{s.rooms.full(MAX_ROOMS)}</p>}
            <ul className="grid gap-2 sm:grid-cols-2" role="list">
              {ROOM_TEMPLATES.map((x) => {
                const exists = x.id === 'band' && bands.length > 0;
                return (
                  <li key={x.id} className="flex">
                    <button type="button" data-template={x.id} disabled={full && x.id !== 'band'} onClick={() => pick(x.id)} aria-label={s.rooms.picker.pick(texts[x.id].name)}
                      className={cn('flex min-h-11 w-full flex-1 items-center gap-3 rounded-lg border bg-card p-3 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50')}>
                      <TemplateDrawing id={x.id} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-semibold">{texts[x.id].name}</span>
                        <span className="text-[13px] leading-snug text-muted-foreground">{exists ? s.rooms.picker.bandExists : texts[x.id].desc}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); create(); }}>
            <DialogTitle className="pr-10 text-lg font-semibold tracking-tight">{s.rooms.picker.nameTitle}</DialogTitle>
            <DialogDescription className="flex items-center gap-3 text-sm text-muted-foreground"><TemplateDrawing id={tpl} /><span>{texts[tpl].name}. {texts[tpl].desc}</span></DialogDescription>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-room-name">{s.rooms.picker.nameLabel}</Label>
              <Input id="new-room-name" autoFocus maxLength={60} placeholder={s.rooms.picker.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {t.sides && (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">{s.rooms.picker.side}</legend>
                <div className="flex flex-wrap gap-2" role="group">
                  {(['left', 'right'] as const).map((v) => (
                    <Button key={v} type="button" variant={side === v ? 'default' : 'outline'} aria-pressed={side === v} data-side={v} onClick={() => setSide(v)}>{s.rooms.picker[v]}</Button>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep('pick')}><ArrowLeft />{s.rooms.picker.back}</Button>
              <span className="flex-1" />
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>{s.rooms.picker.cancel}</Button>
              <Button type="submit" data-a="create-room">{s.rooms.picker.create}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
