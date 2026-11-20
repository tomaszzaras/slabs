import { useMemo, useState } from 'react';
import { ROOMS, fieldIssues, isAttic, roomSlivers, type RoomId } from '@slabs/core';
import { fitScale, planMarks, surfaceList, surfaceMarks, surfaceWidthCm, wrapMark } from '@slabs/render';
import { drawingLabels as L, lang, nf, roomName, s, T_ } from '../i18n';
import { buildRequest, hashRequest, roomModel } from '../cut/request';
import { useStore } from '../state/store';
import { IconCheck, IconMinus, IconPlus, IconSplit, IconWarn } from './Icons';
import { Blocking, pieceLabel } from './Issues';
import { ExportButtons } from './ExportButtons';
import { Dimensions, StartPoints, becauseOf } from './ParamForm';
import { MeasureList } from './MeasureList';
import { useWidth } from './Pan';
import { SurfaceEditor } from './SurfaceEditor';
import { SettingsPanel } from './SettingsPanel';
import { SheetGrid, Stats } from './Svg';

/** Legend of the marks, drawn with the same classes as the drawing so print and screen agree. */
function Legend() {
  const sw = (inner: string) => <svg viewBox="0 0 28 16" aria-hidden="true" dangerouslySetInnerHTML={{ __html: inner }} />;
  return (
    <ul className="legend" aria-label={s.room.legendTitle}>
      <li>{sw('<line x1="1" y1="8" x2="27" y2="8" class="mk-chalk"/>')}{s.room.legend.chalk}</li>
      <li>{sw('<line x1="6" y1="2" x2="6" y2="14" class="mk-start-tick"/><line x1="8" y1="8" x2="26" y2="8" class="mk-arrow"/>')}{s.room.legend.start}</li>
      <li>{sw('<path d="M3 2L25 14M25 2L3 14" class="mk-x"/>')}{s.room.legend.waste}</li>
      <li>{sw('<circle cx="14" cy="8" r="6" class="mk-face"/><circle cx="14" cy="8" r="1.8" class="mk-face-dot"/>')}{s.room.legend.face}</li>
      <li>{sw('<line x1="1" y1="8" x2="27" y2="8" class="mk-fold"/>')}{s.room.legend.fold}</li>
      <li>{sw('<line x1="1" y1="8" x2="27" y2="8" class="mk-split"/>')}{s.room.legend.split}</li>
    </ul>
  );
}

