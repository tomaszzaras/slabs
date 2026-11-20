import { useMemo } from 'react';
import { isAttic, roomSlivers, type RoomId } from '@slabs/core';
import { sharedSheets, svgBoards, svgGables, svgPlan } from '@slabs/render';
import { drawingLabels as L, lang, nf, roomName, s } from '../i18n';
import { buildRequest, hashRequest, roomModel } from '../cut/request';
import { useStore } from '../state/store';
import { Blocking, pieceLabel } from './Issues';
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
  const model = useMemo(() => roomModel(project, id, lang), [params, project.settings.trimMm, id, lang]);
  const req = useMemo(() => buildRequest(project, id), [project, id]);
  const fresh = !!entry && entry.key === hashRequest(req);
  const cut = entry?.result ?? null; // an out-of-date result stays visible, dimmed and labelled
  const blocked = !!cut && cut.blocking.length > 0;
  const slivers = useMemo(() => roomSlivers(model, project.settings.minStripCm), [model, project.settings.minStripCm]);
  const top: [string, number] = id === 'salon' ? [s.room.stats.topRidge, isAttic(model) ? model.RID : 0] : id === 'lazienka-2' ? [s.room.stats.topRoom, model.TOPH] : [s.room.stats.topAny, model.TOPH];
  const sheets = useMemo(() => (cut && !blocked ? sharedSheets(cut, L) : []), [cut, blocked]);
  const use = cut ? Math.round(cut.stats.utilisation * 100) : 0;
  return (
    <div className="wrap" data-room={id}>
      <header>
        <div>
          <h1>{roomName(id)}</h1>
          <p>{s.room.intro}</p>
        </div>
        <div className="actions"><button type="button" onClick={() => resetRoom(id)}>{s.history.resetBtn}</button></div>
      </header>
      <div className="grid">
        <aside aria-label={s.room.dimensions}><ParamForm id={id} model={model} /></aside>
        <main>
          <div className="card">
            <h2>{s.room.summary}</h2>
            <Stats items={[
              [cut && !blocked ? nf(cut.stats.grossM2, 1) + ' m²' : '–', s.room.stats.gross],
              [nf(model.areaM2, 1) + ' m²', s.room.stats.net],
              [model.fields, s.room.stats.fields],
              [model.minPlates, s.room.stats.minPlates],
              [cut && !blocked ? cut.plates.length : '–', s.room.stats.cutPlates],
              [Math.round(top[1]) + ' cm', top[0]],
            ]} />
            {slivers.length > 0 && (
              <p className="warn" role="status">{s.room.slivers(slivers.length, project.settings.minStripCm)}: {slivers.map((v) => s.room.sliverItem(v.ref, v.id, nf(v.width, 1))).join('; ')}</p>
            )}
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
            {entry && !fresh && <p className="warn"><span className="badge">{s.room.stale}</span> {s.room.staleNote}</p>}
            {!entry && <p className="cap">{s.room.cutHint}</p>}
            {cut && !blocked && <p className="cap">{s.room.cutCap(Math.round(cut.PL), Math.round(cut.PW), cut.plates.length, use)}</p>}
            {cut && !blocked && cut.splitCount > 0 && <p className="note">{s.room.splitNote(cut.splitCount)}</p>}
            {cut && cut.clamped.length > 0 && <p className="note">{s.room.clampedNote(cut.clamped.map((c) => pieceLabel(c.room, c.ids, c.seg)).join(', '))}</p>}
            {cut && <Blocking issues={cut.blocking} />}
            <div className={entry && !fresh ? 'stale' : undefined}><SheetGrid sheets={sheets} /></div>
          </div>
          <div className="card"><h2>{s.room.plan}</h2><p className="cap">{s.room.planCap}</p><SvgDrawing d={svgPlan(model, L)} /></div>
          <div className="card"><h2>{s.room.boards}</h2><p className="cap">{s.room.boardsCap}</p><SvgDrawing d={svgBoards(model, L)} /></div>
          <div className="card"><h2>{s.room.gables}</h2><p className="cap">{s.room.gablesCap}</p><SvgDrawing d={svgGables(model, L)} /></div>
        </main>
      </div>
    </div>
  );
}
