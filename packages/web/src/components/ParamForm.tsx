import { useState } from 'react';
import { ROOMS, fieldIssues, isAttic, typeOf, type FieldIssue, type RoomModel } from '@slabs/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { T_, s } from '../i18n';
import { useStore } from '../state/store';
import { roomEngine, type RoomRef } from '../state/project';
import { useRoomEngine } from '../state/engine';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { NumField } from './Fields';

/** The other inputs a bound depends on, with their current values, for the explanation under the field. */
export function becauseOf(issue: FieldIssue, id?: RoomRef, params?: Record<string, number>): Array<{ name: string; value: number; unit: string }> {
  const room = id ?? useStore.getState().tab;
  const p = useStore.getState().project;
  const rs = p.rooms[room];
  if (!rs) return [];
  const def = ROOMS[typeOf(rs.spec)];
  const pr = params ?? roomEngine(p, room).params;
  return issue.because.flatMap((k) => { const f = def.fields.find((x) => x.key === k); return f ? [{ name: T_(f.label), value: pr[k] ?? 0, unit: f.unit }] : []; });
}

/** Start points: only the R points that exist in this room; the shift control sits in its own row. */
export function StartPoints({ id, model, selected, onSelect }: { id: RoomRef; model: RoomModel; selected: number; onSelect: (k: number) => void }) {
  const { params, type } = useRoomEngine(id);
  const setParam = useStore((st) => st.setParam);
  const setParams = useStore((st) => st.setParams);
  const showToast = useStore((st) => st.showToast);
  const names = ROOMS[type].shiftNames;
  const issues: Record<string, FieldIssue> = {};
  fieldIssues(type, params).forEach((i) => { issues[i.key] = i; });
  const [step, setStep] = useState(5);
  const [showAll, setShowAll] = useState(false);
  const end = T_(type === 'lazienka-1' ? 'łazienki' : 'salonu');
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
        const w = isAttic(model) ? model.walls.find((q) => q.rid === i) : undefined;
        const refId = isAttic(model) && model.sheet ? (i === 1 ? model.sheet.ref : w?.ref ?? 'R' + i) : 'R' + i;
        const rn = Number(refId.slice(1));
        const name = isAttic(model) && model.sheet && i === 1 ? model.refs[0]!.name : T_(nm);
        return (
          <div className={cn('shift grid grid-cols-[3rem_minmax(0,1fr)_2.75rem_5rem_2.75rem] items-center gap-1.5 rounded-lg p-1.5', selected === i && 'bg-primary/10 ring-1 ring-primary/30')} key={i} onFocus={() => onSelect(i)}>
            <Button variant={selected === i ? 'default' : 'ghost'} size="sm" className="px-0 font-semibold" aria-pressed={selected === i} aria-label={`${refId} – ${name}`} onClick={() => onSelect(i)}>{refId}</Button>
            <span className="text-xs leading-tight text-muted-foreground">{name}</span>
            <Button variant="outline" size="icon" aria-label={s.room.shiftLeft(rn, name)} onClick={() => bump(-1)}><ChevronLeft /></Button>
            <div className="flex flex-wrap"><NumField id={`o_${id}_${i}`} value={v} label={s.room.shiftValue(rn)} onValue={(x) => setParam(id, 'o' + i, x)} name={s.room.shiftValue(rn)} error={issue && s.room.issue(s.room.shiftValue(rn), issue.kind, issue.bound, 'cm', becauseOf(issue, id))} correctTo={issue?.bound} track={`${id}.o${i}`} /></div>
            <Button variant="outline" size="icon" aria-label={s.room.shiftRight(rn, name)} onClick={() => bump(1)}><ChevronRight /></Button>
          </div>
        );
      })}
      <Button variant="ghost" size="sm" className="self-start text-muted-foreground" aria-pressed={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? s.room.onlySelected : s.room.allStarts}</Button>
      <p className="text-xs text-muted-foreground">{type === 'lazienka-2' ? s.room.shiftNoteFlat : s.room.shiftNote(end)}</p>
    </div>
  );
}
