import { useEffect } from 'react';
import { asRect, rectPts, type Opening, type RoomId } from '@slabs/core';
import type { SurfaceMap } from '@slabs/render';
import { nf, s } from '../i18n';
import { useStore } from '../state/store';
import { NumField } from './Fields';
import { addVertex, newOpeningPts } from './openingEdit';
import { IconPlus, IconClose } from './Icons';
import { InlineName } from './InlineName';

const newId = () => 'o' + Math.random().toString(36).slice(2, 8);
const MAX = 6;

/** Add, select, resize and remove the windows, doors and cut-outs of the drawn surface; numbers for precision and for the phone. */
export function OpeningsPanel({ id, surface, gable, map }: { id: RoomId; surface: number; gable: boolean; map: SurfaceMap | undefined }) {
  const all = useStore((st) => st.project.openings[id]);
  const selId = useStore((st) => st.selOpening);
  const { addOpening, setOpening, removeOpening, selectOpening, showToast, renameOpening } = useStore.getState();
  const here = all.filter((o) => o.surface === surface);
  useEffect(() => { document.querySelector('.ol li.sel')?.scrollIntoView({ block: 'nearest' }); }, [selId]);
  const add = (kind: 'window' | 'door' | 'cutout' | 'polygon') => {
    if (!map) return;
    if (all.length >= MAX) { showToast(s.openings.full); return; }
    addOpening(id, { id: newId(), kind: kind === 'polygon' ? 'cutout' : kind, surface, pts: newOpeningPts(kind, map) });
  };
  const aLab = gable ? s.openings.aGable : s.openings.aBoard, bLab = gable ? s.openings.bGable : s.openings.bBoard;
  const set = (o: Opening, patch: Partial<{ a: number; b: number; w: number; h: number }>) => {
    const r = asRect(o.pts);
    if (!r || !map) return;
    const n = { ...r, ...patch };
    const { a0, a1, b0, b1 } = map.bounds;
    const w = Math.max(5, Math.min(a1 - a0, n.w)), h = Math.max(5, Math.min(b1 - b0, n.h));
    const a = Math.max(a0, Math.min(a1 - w, n.a)), b = Math.max(b0, Math.min(b1 - h, n.b));
    setOpening(id, o.id, rectPts(a, b, w, h));
  };
  return (
    <section className="sect" aria-labelledby="open-h">
      <h2 id="open-h">{s.openings.title}</h2>
      <p className="sub">{s.openings.note}</p>
      <div className="opts">
        <button type="button" onClick={() => add('window')}><IconPlus /> {s.openings.addWindow}</button>
        <button type="button" onClick={() => add('door')}><IconPlus /> {s.openings.addDoor}</button>
        <button type="button" onClick={() => add('cutout')}><IconPlus /> {s.openings.addCut}</button>
        <button type="button" onClick={() => add('polygon')}><IconPlus /> {s.openings.addPoly}</button>
      </div>
      {!here.length && <p className="note">{s.openings.none}</p>}
      <ul className="ol">
        {here.map((o, i) => {
          const r = asRect(o.pts);
          const generic = `${s.openings.kinds[o.kind]} ${i + 1}`;
          const name = o.name || generic;
          const sel = selId === o.id;
          return (
            <li key={o.id} className={sel ? 'sel' : undefined}>
              <div className="ol-head">
                <button type="button" aria-pressed={sel} onClick={() => selectOpening(sel ? null : o.id)}>{name}</button>
                <InlineName value={name} generic={generic} label={name} onCommit={(n) => renameOpening(id, o.id, n)} className="ml-auto" />
                <button type="button" aria-label={`${s.openings.remove}: ${name}`} title={s.openings.remove} onClick={() => removeOpening(id, o.id)}><IconClose /></button>
              </div>
              {r ? (
                <div className="ol-fields">
                  {([['a', aLab], ['b', bLab], ['w', s.openings.width], ['h', s.openings.height]] as const).map(([k, lab]) => (
                    <div className="frow" key={k}>
                      <label htmlFor={`op_${o.id}_${k}`}>{lab}</label>
                      <div className="in"><NumField id={`op_${o.id}_${k}`} value={Math.round(r[k] * 10) / 10} onValue={(v) => set(o, { [k]: v })} /><span className="unit">cm</span></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ol-fields">
                  <p className="note">{s.openings.polygonInfo(o.pts.length)}</p>
                  <button type="button" onClick={() => setOpening(id, o.id, addVertex(o.pts as Array<[number, number]>))}>{s.openings.addVertex}</button>
                  <p className="note">{o.pts.map((q) => `(${nf(q[0], 0)} ; ${nf(q[1], 0)})`).join(' ')}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