export function RoomScreen({ id }: { id: RoomId }) {
  const project = useStore((st) => st.project);
  const selectedMap = useStore((st) => st.selected);
  const select = useStore((st) => st.select);
  const entry = useStore((st) => st.cuts[id]);
  const busy = useStore((st) => !!st.running[id]);
  const resetRoom = useStore((st) => st.resetRoom);
  const { runCut, cancelCut } = useStore.getState();
  const params = project.rooms[id].params;
  const model = useMemo(() => roomModel(project, id, lang), [params, project.settings.trimMm, id, lang]);
  const key = ROOMS[id].key;
  const minStrip = project.settings.minStripCm;
  const plateLen = (model.p.PL ?? 0) - 2 * (model.p.trim ?? 0);
  const list = useMemo(() => surfaceList(model, minStrip, plateLen), [model, minStrip, plateLen]);
  const selKey = list.some((x) => x.key === selectedMap[id]) ? selectedMap[id]! : list[0]!.key;
  const sel = list.find((x) => x.key === selKey)!;
  const slivers = useMemo(() => roomSlivers(model, minStrip), [model, minStrip]);
  const [zoom, setZoom] = useState(1);
  const [planOpen, setPlanOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 761);
  const [frameRef, frameW] = useWidth<HTMLDivElement>();
  const scale = fitScale(surfaceWidthCm(model, selKey), frameW || 800) * zoom;
  const nfi = (v: number) => nf(Math.round(v * 10) / 10, Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1);
  const marks = useMemo(() => surfaceMarks(model, selKey, key, { scale, minStrip, plateLen, nf: nfi, labels: L }), [model, selKey, scale, minStrip, plateLen, key]);
  const drawing = useMemo(() => (marks ? wrapMark(marks, `${sel.ref}: ${T_(sel.title)}`) : ''), [marks, sel.ref, sel.title]);
  const setParam = useStore((st) => st.setParam);
  const empty = useStore((st) => st.empty);
  const setEmpty = useStore((st) => st.setEmpty);
  const validate = (param: string, value: number): string | null => {
    const issue = fieldIssues(id, { ...params, [param]: value }).find((i) => i.key === param);
    if (!issue) return null;
    const fd = ROOMS[id].fields.find((x) => x.key === param);
    return s.room.issue(fd ? T_(fd.label) : param, issue.kind, issue.bound, fd?.unit ?? 'cm', becauseOf(issue, id, { ...params, [param]: value }));
  };
  const missingHere = empty.some((x) => x.startsWith(id + '.'));
  const nameOf = (param: string) => { const f = ROOMS[id].fields.find((x) => x.key === param); return f ? T_(f.label) : param; };
  const planWidthCm = isAttic(model) ? (model.XT !== undefined ? model.XR - model.XT : model.p.W!) : model.p.bx!;
  const miniScale = Math.min(0.5, 190 / Math.max(100, planWidthCm));
  const mini = useMemo(() => wrapMark(planMarks(model, key, { scale: miniScale, minStrip, plateLen, nf: nfi, labels: L }), s.room.plan), [model, key, miniScale, minStrip, plateLen]);

  const req = useMemo(() => buildRequest(project, id), [project, id]);
  const fresh = !!entry && entry.key === hashRequest(req);
  const cut = entry?.result ?? null;
  const blocked = !!cut && cut.blocking.length > 0;
  const use = cut ? Math.round(cut.stats.utilisation * 100) : 0;
  const top: [string, number] = id === 'salon' ? [s.room.stats.topRidge, isAttic(model) ? model.RID : 0] : id === 'lazienka-2' ? [s.room.stats.topRoom, model.TOPH] : [s.room.stats.topAny, model.TOPH];
  const ref = model.refs.find((r) => r.id === sel.ref);
  const stateOf = (x: (typeof list)[number]) => x.slivers ? { warn: true, text: s.room.stateSliver(x.slivers) } : x.splitNote ? { warn: false, text: s.room.stateSplit } : { warn: false, text: s.room.stateOk };

  return (
    <div className="shell" data-room={id}>
      <div className="col left">
        <details className="planfold" open={planOpen} onToggle={(e) => setPlanOpen((e.currentTarget as HTMLDetailsElement).open)}>
          <summary><h2>{s.room.floorPlan}</h2></summary>
          <div className="minimap" dangerouslySetInnerHTML={{ __html: mini }} />
        </details>
        <nav className="surfnav" aria-labelledby="surf-h">
          <h2 id="surf-h">{s.room.surfaces}</h2>
          <ul className="surf-list">
            {list.map((x) => {
              const st = stateOf(x);
              return (
                <li key={x.key}>
                  <button type="button" className="surf" aria-current={x.key === selKey} onClick={() => select(id, x.key)} data-ref={x.ref}>
                    <span className="chip" aria-hidden="true">{x.ref}</span>
                    <span className="nm"><span className="sr">{x.ref}: </span>{T_(x.title)}</span>
                    <span className={'st' + (st.warn ? ' warn' : '')}>{st.warn ? <IconWarn /> : x.splitNote ? <IconSplit /> : <IconCheck />}{st.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <main id="main" className="col centre">
        <div>
          <h1>{roomName(id)}</h1>
          <p className="sub">{s.room.intro}</p>
        </div>

        <section className="sect" aria-labelledby="surface-h">
          <h2 id="surface-h">{sel.ref} – {T_(sel.title)}</h2>
          <div className="sheet">
            <div className="sheet-bar">
              <span className="grow hint">{s.room.dragHint}</span>
              <button type="button" aria-label={s.room.zoomOut} title={s.room.zoomOut} onClick={() => setZoom(Math.max(0.5, zoom / 1.25))}><IconMinus /></button>
              <button type="button" aria-label={s.room.zoomIn} title={s.room.zoomIn} onClick={() => setZoom(Math.min(3, zoom * 1.25))}><IconPlus /></button>
            </div>
            <div ref={frameRef}>{marks && <SurfaceEditor html={drawing} drawing={marks} onShift={(p, v) => setParam(id, p, v)} onMeasure={(p, v) => { setEmpty(`${id}.${p}`, false); setParam(id, p, v); }} validate={validate} onEmpty={(p) => setEmpty(`${id}.${p}`, true)} onPinch={(f) => setZoom((z) => Math.max(0.5, Math.min(3, z * f)))} empty={empty.filter((x) => x.startsWith(id + '.')).map((x) => x.slice(id.length + 1))} nameOf={nameOf} />}</div>
          </div>
          <Legend />
        </section>

        <MeasureList id={id} model={model} list={list} roomKey={key} minStrip={minStrip} plateLen={plateLen} validate={validate} plan={mini} />

        <section className="sect" aria-labelledby="sum-h">
          <h2 id="sum-h">{s.room.summary}</h2>
          <div className="facts">
            <Stats items={missingHere ? [
              ['–', s.room.stats.net], ['–', s.room.stats.fields], ['–', s.room.stats.minPlates], ['–', top[0]], ['–', s.room.stats.gross], ['–', s.room.stats.cutPlates],
            ] : [
              [nf(model.areaM2, 1) + ' m²', s.room.stats.net],
              [model.fields, s.room.stats.fields],
              [model.minPlates, s.room.stats.minPlates],
              [Math.round(top[1]) + ' cm', top[0]],
              [cut && !blocked ? nf(cut.stats.grossM2, 1) + ' m²' : '–', s.room.stats.gross],
              [cut && !blocked ? cut.plates.length : '–', s.room.stats.cutPlates],
            ]} />
          </div>
          {missingHere && <p className="warn warnbox" role="status"><IconWarn /> {s.room.missingDims}: {empty.filter((x) => x.startsWith(id + '.')).map((x) => nameOf(x.slice(id.length + 1))).join('; ')}</p>}
          {slivers.length > 0 && !missingHere && (
            <p className="warn warnbox" role="status"><IconWarn /> {s.room.slivers(slivers.length, minStrip)}: {slivers.map((v) => s.room.sliverItem(v.ref, v.id, nf(v.width, 1))).join('; ')}</p>
          )}
        </section>

        <section className="sect" aria-labelledby="cut-h">
          <h2 id="cut-h">{s.room.cut}</h2>
          <div className="opts">
            {busy
              ? <button type="button" onClick={() => cancelCut(id)}>{s.shared.cancel}</button>
              : <button type="button" onClick={() => runCut(id, req)}>{s.room.cutBtn}</button>}
            {busy && <span className="muted" role="status">{s.shared.running}</span>}
          </div>
          {entry && !fresh && <p className="warn"><span className="badge">{s.room.stale}</span> {s.room.staleNote}</p>}
          {!entry && (
            <div className="empty"><b>{s.room.emptyCutTitle}</b><p>{s.room.cutHint}</p></div>
          )}
          {cut && !blocked && <p className="sub">{s.room.cutCap(Math.round(cut.PL), Math.round(cut.PW), cut.plates.length, use)}</p>}
          {cut && !blocked && cut.splitCount > 0 && <p className="note">{s.room.splitNote(cut.splitCount)}</p>}
          {cut && cut.clamped.length > 0 && <p className="note">{s.room.clampedNote(cut.clamped.map((c) => pieceLabel(c.room, c.ids, c.seg)).join(', '))}</p>}
          {cut && <Blocking issues={cut.blocking} />}
          {cut && <ExportButtons R={cut} title={roomName(id)} />}
          <div className={entry && !fresh ? 'stale' : undefined}>{cut && !blocked && <SheetGrid R={cut} minOffcut={project.settings.minOffcutCm} minStrip={minStrip} />}</div>
        </section>
      </main>

      <aside className="col right" aria-label={s.room.inspector}>
        <section className="sect" aria-labelledby="dim-h">
          <h2 id="dim-h">{s.room.dimensions}</h2>
          <Dimensions id={id} model={model} />
          <button type="button" onClick={() => resetRoom(id)}>{s.history.resetBtn}</button>
        </section>
        <section className="sect" aria-labelledby="sp-h">
          <h2 id="sp-h">{s.room.startPoints}</h2>
          <p className="sub">{s.room.startCap}</p>
          <StartPoints id={id} model={model} selected={selKey} onSelect={(k) => select(id, k)} />
          {ref && (
            <details>
              <summary>{s.room.refsOne(ref.id)}</summary>
              <p className="note">{ref.where}</p>
              <p className="note">{ref.coord}</p>
              <p className="note">{s.room.fieldsOf(ref.fields)}</p>
            </details>
          )}
        </section>
        <section className="sect" aria-labelledby="refs-h">
          <h2 id="refs-h">{s.room.refs}</h2>
          <details>
            <summary>{s.room.refsTable}</summary>
            <p className="sub">{s.room.refsCap}</p>
            <div className="tbl">
              <table>
                <thead><tr>{s.room.refsHead.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{model.refs.map((r) => <tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{r.fields}</td><td>{r.where}</td><td>{r.coord}</td></tr>)}</tbody>
              </table>
            </div>
            {isAttic(model) && <p className="note">{s.room.refsNoteAttic}</p>}
          </details>
        </section>
        <SettingsPanel />
      </aside>
    </div>
  );
}
