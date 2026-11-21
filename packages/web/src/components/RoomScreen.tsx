import { lazy, Suspense, useMemo, useState } from 'react';
import { ROOMS, fieldIssues, isAttic, roomSlivers, type RoomId } from '@slabs/core';
import { fitScale, planMarks, surfaceList, surfaceMarks, surfaceWidthCm, wrapMark } from '@slabs/render';
import { customSurfaceName, drawingLabels as L, genericRoomName, lang, nf, roomName, s, T_ } from '../i18n';
import { InlineName } from './InlineName';
import { buildRequest, genericSurfaceName, hashRequest, roomModel } from '../cut/request';
import { useStore } from '../state/store';
import { AlertTriangle, Check, Minus, Plus, Scissors, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Section } from '@/components/ui/collapsible';
import { Blocking, pieceLabel } from './Issues';
import { ExportButtons } from './ExportButtons';
import { Dimensions, StartPoints, becauseOf } from './ParamForm';
import { MeasureList } from './MeasureList';
import { OpeningsPanel } from './OpeningsPanel';
import { useWidth } from './Pan';
import { SurfaceEditor } from './SurfaceEditor';
import { SettingsPanel } from './SettingsPanel';
import { MeasurePanel, PanelRail, PanelStrip, usePanelShortcut } from './MeasurePanel';
import { usePanel } from '../state/panel';
import { SheetGrid, Stats } from './Svg';

