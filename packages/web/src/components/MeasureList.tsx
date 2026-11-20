import { useMemo, useState } from 'react';
import { ROOMS, type RoomId, type RoomModel } from '@slabs/core';
import { surfaceMarks, wrapMark, type SurfaceInfo } from '@slabs/render';
import { drawingLabels as L, nf, s, T_ } from '../i18n';
import { useStore } from '../state/store';
import { IconCheck, IconWarn } from './Icons';
import { MeasureEntry } from './MeasureEntry';

interface Props {
  id: RoomId;
  model: RoomModel;
  list: SurfaceInfo[];
  roomKey: string;
  minStrip: number;
  plateLen: number;
  validate: (param: string, value: number) => string | null;
  /** floor plan of the room, shown for measurements that are not on one surface drawing */
  plan: string;
}

/** Phone: every measurement of the room as a row (missing / entered) with a thumbnail of where it is measured; number entry in a bottom sheet. */
export function MeasureList({ id, model, list, roomKey, minStrip, plateLen, validate, plan }: Props) {
  const empty = useStore((st) => st.empty);
  const params = useStore((st) => st.project.rooms[id].params);
  const setParam = useStore((st) => st.setParam);
  const setEmpty = useStore((st) => st.setEmpty);
  const select = useStore((st) => st.select);
  const [open, setOpen] = useState<string | null>(null);
  const fields = ROOMS[id].fields.filter((f) => f.unit !== 'chk' && !['PL', 'PW', 'ZO', 'XO'].includes(f.key));
  const where = useMemo(() => {
    const out: Record<string, { surf: number; ref: string; html: string }> = {};
    for (const sf of list) {
      const mk = surfaceMarks(model, sf.key, roomKey, { scale: 0.3, minStrip, plateLen, nf: (v) => nf(Math.round(v)), labels: L });
      mk?.measures?.forEach((m) => {
        if (out[m.param]) return;
        const hl = `<line x1="${m.x1}" y1="${m.y1}" x2="${m.x2}" y2="${m.y2}" class="thumb-hl"/>`;
        out[m.param] = { surf: sf.key, ref: sf.ref, html: wrapMark(mk, '').replace(/ role="img" aria-label=""/, ' aria-hidden="true"').replace('</svg>', hl + '</svg>') };
      });
    }
    return out;
  }, [model, list, roomKey, minStrip, plateLen]);
  const missing = fields.filter((f) => empty.includes(`${id}.${f.key}`)).length;
  const cur = open ? fields.find((f) => f.key === open) : undefined;
  const nextKey = (k: string) => {
    const idx = fields.findIndex((f) => f.key === k);
    const rest = [...fields.slice(idx + 1), ...fields.slice(0, idx)];
    return (rest.find((f) => empty.includes(`${id}.${f.key}`)) ?? fields[idx + 1])?.key ?? null;
  };
  return (
    <section className="sect measlist" aria-labelledby="ml-h">
      <h2 id="ml-h">{s.room.measureList}</h2>
      <p className="sub" role="status">{missing ? s.room.measureMissing(missing, fields.length) : s.room.measureAll(fields.length)}</p>
      <ul className="ml">
        {fields.map((f) => {
          const isMissing = empty.includes(`${id}.${f.key}`);
          const w = where[f.key];
          return (
            <li key={f.key}>
              <button type="button" className={'ml-row' + (isMissing ? ' missing' : '')} onClick={() => { setOpen(f.key); if (w) select(id, w.surf); }}>
                <span className="thumb" aria-hidden="true" dangerouslySetInnerHTML={{ __html: w?.html ?? plan }} />
                <span className="ml-nm">{T_(f.label)}{w && <span className="rt"> · {w.ref}</span>}</span>
                <span className="ml-v">{isMissing ? '?' : `${nf(params[f.key] ?? 0)} ${f.unit}`}</span>
                <span className={'st' + (isMissing ? ' warn' : '')}>{isMissing ? <><IconWarn /> {s.room.measureStateMissing}</> : <><IconCheck /> {s.room.measureStateOk}</>}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {cur && (
        <MeasureEntry key={cur.key} name={T_(cur.label)} unit={cur.unit} value={params[cur.key] ?? 0} validate={(v) => validate(cur.key, v)}
          onSave={(v) => { setEmpty(`${id}.${cur.key}`, false); setParam(id, cur.key, v); }} onEmpty={() => setEmpty(`${id}.${cur.key}`, true)}
          onDone={(next) => setOpen(next ? nextKey(cur.key) : null)}>
          <span className="thumb big" aria-hidden="true" dangerouslySetInnerHTML={{ __html: where[cur.key]?.html ?? plan }} />
        </MeasureEntry>
      )}
    </section>
  );
}
