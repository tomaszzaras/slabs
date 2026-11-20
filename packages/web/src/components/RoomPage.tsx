import { useMemo } from 'react';
import { ROOMS, isAttic, type RoomId } from '@slabs/core';
import { sharedSheets, svgBoards, svgGables, svgPlan } from '@slabs/render';
import { s } from '../i18n';
import { buildRequest, hashRequest, roomModel } from '../cut/request';
import { useStore } from '../state/store';
import { ParamForm } from './ParamForm';
import { SheetGrid, Stats, SvgDrawing } from './Svg';

export function RoomPage({ id }: { id: RoomId }) {
  const project = useStore((st) => st.project);
  const resetRoom = useStore((st) => st.resetRoom);
  const entry = useStore((st) => st.cuts[id]);
  const busy = useStore((st) => !!st.running[id]);
  const runCut = useStore((st) => st.runCut);
  const cancelCut = useStore((st) => st.cancelCut);
  const params = project.rooms[id].params;
  const model = useMemo(() => roomModel(project, id), [params, project.settings.trimMm, id]);
  const req = useMemo(() => buildRequest(project, id), [project, id]);
  const fresh = !!entry && entry.key === hashRequest(req);
  const cut = fresh ? entry.result : null;
  const def = ROOMS[id];
  const top: [string, number] = id === 'salon' ? [s.room.stats.topRidge, isAttic(model) ? model.RID : 0] : id === 'lazienka-2' ? [s.room.stats.topRoom, model.TOPH] : [s.room.stats.topAny, model.TOPH];
  const sheets = useMemo(() => (cut ? sharedSheets(cut) : []), [cut]);
  const use = cut ? Math.round(cut.stats.utilisation * 100) : 0;
  return (
    <div className="wrap" data-room={id}>
      <header>
        <div>
          <h1>{def.name}</h1>
          <p>Wpisz wymiary z pomiaru, a rysunki, długości desek i punkty startu montażu przeliczą się same. Wymiary w centymetrach.</p>
        </div>
        <div className="actions"><button type="button" onClick={() => resetRoom(id)}>{s.room.reset}</button></div>
      </header>
      <div className="grid">
        <aside aria-label={s.room.dimensions}><ParamForm id={id} model={model} /></aside>
        <main>
          <div className="card">
            <h2>{s.room.summary}</h2>
            <Stats items={[
              [cut ? cut.stats.grossM2.toFixed(1) + ' m²' : '–', s.room.stats.gross],
              [model.areaM2.toFixed(1) + ' m²', s.room.stats.net],
              [model.fields, s.room.stats.fields],
              [model.minPlates, s.room.stats.minPlates],
              [cut ? cut.plates.length : '–', s.room.stats.cutPlates],
              [Math.round(top[1]) + ' cm', top[0]],
            ]} />
            {model.warn.length > 0 && <p className="warn" role="alert">{s.room.corrected(model.warn.join('; '))}</p>}
          </div>
          <div className="card">
            <h2>{s.room.refs}</h2>
            <p className="cap">{s.room.refsCap}</p>
            <div className="tbl">
              <table>
                <thead><tr>{s.room.refsHead.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{model.refs.map((r) => <tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{r.fields}</td><td>{r.where}</td><td>{r.coord}</td></tr>)}</tbody>
              </table>
            </div>
            {isAttic(model) && <p className="note">{s.room.refsNoteAttic}</p>}
          </div>
          <div className="card">
            <h2>{s.room.cut}</h2>
            <div className="opts">
              {busy
                ? <button type="button" onClick={() => cancelCut(id)}>{s.shared.cancel}</button>
                : <button type="button" className="pri" onClick={() => runCut(id, req)}>{s.room.cutBtn}</button>}
              {busy && <span className="status">{s.shared.running}</span>}
            </div>
            <p className="cap">
              {cut ? s.room.cutCap(Math.round(cut.PL), Math.round(cut.PW), cut.plates.length, use) : entry ? s.room.cutStale : s.room.cutHint}
            </p>
            {cut && cut.oversize.length > 0 && <p className="warn">{s.shared.oversize(cut.oversize.map((o) => o.ids.join('+')).join(', '))}</p>}
            <SheetGrid sheets={sheets} />
          </div>
          <div className="card"><h2>{s.room.plan}</h2><p className="cap">{s.room.planCap}</p><SvgDrawing d={svgPlan(model)} /></div>
          <div className="card"><h2>{s.room.boards}</h2><p className="cap">{s.room.boardsCap}</p><SvgDrawing d={svgBoards(model)} /></div>
          <div className="card"><h2>{s.room.gables}</h2><p className="cap">{s.room.gablesCap}</p><SvgDrawing d={svgGables(model)} /></div>
        </main>
      </div>
    </div>
  );
}