const View3D = lazy(() => import('./View3D'));

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
  const { runCut, cancelCut, renameRoom, renameSurface } = useStore.getState();
  const params = project.rooms[id].params;
  const model = useMemo(() => roomModel(project, id, lang), [params, project.settings.trimMm, project.settings.plate, project.names, id, lang]);
  const key = ROOMS[id].key;
  const minStrip = project.settings.minStripCm;
  const plateLen = (model.p.PL ?? 0) - 2 * (model.p.trimL ?? model.p.trim ?? 0);
  const list = useMemo(() => surfaceList(model, minStrip, plateLen), [model, minStrip, plateLen]);
  const selKey = list.some((x) => x.key === selectedMap[id]) ? selectedMap[id]! : list[0]!.key;
  const sel = list.find((x) => x.key === selKey)!;
  const genericSurfaceLabel = customSurfaceName(id, selKey) ? genericSurfaceName(project, id, selKey) || sel.label : sel.label;
  const slivers = useMemo(() => roomSlivers(model, minStrip), [model, minStrip]);
  usePanelShortcut();
  const [zoom, setZoom] = useState(1);
  const [show3d, setShow3d] = useState(false);
  const [planOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 761);
  const [frameRef, frameW] = useWidth<HTMLDivElement>();
  const scale = fitScale(surfaceWidthCm(model, selKey), frameW || 800) * zoom;
  const nfi = (v: number) => nf(Math.round(v * 10) / 10, Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1);
  const roomOpenings = project.openings[id];
  const surfOpenings = useMemo(() => roomOpenings.filter((o) => o.surface === selKey), [roomOpenings, selKey]);
  const selOpening = useStore((st) => st.selOpening);
  const { selectOpening, setOpening, removeOpening } = useStore.getState();
  const marks = useMemo(() => surfaceMarks(model, selKey, key, { scale, minStrip, plateLen, nf: nfi, labels: L, openings: surfOpenings }), [model, selKey, scale, minStrip, plateLen, key, surfOpenings, lang]);
  const drawing = useMemo(() => (marks ? wrapMark(marks, `${sel.ref}: ${sel.label}`) : ''), [marks, sel.ref, sel.label]);
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
  const miniScale = Math.min(0.3, 150 / Math.max(100, planWidthCm));
  const mini = useMemo(() => wrapMark(planMarks(model, key, { scale: miniScale, minStrip, plateLen, nf: nfi, labels: L }), s.room.plan), [model, key, miniScale, minStrip, plateLen]);

  const req = useMemo(() => buildRequest(project, id), [project, id]);
  const piecesN = req.rooms.reduce((a, r) => a + r.pieces.length, 0);
  const fresh = !!entry && entry.key === hashRequest(req);
  const cut = entry?.result ?? null;
  const blocked = !!cut && cut.blocking.length > 0;
  const use = cut ? Math.round(cut.stats.utilisation * 100) : 0;
  const top: [string, number] = id === 'salon' ? [s.room.stats.topRidge, isAttic(model) ? model.RID : 0] : id === 'lazienka-2' ? [s.room.stats.topRoom, model.TOPH] : [s.room.stats.topAny, model.TOPH];
  const ref = model.refs.find((r) => r.id === sel.ref);
  const stateOf = (x: (typeof list)[number]) => x.slivers ? { warn: true, text: s.room.stateSliver(x.slivers) } : x.splitNote ? { warn: false, text: s.room.stateSplit } : { warn: false, text: s.room.stateOk };

  return (
    <div className="shell mx-auto flex max-w-[1760px] flex-col md:grid md:grid-cols-[14rem_minmax(0,1fr)_auto]" data-room={id}>
      <div className="left p-4 max-md:contents md:sticky md:top-[var(--barh,112px)] md:max-h-[calc(100vh-var(--barh,112px))] md:self-start md:overflow-auto">
        <div className="planfold max-md:order-4 max-md:px-4 max-md:pb-4">
          <Section title={<span className="text-sm font-semibold">{s.room.floorPlan}</span>} defaultOpen={planOpen} keepMounted>
            <div className="minimap" dangerouslySetInnerHTML={{ __html: mini }} />
          </Section>
        </div>
        <nav className="surfnav mt-3 max-md:order-1 max-md:mt-0 max-md:px-4 max-md:pt-3" aria-labelledby="surf-h">
          <h2 id="surf-h" className="mb-2 text-sm font-semibold text-muted-foreground">{s.room.surfaces}</h2>
          <ul className="surf-list max-md:flex-row max-md:overflow-x-auto max-md:pb-1.5">
            {list.map((x) => {
              const st = stateOf(x);
              return (
                <li key={x.key} className="max-md:w-60 max-md:shrink-0">
                  <button type="button" className="surf" aria-current={x.key === selKey} onClick={() => { select(id, x.key); if (window.innerWidth < 768) document.getElementById('surface-h')?.scrollIntoView({ block: 'start' }); }} data-ref={x.ref}>
                    <span className="chip" aria-hidden="true">{x.ref}</span>
                    <span className="nm"><span className="sr">{x.ref}: </span>{x.label}{x.detail && <span className="rt"> · {x.detail}</span>}</span>
                    <span className={'st' + (st.warn ? ' warn' : '')}>{st.warn ? <AlertTriangle className="size-3.5" /> : x.splitNote ? <Scissors className="size-3.5" /> : <Check className="size-3.5 text-success" />}{st.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <main id="main" className="centre col flex min-w-0 flex-col gap-5 p-4 max-md:order-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight"><InlineName value={roomName(id)} generic={genericRoomName(id)} onCommit={(n) => renameRoom(id, n)} /></h1>
          <p className="sub">{id === 'lazienka-2' ? s.names.template.flat : s.names.template.attic} · {s.room.intro}</p>
        </div>

        <PanelStrip room={id} />

        <Card aria-labelledby="surface-h">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle id="surface-h" className="flex flex-wrap items-center gap-x-1">{sel.ref} – <InlineName value={sel.label} generic={genericSurfaceLabel} label={sel.label} onCommit={(n) => renameSurface(id, selKey, n)} />{sel.detail && <span className="font-normal text-muted-foreground"> · {sel.detail}</span>}</CardTitle>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" aria-label={s.room.zoomOut} title={s.room.zoomOut} onClick={() => setZoom(Math.max(0.5, zoom / 1.25))}><Minus /></Button>
              <Button variant="outline" size="icon" aria-label={s.room.zoomIn} title={s.room.zoomIn} onClick={() => setZoom(Math.min(3, zoom * 1.25))}><Plus /></Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="hint !p-0">{s.room.dragHint}</p>
            <div ref={frameRef} className="overflow-hidden rounded-lg border">{marks && <SurfaceEditor html={drawing} drawing={marks} onShift={(p, v) => setParam(id, p, v)} onMeasure={(p, v) => { setEmpty(`${id}.${p}`, false); setParam(id, p, v); }} validate={validate} onEmpty={(p) => setEmpty(`${id}.${p}`, true)} onPinch={(f) => setZoom((z) => Math.max(0.5, Math.min(3, z * f)))} empty={empty.filter((x) => x.startsWith(id + '.')).map((x) => x.slice(id.length + 1))} nameOf={nameOf} onShowInPanel={(p) => usePanel.getState().openAt('dims', { kind: 'dim', room: id, key: p })} title={sel.label} ops={{ openings: surfOpenings, selected: selOpening, onSelect: (oid) => { selectOpening(oid); if (oid) usePanel.getState().openAt('openings', { kind: 'opening', room: id, key: oid }, undefined, false); }, onChange: (oid, pts) => setOpening(id, oid, pts), onRemove: (oid) => removeOpening(id, oid), kindName: (k) => s.openings.kinds[k] ?? k }} />}</div>
            <Legend />
          </CardContent>
        </Card>

        <Card aria-labelledby="v3-h">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle id="v3-h">{s.view3d.title}</CardTitle>
            <Button variant="outline" id="show3d" aria-expanded={show3d} onClick={() => setShow3d(!show3d)}><Box />{show3d ? s.view3d.hide : s.view3d.show}</Button>
          </CardHeader>
          {show3d && <CardContent><Suspense fallback={<p className="muted" role="status">{s.view3d.loading}</p>}><View3D model={model} name={roomName(id)} openings={roomOpenings} /></Suspense></CardContent>}
        </Card>

        <MeasureList id={id} model={model} list={list} roomKey={key} minStrip={minStrip} plateLen={plateLen} validate={validate} plan={mini} />

        <Card aria-labelledby="sum-h">
          <CardHeader><CardTitle id="sum-h">{s.room.summary}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Stats items={missingHere ? [
              ['–', s.room.stats.net], ['–', s.room.stats.fields], ['–', s.room.stats.pieces], ['–', s.room.stats.minPlates], ['–', top[0]], ['–', s.room.stats.gross], ['–', s.room.stats.cutPlates],
            ] : [
              [nf(model.areaM2, 1) + ' m²', s.room.stats.net],
              [model.fields, s.room.stats.fields],
              [piecesN, s.room.stats.pieces],
              [model.minPlates, s.room.stats.minPlates],
              [Math.round(top[1]) + ' cm', top[0]],
              [cut && !blocked ? nf(cut.stats.grossM2, 1) + ' m²' : '–', s.room.stats.gross],
              [cut && !blocked ? cut.plates.length : '–', s.room.stats.cutPlates],
            ]} />
            <p className="note">{s.room.piecesNote}</p>
            {missingHere && <p className="warnbox" role="status"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" /><span>{s.room.missingDims}: {empty.filter((x) => x.startsWith(id + '.')).map((x) => nameOf(x.slice(id.length + 1))).join('; ')}</span></p>}
            {slivers.length > 0 && !missingHere && (
              <p className="warnbox" role="status"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" /><span>{s.room.slivers(slivers.length, minStrip)}: {slivers.map((v) => s.room.sliverItem(v.ref, v.id, nf(v.width, 1))).join('; ')}</span></p>
            )}
          </CardContent>
        </Card>

        <Card aria-labelledby="cut-h">
          <CardHeader><CardTitle id="cut-h">{s.room.cut}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {busy
                ? <Button variant="outline" onClick={() => cancelCut(id)}>{s.shared.cancel}</Button>
                : <Button variant="outline" disabled={missingHere} onClick={() => runCut(id, req)}>{s.room.cutBtn}</Button>}
              {missingHere && !busy && <Button variant="link" className="h-auto min-h-11 px-1 underline" onClick={() => usePanel.getState().openAt('dims', { kind: 'dim', room: id, key: empty.find((x) => x.startsWith(id + '.'))!.slice(id.length + 1) })}>{s.panel.cutBlocked}</Button>}
              {busy && <span className="muted" role="status">{s.shared.running}</span>}
            </div>
            {entry && !fresh && <p className="flex flex-wrap items-center gap-2 text-sm"><span className="badge">{s.room.stale}</span><span className="text-muted-foreground">{s.room.staleNote}</span></p>}
            {!entry && <div className="empty"><b>{s.room.emptyCutTitle}</b><p className="sub">{s.room.cutHint}</p></div>}
            {cut && !blocked && <p className="sub">{s.room.cutCap(Math.round(cut.PL), Math.round(cut.PW), cut.plates.length, use)}</p>}
            {cut && !blocked && cut.splitCount > 0 && <p className="note">{s.room.splitNote(cut.splitCount)}</p>}
            {cut && cut.clamped.length > 0 && <p className="note">{s.room.clampedNote(cut.clamped.map((c) => pieceLabel(c.room, c.ids, c.seg)).join(', '))}</p>}
            {cut && <Blocking issues={cut.blocking} />}
            {cut && <ExportButtons R={cut} title={roomName(id)} />}
            <div className={entry && !fresh ? 'stale' : undefined}>{cut && !blocked && <SheetGrid R={cut} minOffcut={project.settings.minOffcutCm} minStrip={minStrip} />}</div>
          </CardContent>
        </Card>
      </main>

      <div className="right flex min-w-0 max-md:contents md:col-start-3 md:row-start-1 md:row-span-1">
        <MeasurePanel>
          {(section) => (
            <>
              {section === 'dims' && (
                <section aria-labelledby="dim-h">
                  <h3 id="dim-h" className="sr-only">{s.room.dimensions}</h3>
                  <Dimensions id={id} model={model} highlight={(marks?.measures ?? []).map((m) => m.param)} />
                  <Button variant="outline" className="mt-3" onClick={() => resetRoom(id)}>{s.history.resetBtn}</Button>
                </section>
              )}
              {section === 'starts' && (
                <section className="flex flex-col gap-2" aria-labelledby="sp-h">
                  <h3 id="sp-h" className="sr-only">{s.room.startPoints}</h3>
                  <p className="sub">{s.room.startCap}</p>
                  <StartPoints id={id} model={model} selected={selKey} onSelect={(k) => select(id, k)} />
                  {ref && (
                    <Section title={s.room.refsOne(ref.id)} defaultOpen>
                      <p className="note">{ref.where}</p>
                      <p className="note">{ref.coord}</p>
                      <p className="note">{s.room.fieldsOf(ref.fields)}</p>
                    </Section>
                  )}
                  <Section title={s.room.refsTable}>
                    <p className="sub mb-2">{s.room.refsCap}</p>
                    <div className="tbl">
                      <table>
                        <thead><tr>{s.room.refsHead.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                        <tbody>{model.refs.map((r) => <tr key={r.id}><td className="font-semibold">{r.id}</td><td>{r.name}</td><td>{r.fields}</td><td>{r.where}</td><td>{r.coord}</td></tr>)}</tbody>
                      </table>
                    </div>
                    {isAttic(model) && <p className="note mt-2">{s.room.refsNoteAttic}</p>}
                  </Section>
                </section>
              )}
              {section === 'openings' && <OpeningsPanel id={id} surface={selKey} gable={sel.kind === 'gable'} map={marks?.map} />}
              {section === 'plates' && <SettingsPanel />}
            </>
          )}
        </MeasurePanel>
        <PanelRail room={id} />
      </div>
    </div>
  );
}
