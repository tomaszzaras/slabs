import { useState } from 'react';
import { ROOMS, fieldIssues, isAttic, type FieldIssue, type RoomId, type RoomModel } from '@slabs/core';
import { ChevronLeft, ChevronRight, CircleHelp } from 'lucide-react';
import { T_, s } from '../i18n';
import { useStore } from '../state/store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Section } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CheckField, NumField } from './Fields';

/** The other inputs a bound depends on, with their current values, for the explanation under the field. */
export function becauseOf(issue: FieldIssue, id?: RoomId, params?: Record<string, number>): Array<{ name: string; value: number; unit: string }> {
  const room = id ?? useStore.getState().tab;
  if (!(room in ROOMS)) return [];
  const def = ROOMS[room as RoomId];
  const pr = params ?? useStore.getState().project.rooms[room as RoomId].params;
  return issue.because.flatMap((k) => { const f = def.fields.find((x) => x.key === k); return f ? [{ name: T_(f.label), value: pr[k] ?? 0, unit: f.unit }] : []; });
}

/** The window fields are replaced by the openings of the surface (see OpeningsPanel). */
export const HIDDEN = ['winOn', 'winD'];

/** "?" next to a field: opens a few plain words on what to measure and where. */
function HelpTip({ id, name, text }: { id: string; name: string; text?: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <>
      <Button variant="ghost" size="icon" className="helpbtn size-11 text-muted-foreground" aria-label={s.room.helpBtn(name)} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><CircleHelp /></Button>
      {open && <p id={id} className="help basis-full max-w-[66ch] rounded-md bg-muted px-3 py-2 text-[13px]" role="note">{text}</p>}
    </>
  );
}

/** Dimension form generated from the room's field table (groups are collapsible). */
export function Dimensions({ id, model }: { id: RoomId; model: RoomModel }) {
  const params = useStore((st) => st.project.rooms[id].params);
  const setParam = useStore((st) => st.setParam);
  const def = ROOMS[id];
  const issues: Record<string, FieldIssue> = {};
  fieldIssues(id, params).forEach((i) => { issues[i.key] = i; });
  const groups: Record<string, typeof def.fields> = {};
  def.fields.filter((fd) => !HIDDEN.includes(fd.key)).forEach((fd) => { (groups[fd.group] ??= []).push(fd); });
  return (
    <div>
      {Object.keys(groups).map((g, i) => (
        <Section key={g} title={T_(g)} defaultOpen={i < 3}>
          <div className="flex flex-col gap-3">
            {groups[g]!.map((fd) => {
              const fid = `p_${id}_${fd.key}`;
              let label = T_(fd.label);
              if (fd.key === 'capH' && model.p.capMin && isAttic(model)) label += ` (${s.room.minMax(model.p.capMin, Math.floor(model.RID - 1))})`;
              const issue = issues[fd.key];
              return (
                <div className="frow grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-3" key={fd.key}>
                  <div className="lab flex flex-wrap items-center gap-x-0.5"><Label htmlFor={fid}>{label}</Label><HelpTip id={`h_${id}_${fd.key}`} name={label} text={s.room.help[fd.key]} /></div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {fd.unit === 'chk' ? (
                      <CheckField id={fid} checked={!!params[fd.key]} onChange={(v) => setParam(id, fd.key, v ? 1 : 0)} />
                    ) : (
                      <>
                        <NumField id={fid} className="min-w-0 flex-1 basis-16" value={params[fd.key] ?? 0} empty={def.defaults[fd.key]} onValue={(v) => setParam(id, fd.key, v)} name={label} error={issue && s.room.issue(label, issue.kind, issue.bound, fd.unit, becauseOf(issue, id))} correctTo={issue?.bound} track={`${id}.${fd.key}`} />
                        <span className="min-w-5 text-sm text-muted-foreground">{fd.unit}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      ))}
      <p className="pt-2 text-xs text-muted-foreground">{s.room.clampNote}</p>
    </div>
  );
}

/** Start points: only the R points that exist in this room; the shift control sits in its own row. */
export function StartPoints({ id, model, selected, onSelect }: { id: RoomId; model: RoomModel; selected: number; onSelect: (k: number) => void }) {
  const params = useStore((st) => st.project.rooms[id].params);
  const setParam = useStore((st) => st.setParam);
  const setParams = useStore((st) => st.setParams);
  const showToast = useStore((st) => st.showToast);
  const names = ROOMS[id].shiftNames;
  const issues: Record<string, FieldIssue> = {};
  fieldIssues(id, params).forEach((i) => { issues[i.key] = i; });
  const [step, setStep] = useState(5);
  const [showAll, setShowAll] = useState(false);
  const end = T_(id === 'lazienka-1' ? 'łazienki' : 'salonu');
  return (
    <div className="flex flex-col gap-2">
      <div className="stepbar flex flex-wrap items-center gap-2">
        <Label htmlFor={`step_${id}`}>{s.room.step}</Label>
        <Select value={String(step)} onValueChange={(v) => setStep(Number(v))}>
          <SelectTrigger id={`step_${id}`} className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>{[1, 5, 10, 25].map((v) => <SelectItem key={v} value={String(v)}>{v} cm</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" onClick={() => { setParams(id, Object.fromEntries(Array.from({ length: 9 }, (_v, i) => ['o' + (i + 1), 0]))); showToast(s.history.zeroDone, true); }}>{s.room.zero}</Button>
      </div>
      {names.map((nm, idx) => {
        const i = idx + 1;
        if (!model.present[i]) return null;
        if (i !== selected && !showAll) return null;
        const v = params['o' + i] ?? 0;
        const bump = (d: number) => setParam(id, 'o' + i, Math.round((v + d * step) * 10) / 10);
        const issue = issues['o' + i];
        const name = T_(nm);
        return (
          <div className={cn('shift grid grid-cols-[3rem_minmax(0,1fr)_2.75rem_5rem_2.75rem] items-center gap-1.5 rounded-lg p-1.5', selected === i && 'bg-primary/10 ring-1 ring-primary/30')} key={i} onFocus={() => onSelect(i)}>
            <Button variant={selected === i ? 'default' : 'ghost'} size="sm" className="px-0 font-semibold" aria-pressed={selected === i} aria-label={`R${i} – ${name}`} onClick={() => onSelect(i)}>R{i}</Button>
            <span className="text-xs leading-tight text-muted-foreground">{name}</span>
            <Button variant="outline" size="icon" aria-label={s.room.shiftLeft(i, name)} onClick={() => bump(-1)}><ChevronLeft /></Button>
            <div className="flex flex-wrap"><NumField id={`o_${id}_${i}`} value={v} label={s.room.shiftValue(i)} onValue={(x) => setParam(id, 'o' + i, x)} name={s.room.shiftValue(i)} error={issue && s.room.issue(s.room.shiftValue(i), issue.kind, issue.bound, 'cm', becauseOf(issue, id))} correctTo={issue?.bound} track={`${id}.o${i}`} /></div>
            <Button variant="outline" size="icon" aria-label={s.room.shiftRight(i, name)} onClick={() => bump(1)}><ChevronRight /></Button>
          </div>
        );
      })}
      <Button variant="ghost" size="sm" className="self-start text-muted-foreground" aria-pressed={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? s.room.onlySelected : s.room.allStarts}</Button>
      <p className="text-xs text-muted-foreground">{id === 'lazienka-2' ? s.room.shiftNoteFlat : s.room.shiftNote(end)}</p>
    </div>
  );
}
