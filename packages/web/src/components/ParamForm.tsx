import { useEffect, useState } from 'react';
import { ROOMS, fieldIssues, isAttic, type FieldDef, type FieldIssue, type RoomId, type RoomModel } from '@slabs/core';
import { AlertTriangle, ChevronLeft, ChevronRight, CircleHelp } from 'lucide-react';
import { usePanel } from '../state/panel';
import { T_, featureName, s } from '../i18n';
import { FEATURE_OF_FIELD, type FeatureKey } from '../state/names';
import { InlineName } from './InlineName';
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
export const HIDDEN = ['winOn', 'winD', 'PL', 'PW'];

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

/** Fields that count for the completeness of a group: numbers and switches that are inputs of the room (the window fields are openings now). */
export const groupsOf = (id: RoomId): Array<{ group: string; fields: FieldDef[] }> => {
  const out: Array<{ group: string; fields: FieldDef[] }> = [];
  ROOMS[id].fields.filter((fd) => !HIDDEN.includes(fd.key)).forEach((fd) => {
    let g = out.find((x) => x.group === fd.group);
    if (!g) { g = { group: fd.group, fields: [] }; out.push(g); }
    g.fields.push(fd);
  });
  return out;
};

/** Plain words for one field: its label, the name of the feature it belongs to included. */
export function fieldLabel(id: RoomId, fd: FieldDef, model?: RoomModel): string {
  let label = T_(fd.label);
  const feat = FEATURE_OF_FIELD[fd.key];
  if (feat === 'recess' || feat === 'builtIn') label = `${featureName(id, feat)}${label.slice(label.indexOf(':'))}`;
  else if (feat === 'niche') label = label.replace(/^[^(]+/, featureName(id, 'niche') + ' ');
  if (fd.key === 'capH' && model && model.p.capMin && isAttic(model)) label += ` (${s.room.minMax(model.p.capMin, Math.floor(model.RID - 1))})`;
  return label;
}

/**
 * Dimension form generated from the room's field table. Every group is collapsible and shows how many of its measurements are
 * filled in ("Bryła 5/5", "Wycięcia 3/4 ⚠"); a missing one can be jumped to. `highlight` marks the fields the selected surface uses.
 */
export function Dimensions({ id, model, highlight = [] }: { id: RoomId; model: RoomModel; highlight?: string[] }) {
  const params = useStore((st) => st.project.rooms[id].params);
  const setParam = useStore((st) => st.setParam);
  const renameFeature = useStore((st) => st.renameFeature);
  const empty = useStore((st) => st.empty);
  useStore((st) => st.project.names.features[id]);
  const focus = usePanel((p) => p.focus);
  const def = ROOMS[id];
  const featuresHere = (['recess', 'builtIn', 'niche', 'endCut'] as FeatureKey[]).filter((f) => def.fields.some((fd) => FEATURE_OF_FIELD[fd.key] === f));
  const issues: Record<string, FieldIssue> = {};
  fieldIssues(id, params).forEach((i) => { issues[i.key] = i; });
  const groups = groupsOf(id);
  const [openG, setOpenG] = useState<Record<string, boolean>>({});
  const isOpen = (g: string, i: number) => openG[g] ?? i < 3;
  const [flash, setFlash] = useState<string | null>(null);
  const missingKeys = empty.filter((x) => x.startsWith(id + '.')).map((x) => x.slice(id.length + 1));
  // jump to a field the panel was asked to show: open its group, scroll, focus, highlight for a moment
  useEffect(() => {
    if (!focus || focus.kind !== 'dim' || focus.room !== id) return;
    const gi = groups.findIndex((g) => g.fields.some((fd) => fd.key === focus.key));
    if (gi >= 0) setOpenG((o) => ({ ...o, [groups[gi]!.group]: true }));
    setFlash(focus.key);
    const t1 = setTimeout(() => { const el = document.getElementById(`p_${id}_${focus.key}`); el?.scrollIntoView({ block: 'center' }); el?.focus({ preventScroll: true }); }, 60);
    const t2 = setTimeout(() => setFlash(null), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [focus?.nonce]);
  const jump = (key: string) => usePanel.getState().openAt('dims', { kind: 'dim', room: id, key });
  return (
    <div>
      {missingKeys.length > 0 && (
        <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-warning/50 bg-warning/10 p-2 text-sm" role="status">
          <AlertTriangle className="size-4 shrink-0 text-warning" />
          {s.panel.missingHead(missingKeys.length)}
          {missingKeys.map((k) => { const fd = def.fields.find((x) => x.key === k); return <Button key={k} variant="link" size="sm" className="h-auto min-h-11 px-1 underline" onClick={() => jump(k)}>{fd ? fieldLabel(id, fd, model) : k}</Button>; })}
        </p>
      )}
      {groups.map((g, i) => {
        const miss = g.fields.filter((fd) => missingKeys.includes(fd.key)).length;
        const total = g.fields.length;
        return (
          <Section key={g.group} open={isOpen(g.group, i)} onOpenChange={(o) => setOpenG((x) => ({ ...x, [g.group]: o }))}
            title={<span className="flex flex-1 items-center justify-between gap-2"><span>{T_(g.group)}</span><span className={cn('text-xs font-normal tabular-nums', miss ? 'font-semibold text-destructive' : 'text-muted-foreground')} data-count={g.group}>{total - miss}/{total}{miss > 0 && <> <AlertTriangle className="inline size-3.5 align-[-2px]" aria-label={s.panel.missingShort} /></>}</span></span>}>
            <div className="flex flex-col gap-3">
              {g.fields.map((fd) => {
                const fid = `p_${id}_${fd.key}`;
                const label = fieldLabel(id, fd, model);
                const issue = issues[fd.key];
                const hl = flash === fd.key || highlight.includes(fd.key);
                return (
                  <div className={cn('frow grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-3 rounded-md', hl && 'field-hl')} key={fd.key} data-field={fd.key} data-hl={hl ? 'true' : undefined}>
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
        );
      })}
      {featuresHere.length > 0 && (
        <Section title={s.names.featuresTitle} defaultOpen={false}>
          <div className="flex flex-col gap-1">
            {featuresHere.map((f) => <InlineName key={f} value={featureName(id, f)} generic={s.names.features[f]} onCommit={(n) => renameFeature(id, f, n)} />)}
            <p className="text-xs text-muted-foreground">{s.names.resetHint}</p>
          </div>
        </Section>
      )}
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
      <p className="text-xs text-muted-foreground">{id === 'lazienka-2' ? s.room.shiftNoteFlat : s.room.shiftNote(end)}</p>
    </div>
  );
}
