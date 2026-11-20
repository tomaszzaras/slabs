import { useState } from 'react';
import { ROOMS, fieldIssues, isAttic, type FieldIssue, type RoomId, type RoomModel } from '@slabs/core';
import { T_, s } from '../i18n';
import { useStore } from '../state/store';
import { CheckField, NumField } from './Fields';
import { IconHelp, IconLeft, IconRight } from './Icons';

/** The other inputs a bound depends on, with their current values, for the explanation under the field. */
export function becauseOf(issue: FieldIssue, id?: RoomId, params?: Record<string, number>): Array<{ name: string; value: number; unit: string }> {
  const room = id ?? useStore.getState().tab;
  if (!(room in ROOMS)) return [];
  const def = ROOMS[room as RoomId];
  const pr = params ?? useStore.getState().project.rooms[room as RoomId].params;
  return issue.because.flatMap((k) => { const f = def.fields.find((x) => x.key === k); return f ? [{ name: T_(f.label), value: pr[k] ?? 0, unit: f.unit }] : []; });
}

/** "?" next to a field: opens a few plain words on what to measure and where. */
function HelpTip({ id, name, text }: { id: string; name: string; text?: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <>
      <button type="button" className="quiet helpbtn" aria-label={s.room.helpBtn(name)} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><IconHelp /></button>
      {open && <p id={id} className="help" role="note">{text}</p>}
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
  def.fields.forEach((fd) => { (groups[fd.group] ??= []).push(fd); });
  return (
    <>
      {Object.keys(groups).map((g, i) => (
        <details key={g} open={i < 3}>
          <summary>{T_(g)}</summary>
          <div className="fields">
            {groups[g]!.map((fd) => {
              const fid = `p_${id}_${fd.key}`;
              let label = T_(fd.label);
              if (fd.key === 'capH' && model.p.capMin && isAttic(model)) label += ` (${s.room.minMax(model.p.capMin, Math.floor(model.RID - 1))})`;
              const issue = issues[fd.key];
              return (
                <div className="frow" key={fd.key}>
                  <div className="lab"><label htmlFor={fid}>{label}</label><HelpTip id={`h_${id}_${fd.key}`} name={label} text={s.room.help[fd.key]} /></div>
                  <div className="in">
                    {fd.unit === 'chk' ? (
                      <CheckField id={fid} checked={!!params[fd.key]} onChange={(v) => setParam(id, fd.key, v ? 1 : 0)} />
                    ) : (
                      <>
                        <NumField id={fid} value={params[fd.key] ?? 0} empty={def.defaults[fd.key]} onValue={(v) => setParam(id, fd.key, v)} name={label} error={issue && s.room.issue(label, issue.kind, issue.bound, fd.unit, becauseOf(issue, id))} correctTo={issue?.bound} track={`${id}.${fd.key}`} />
                        <span className="unit">{fd.unit}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      ))}
      <p className="note">{s.room.clampNote}</p>
    </>
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
    <div>
      <div className="stepbar">
        <label htmlFor={`step_${id}`}>{s.room.step}</label>
        <select id={`step_${id}`} value={step} onChange={(e) => setStep(Number(e.target.value))}>
          {[1, 5, 10, 25].map((v) => <option key={v} value={v}>{v} cm</option>)}
        </select>
        <button type="button" onClick={() => { setParams(id, Object.fromEntries(Array.from({ length: 9 }, (_v, i) => ['o' + (i + 1), 0]))); showToast(s.history.zeroDone, true); }}>{s.room.zero}</button>
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
          <div className={'shift' + (selected === i ? ' sel' : '')} key={i} onFocus={() => onSelect(i)}>
            <button type="button" className="rn quiet" aria-pressed={selected === i} aria-label={`R${i} – ${name}`} onClick={() => onSelect(i)}>R{i}</button>
            <span className="rt">{name}</span>
            <button type="button" aria-label={s.room.shiftLeft(i, name)} onClick={() => bump(-1)}><IconLeft /></button>
            <div className="in"><NumField id={`o_${id}_${i}`} value={v} label={s.room.shiftValue(i)} onValue={(x) => setParam(id, 'o' + i, x)} name={s.room.shiftValue(i)} error={issue && s.room.issue(s.room.shiftValue(i), issue.kind, issue.bound, 'cm', becauseOf(issue, id))} correctTo={issue?.bound} track={`${id}.o${i}`} /></div>
            <button type="button" aria-label={s.room.shiftRight(i, name)} onClick={() => bump(1)}><IconRight /></button>
          </div>
        );
      })}
      <button type="button" className="quiet" aria-pressed={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? s.room.onlySelected : s.room.allStarts}</button>
      <p className="note">{id === 'lazienka-2' ? s.room.shiftNoteFlat : s.room.shiftNote(end)}</p>
    </div>
  );
}
