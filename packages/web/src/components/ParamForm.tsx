import { useState } from 'react';
import { ROOMS, fieldIssues, isAttic, type FieldIssue, type RoomId, type RoomModel } from '@slabs/core';
import { s } from '../i18n';
import { useStore } from '../state/store';
import { CheckField, NumField } from './Fields';

/** Dimension form generated from the room's field table. */
export function ParamForm({ id, model }: { id: RoomId; model: RoomModel }) {
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
          <summary>{g}</summary>
          <div className="fields">
            {groups[g]!.map((fd) => {
              const fid = `p_${id}_${fd.key}`;
              let label = fd.label;
              if (fd.key === 'capH' && model.p.capMin && isAttic(model)) label += ` (min. ${model.p.capMin}, max ${Math.floor(model.RID - 1)})`;
              return (
                <div className="frow" key={fd.key}>
                  <label htmlFor={fid}>{label}</label>
                  <div className="in">
                    {fd.unit === 'chk' ? (
                      <CheckField id={fid} checked={!!params[fd.key]} onChange={(v) => setParam(id, fd.key, v ? 1 : 0)} />
                    ) : (
                      <>
                        <NumField id={fid} value={params[fd.key] ?? 0} empty={def.defaults[fd.key]} onValue={(v) => setParam(id, fd.key, v)} error={issues[fd.key] && s.room.issue(fd.label, issues[fd.key]!.kind, issues[fd.key]!.bound, fd.unit)} correctTo={issues[fd.key]?.bound} />
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
      <ShiftControls id={id} model={model} />
      <p className="note">{s.room.clampNote}</p>
    </>
  );
}

function ShiftControls({ id, model }: { id: RoomId; model: RoomModel }) {
  const params = useStore((st) => st.project.rooms[id].params);
  const setParam = useStore((st) => st.setParam);
  const names = ROOMS[id].shiftNames;
  const issues: Record<string, FieldIssue> = {};
  fieldIssues(id, params).forEach((i) => { issues[i.key] = i; });
  const [step, setStep] = useState(5);
  const end = id === 'lazienka-1' ? 'łazienki' : 'salonu';
  return (
    <details open>
      <summary>{s.room.shifts}</summary>
      <div className="stepbar">
        <label htmlFor={`step_${id}`}>{s.room.step}</label>
        <select id={`step_${id}`} value={step} onChange={(e) => setStep(Number(e.target.value))}>
          {[1, 5, 10, 25].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <span className="unit">cm</span>
        <button type="button" onClick={() => { for (let i = 1; i <= 9; i++) setParam(id, 'o' + i, 0); }}>{s.room.zero}</button>
      </div>
      {names.map((nm, idx) => {
        const i = idx + 1;
        if (!model.present[i]) return null;
        const v = params['o' + i] ?? 0;
        const bump = (d: number) => setParam(id, 'o' + i, Math.round((v + d * step) * 10) / 10);
        return (
          <div className="shift" key={i}>
            <span className="rn">R{i}</span>
            <span className="rt">{nm}</span>
            <button type="button" aria-label={s.room.shiftLeft(i)} onClick={() => bump(-1)}>◀</button>
            <NumField id={`o_${id}_${i}`} value={v} label={s.room.shiftValue(i)} onValue={(x) => setParam(id, 'o' + i, x)} error={issues['o' + i] && s.room.issue(s.room.shiftValue(i), issues['o' + i]!.kind, issues['o' + i]!.bound, 'cm')} correctTo={issues['o' + i]?.bound} />
            <button type="button" aria-label={s.room.shiftRight(i)} onClick={() => bump(1)}>▶</button>
          </div>
        );
      })}
      <p className="note">{id === 'lazienka-2' ? s.room.shiftNoteFlat : s.room.shiftNote(end)}</p>
    </details>
  );
}
