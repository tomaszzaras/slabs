import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ROOMS, addStripCut, fieldIssues, isAttic, joinTooLong, moveStripCut, otherAreaCm2, removeStripCut, roomKind, roomSlivers, setStripSplit, suggestCut, type SplitId } from '@slabs/core';
import { fitScale, planMarks, surfaceList, surfaceMarks, surfaceWidthCm, wrapMark } from '@slabs/render';
import { customSurfaceName, drawingLabels as L, genericRoomName, lang, nf, roomName, s, T_ } from '../i18n';
import { InlineName } from './InlineName';
import { RoomMenu } from './RoomMenu';
import { Badge } from '@/components/ui/badge';
import { buildRequest, genericSurfaceName, hashRequest, roomModel } from '../cut/request';
import { OVERVIEW, useStore } from '../state/store';
import { paletteKey } from '@slabs/core';
import type { RoomRef } from '../state/project';
import { AlertTriangle, Check, Hash, House, Minus, Plus, Ruler, Scissors, Grid3x3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Section } from '@/components/ui/collapsible';
import { Blocking, pieceLabel } from './Issues';
import { ExportButtons } from './ExportButtons';
import { StartPoints, becauseOf } from './ParamForm';
import { ShapeBlock } from './ShapeBlock';
import { CladdingControls, QuickWalls } from './CladdingControls';
import { jumpToField, wantsEdit } from '../state/focusField';
import { useRoomEngine } from '../state/engine';
import { MeasureList } from './MeasureList';
import { OpeningsPanel } from './OpeningsPanel';
import { useWidth } from './Pan';
import { SurfaceEditor, type SheetEditing } from './SurfaceEditor';
import { SplitMenu } from './SplitMenu';
import { MeasurePanel, PanelRail, PanelStrip, usePanelShortcut } from './MeasurePanel';
import { usePanel } from '../state/panel';
import { useView } from '../state/view';
import { SheetGrid, Stats } from './Svg';

const View3D = lazy(() => import('./View3D'));

/** icons of the 3D options (roof and ceiling, joint grid, field numbers, start points R) */
const OPT_ICON = { roof: House, grid: Grid3x3, numbers: Hash, refs: Ruler } as const;

/** Legend of the marks, drawn with the same classes as the drawing so print and screen agree. */
function Legend({ sheet }: { sheet: boolean }) {
  const sw = (inner: string) => <svg viewBox="0 0 28 16" aria-hidden="true" dangerouslySetInnerHTML={{ __html: inner }} />;
  return (
    <ul className="legend" aria-label={s.room.legendTitle}>
      <li>{sw('<line x1="1" y1="8" x2="27" y2="8" class="mk-chalk"/>')}{s.room.legend.chalk}</li>
      <li>{sw('<line x1="6" y1="2" x2="6" y2="14" class="mk-start-tick"/><line x1="8" y1="8" x2="26" y2="8" class="mk-arrow"/>')}{s.room.legend.start}</li>
      <li>{sw('<path d="M3 2L25 14M25 2L3 14" class="mk-x"/>')}{s.room.legend.waste}</li>
      <li>{sw('<circle cx="14" cy="8" r="6" class="mk-face"/><circle cx="14" cy="8" r="1.8" class="mk-face-dot"/>')}{s.room.legend.face}</li>
      <li>{sw('<line x1="1" y1="8" x2="27" y2="8" class="mk-fold"/>')}{s.room.legend.fold}</li>
      <li>{sw('<line x1="1" y1="8" x2="27" y2="8" class="mk-split"/>')}{s.room.legend.split}</li>
      {sheet && <li>{sw('<line x1="1" y1="8" x2="27" y2="8" class="mk-sp-on"/>')}{s.sheet.legendSplit}</li>}
      {sheet && <li>{sw('<line x1="1" y1="8" x2="27" y2="8" class="mk-xcut"/>')}{s.sheet.legendCut}</li>}
      {sheet && <li>{sw('<line x1="1" y1="8" x2="27" y2="8" class="mk-split"/>')}{s.sheet.legendAuto}</li>}
    </ul>
  );
}

/** The words for how the boards of a surface run, when it is not the default. */
function surfDirText(x: { dir?: string; key: number }, flat: boolean): string {
  if (x.key === 1) return flat ? s.spec.dirAlong : s.spec.stateRidge;
  return s.spec.stateHorizontal;
}

export function RoomScreen({ id }: { id: RoomRef }) {
  const project = useStore((st) => st.project);
  const selectedMap = useStore((st) => st.selected);
  const select = useStore((st) => st.select);
  const entry = useStore((st) => st.cuts[id]);
  const busy = useStore((st) => !!st.running[id]);
  const [renamingName, setRenamingName] = useState(false);
  const { runCut, cancelCut, renameRoom, renameSurface, setTab } = useStore.getState();
  const spec = project.rooms[id]!.spec;
  const roofW = { ...project.roof, ...project.rooms[id]!.roof }.W;
  const { params, type } = useRoomEngine(id);
  const model = useMemo(() => roomModel(project, id, lang), [spec, project.rooms[id]!.roof, project.roof, project.settings.trimMm, project.settings.plate, project.settings.splitAtBends, project.splits[id], project.openings[id], project.names, id, lang]);
  const key = paletteKey(id);
  const minStrip = project.settings.minStripCm;
  const plateLen = (model.p.PL ?? 0) - 2 * (model.p.trimL ?? model.p.trim ?? 0);
  const list = useMemo(() => surfaceList(model, minStrip, plateLen), [model, minStrip, plateLen]);
  const selKey = list.some((x) => x.key === selectedMap[id]) ? selectedMap[id]! : list[0]!.key;
  const sel = list.find((x) => x.key === selKey)!;
  const genericSurfaceLabel = customSurfaceName(id, selKey) ? genericSurfaceName(project, id, selKey) || sel.label : sel.label;
  const slivers = useMemo(() => roomSlivers(model, minStrip), [model, minStrip]);
  usePanelShortcut();
  const [zoom, setZoom] = useState(1);
  const [editingShape, setEditingShape] = useState(false);
  const [shapeOpen, setShapeOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768); // on a phone the drawing comes first; a one-line summary stays in the title
  useEffect(() => { if (wantsEdit.has(id)) { setShapeOpen(true); setEditingShape(true); } }, [id]);
  useEffect(() => { const f = () => { setShapeOpen(true); setEditingShape(true); }; window.addEventListener('slabs:open-shape', f); return () => window.removeEventListener('slabs:open-shape', f); }, []);
  const mode = useView((v) => v.mode);
  const roof = useView((v) => v.roof), grid = useView((v) => v.grid), numbers = useView((v) => v.numbers), refs = useView((v) => v.refs);
  const opts = useMemo(() => ({ roof, grid, numbers, refs }), [roof, grid, numbers, refs]);
  const { setMode, toggle: toggleOpt } = useView.getState();
  const show3d = mode === '3d';
  const [frameRef, frameW] = useWidth<HTMLDivElement>();
  const scale = fitScale(surfaceWidthCm(model, selKey), frameW || 800) * zoom;
  const nfi = (v: number) => nf(Math.round(v * 10) / 10, Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1);
  const roomOpenings = project.openings[id];
  const surfOpenings = useMemo(() => roomOpenings.filter((o) => o.surface === selKey), [roomOpenings, selKey]);
  const selOpening = useStore((st) => st.selOpening);
  const { selectOpening, setOpening, removeOpening } = useStore.getState();
  const [joinMsg, setJoinMsg] = useState<{ strip: number; text: string } | null>(null);
  useEffect(() => { if (!joinMsg) return; const t = setTimeout(() => setJoinMsg(null), 7000); return () => clearTimeout(t); }, [joinMsg]);
  const marks = useMemo(() => surfaceMarks(model, selKey, key, { scale, minStrip, plateLen, nf: nfi, labels: L, openings: surfOpenings }, { flag: joinMsg ?? undefined }), [model, selKey, scale, minStrip, plateLen, key, surfOpenings, lang, joinMsg]);
  // the roof sheet: split / join a fold line of a strip, cross-cuts
  const sheetModel = isAttic(model) ? model.sheet : undefined;
  const splits = project.splits[id] ?? {};
  const sab = project.settings.splitAtBends;
  const { setSplits, showToast } = useStore.getState();
  const foldName = (fid: SplitId): string => (fid === 'ridge' ? (sheetModel?.cap ? L.centreFold : L.ridgeFold) : fid === 'cap' ? L.capFold : fid === 'wallfold' ? (isAttic(model) && model.XT !== undefined ? L.partitionFold : L.wallFold) : L.eaveFold);
  const idOf = (k: number) => sheetModel?.strips.find((q) => q.k === k)?.id ?? k;
  const sheetEdit: SheetEditing | undefined = sheetModel && selKey === 1 && !model.faces?.some((x) => x.key === 1) ? {
    onToggle: (k, fid, on) => {
      if (!on) {
        const len = joinTooLong(sheetModel, splits, k, fid, sab);
        if (len !== null) { const text = s.sheet.tooLong(idOf(k), Math.round(len), Math.round(sheetModel.PL)); setJoinMsg({ strip: k, text }); showToast(text); return; }
      }
      setSplits(id, setStripSplit(splits, k, fid, on, sab));
      setAnnounce(s.sheet.changed(foldName(fid), idOf(k), on));
    },
    onAddCut: (k, u) => {
      const st = sheetModel.strips.find((q) => q.k === k);
      if (!st || !st.cells.some((c) => u > c.uL + 1 && u < c.uR - 1)) return;
      setSplits(id, addStripCut(splits, k, u), `cut.${k}`);
      setAnnounce(s.sheet.cutAdded(idOf(k)));
    },
    onMoveCut: (k, from, to) => { if (to !== from) setSplits(id, moveStripCut(splits, k, from, to), `cut.${k}`); },
    onRemoveCut: (k, u) => { setSplits(id, removeStripCut(splits, k, u)); setAnnounce(s.sheet.cutRemoved(idOf(k))); showToast(s.sheet.cutRemoved(idOf(k)), true); },
    onKeyAddCut: (k) => { const u = suggestCut(sheetModel, splits, k, sab); if (u !== null) { setSplits(id, addStripCut(splits, k, u), `cut.${k}`); setAnnounce(s.sheet.cutAdded(idOf(k))); } },
  } : undefined;
  const [announce, setAnnounce] = useState('');
  // the 3D model takes the frame of the 2D drawing: same height
  // The frame's height in 2D is measured per surface and reused by 3D; before it was measured (3D from the start) the same rule is applied: the drawing's height up to 72vh.
  const h2d = useRef<Record<string, number>>({});
  const [, bump] = useState(0);
  useEffect(() => {
    const el = frameRef.current;
    if (show3d || !el) return;
    const k = `${id}.${selKey}`;
    const ro = new ResizeObserver(() => { const h = el.offsetHeight; if (h > 0 && h2d.current[k] !== h) { h2d.current[k] = h; bump((n) => n + 1); } });
    ro.observe(el);
    return () => ro.disconnect();
  }, [show3d, id, selKey, frameRef]);
  const frameH = Math.max(240, (h2d.current[`${id}.${selKey}`] ?? (marks ? Math.min(marks.h, Math.round(0.72 * (typeof window === 'undefined' ? 900 : window.innerHeight))) + 2 : 420)) - 2);
  const drawing = useMemo(() => (marks ? wrapMark(marks, `${sel.ref}: ${sel.label}`) : ''), [marks, sel.ref, sel.label]);
  const setParam = useStore((st) => st.setParam);
  const empty = useStore((st) => st.empty);
  const setEmpty = useStore((st) => st.setEmpty);
  const validate = (param: string, value: number): string | null => {
    const issue = fieldIssues(type, { ...params, [param]: value }).find((i) => i.key === param);
    if (!issue) return null;
    const fd = ROOMS[type].fields.find((x) => x.key === param);
    return s.room.issue(fd ? T_(fd.label) : param, issue.kind, issue.bound, fd?.unit ?? 'cm', becauseOf(issue, id, { ...params, [param]: value }));
  };
  const missingHere = empty.some((x) => x.startsWith(id + '.'));
  const nameOf = (param: string) => { const f = ROOMS[type].fields.find((x) => x.key === param); return f ? T_(f.label) : param; };
  const planWidthCm = isAttic(model) ? (model.XT !== undefined ? model.XR - model.XT : model.p.W!) : model.p.bx!;
  const miniScale = Math.min(0.3, 150 / Math.max(100, planWidthCm));
  const mini = useMemo(() => wrapMark(planMarks(model, key, { scale: miniScale, minStrip, plateLen, nf: nfi, labels: L }), s.room.plan), [model, key, miniScale, minStrip, plateLen]);

  const req = useMemo(() => buildRequest(project, id), [project, id]);
  const piecesN = req.rooms.reduce((a, r) => a + r.pieces.length, 0);
  const fresh = !!entry && entry.key === hashRequest(req);
  const cut = entry?.result ?? null;
  const blocked = !!cut && cut.blocking.length > 0;
  const use = cut ? Math.round(cut.stats.utilisation * 100) : 0;
  const top: [string, number] = isAttic(model) && type === 'salon' ? [s.room.stats.topRidge, model.RID] : !isAttic(model) ? [s.room.stats.topRoom, model.TOPH] : [s.room.stats.topAny, model.TOPH];
  const ref = model.refs.find((r) => r.id === sel.ref);
  const stateOf = (x: (typeof list)[number]) => x.slivers ? { warn: true, text: s.room.stateSliver(x.slivers) } : x.splitNote ? { warn: false, text: s.room.stateSplit } : { warn: false, text: s.room.stateOk };

  return (
    <div className="shell mx-auto flex max-w-[1760px] flex-col md:grid md:grid-cols-[14rem_minmax(0,1fr)_auto]" data-room={id}>
      <div className="left p-4 max-md:contents md:sticky md:top-[var(--barh,112px)] md:max-h-[calc(100vh-var(--barh,112px))] md:self-start md:overflow-auto">
        <nav className="surfnav max-md:order-3 max-md:px-4 max-md:pt-3" aria-labelledby="surf-h">
          <h2 id="surf-h" className="mb-2 text-sm font-semibold text-muted-foreground">{s.spec.surfaces}</h2>
          <ul className="surf-list max-md:flex-row max-md:overflow-x-auto max-md:pb-1.5">
            {list.map((x) => {
              const st = stateOf(x);
              return (
                <li key={x.key} className="max-md:w-60 max-md:shrink-0">
                  <button type="button" className="surf" aria-current={x.key === selKey} onClick={() => { select(id, x.key); if (window.innerWidth < 768) document.getElementById('surface-h')?.scrollIntoView({ block: 'start' }); }} data-ref={x.ref}>
                    <span className="chip" aria-hidden="true">{x.ref}</span>
                    <span className="nm"><span className="sr">{x.ref}: </span>{x.label}{x.detail && <span className="rt"> · {x.detail}</span>}</span>
                    {x.kind === 'face' && x.finish !== 'wood' ? <span className="st">{x.finish === 'other' ? s.spec.stateOther : s.spec.stateSplit(nf(((model.faces?.find((q) => q.key === x.key)?.woodArea ?? 0) / 1e4), 1))}</span> : null}
                    {x.kind === 'face' && x.finish === 'wood' && x.dir ? <span className="st">{surfDirText(x, model.spec?.ceiling.kind === 'flat')}</span> : null}
                    <span className={'st' + (st.warn ? ' warn' : '')}>{st.warn ? <AlertTriangle className="size-3.5" /> : x.splitNote ? <Scissors className="size-3.5" /> : <Check className="size-3.5 text-success" />}{st.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <QuickWalls id={id} />
        </nav>
      </div>

      <main id="main" className="centre col flex min-w-0 flex-col gap-5 p-4 max-md:contents">
        <div className="max-md:order-1 max-md:px-4 max-md:pt-4">
          <h1 className="flex flex-wrap items-center gap-x-1 text-2xl font-semibold tracking-tight"><InlineName value={roomName(id)} generic={genericRoomName(id)} editing={renamingName} onEditing={setRenamingName} onCommit={(n) => renameRoom(id, n)} /><RoomMenu id={id} onRename={() => setRenamingName(true)} className="size-11" />{!project.rooms[id]!.on && <Badge variant="secondary" className="badge text-xs font-normal">{s.overview.off}</Badge>}</h1>
          <p className="sub">{s.rooms.kinds[roomKind(spec)]} · {s.room.intro}</p>
        </div>

        <div className="max-md:order-2 max-md:px-4"><PanelStrip room={id} /></div>

        <section className="max-md:order-4 max-md:px-4" aria-labelledby="shape-h" data-section="shape">
          <Card>
            <Section id="shape-toggle" open={shapeOpen} onOpenChange={setShapeOpen} className="px-4 pt-1" title={<h2 id="shape-h" className="text-base font-semibold">{s.spec.shape}<span className="ml-2 text-sm font-normal text-muted-foreground" data-shape-summary>{nf(spec.ceiling.kind === 'flat' || spec.pos !== 'full' ? spec.w : roofW)} × {nf(spec.l)} cm · {s.rooms.kinds[roomKind(spec)]}</span>{missingHere && <span className="ml-2 inline-flex items-center gap-1 text-sm font-normal text-destructive"><AlertTriangle className="size-4" aria-hidden="true" />{s.panel.missingShort}</span>}</h2>}>
              <div className="pb-2"><ShapeBlock id={id} plan={mini} editing={editingShape} onEditing={setEditingShape} /></div>
            </Section>
          </Card>
        </section>

        <section className="flex flex-col gap-2 max-md:order-5 max-md:px-4" aria-label={s.spec.cladding} data-section="cladding">
        <h2 className="text-base font-semibold">{s.spec.cladding}</h2>
        <Card aria-labelledby="surface-h">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <CardTitle id="surface-h" className="flex flex-wrap items-center gap-x-1">{sel.ref} – <InlineName value={sel.label} generic={genericSurfaceLabel} label={sel.label} onCommit={(n) => renameSurface(id, selKey, n)} />{sel.detail && <span className="font-normal text-muted-foreground"> · {sel.detail}</span>}</CardTitle>
            <div className="flex flex-wrap items-center gap-2" data-view-header>
              {show3d ? (
                <div className="flex flex-wrap items-center gap-1" role="group" aria-label={s.view3d.options}>
                  {(['roof', 'grid', 'numbers', 'refs'] as const).map((k) => {
                    const Icon = OPT_ICON[k];
                    return (
                      <button key={k} type="button" data-opt={k} aria-pressed={opts[k]} aria-label={s.view3d[k]} title={s.view3d[k]} onClick={() => toggleOpt(k)}
                        className={'inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-md border px-2.5 text-sm max-sm:w-11 max-sm:px-0 ' + (opts[k] ? 'border-primary bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted')}>
                        <Icon className="size-4 shrink-0" aria-hidden="true" /><span className="max-sm:sr-only">{s.view3d.short[k]}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1">
                  {sheetModel && sheetEdit && <SplitMenu sheet={sheetModel} splits={splits} splitAtBends={sab} foldName={foldName} onChange={(next, msg) => { setSplits(id, next); if (msg) showToast(msg); }} />}
                  <Button variant="outline" size="icon" className="size-11" aria-label={s.room.zoomOut} title={s.room.zoomOut} onClick={() => setZoom(Math.max(0.5, zoom / 1.25))}><Minus /></Button>
                  <Button variant="outline" size="icon" className="size-11" aria-label={s.room.zoomIn} title={s.room.zoomIn} onClick={() => setZoom(Math.min(3, zoom * 1.25))}><Plus /></Button>
                </div>
              )}
              <div className="inline-flex rounded-md border p-0.5" role="group" aria-label={s.view3d.switchLabel} data-view-switch>
                {([['2d', s.view3d.d2, s.view3d.d2Label], ['3d', s.view3d.d3, s.view3d.d3Label]] as const).map(([m, label, long]) => (
                  <button key={m} type="button" id={'view-' + m} aria-pressed={mode === m} aria-label={long} title={long} onClick={() => setMode(m)}
                    className={'inline-flex h-11 min-w-12 items-center justify-center rounded-[5px] px-3 text-sm font-semibold ' + (mode === m ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted')}>{label}</button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CladdingControls id={id} surf={selKey} model={model} />
            <div ref={frameRef} className="overflow-hidden rounded-lg border" data-frame>{show3d ? <Suspense fallback={<p className="muted p-4" role="status" style={{ height: frameH }}>{s.view3d.loading}</p>}><View3D model={model} name={roomName(id)} openings={roomOpenings} options={opts} selected={selKey} onSelect={(k) => select(id, k)} height={frameH} /></Suspense> : marks && <SurfaceEditor html={drawing} drawing={marks} onShift={(p, v) => setParam(id, p, v)} onMeasure={(p, v) => { setEmpty(`${id}.${p}`, false); setParam(id, p, v); }} validate={validate} onEmpty={(p) => setEmpty(`${id}.${p}`, true)} onPinch={(f) => setZoom((z) => Math.max(0.5, Math.min(3, z * f)))} empty={empty.filter((x) => x.startsWith(id + '.')).map((x) => x.slice(id.length + 1))} nameOf={nameOf} onShowInPanel={(p) => jumpToField(id, p)} title={sel.label} sheet={sheetEdit} ops={{ openings: surfOpenings, selected: selOpening, onSelect: (oid) => { selectOpening(oid); if (oid) usePanel.getState().openAt('openings', { kind: 'opening', room: id, key: oid }, undefined, false); }, onChange: (oid, pts) => setOpening(id, oid, pts), onRemove: (oid) => removeOpening(id, oid), kindName: (k) => s.openings.kinds[k] ?? k }} />}</div>
            <p id="v3-help" className="hint !p-0">{show3d ? s.view3d.help : s.room.dragHint}</p>
            {!show3d && sheetEdit && <p className="text-sm text-foreground" data-sheet-hint>{s.sheet.hint}</p>}
            <p className="sr-only" role="status" aria-live="polite" data-sheet-live>{announce}</p>
            {joinMsg && !show3d && <p className="warnbox" role="status" data-join-msg><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" /><span>{joinMsg.text}</span></p>}
            {!show3d && sheetModel && sheetModel.notes.map((n) => <p key={n.strip} className="warnbox" role="note"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" /><span>{s.sheet.joinedLong(n.id, Math.round(n.len), Math.round(n.max))}</span></p>)}
            {!show3d && <Legend sheet={!!sheetEdit} />}
          </CardContent>
        </Card>
        </section>

        <div className="max-md:order-6 max-md:px-4"><MeasureList id={id} model={model} list={list} roomKey={key} minStrip={minStrip} plateLen={plateLen} validate={validate} plan={mini} /></div>

        <section className="flex flex-col gap-2 max-md:order-7 max-md:px-4" data-section="result" aria-label={s.spec.result}>
        <h2 className="text-base font-semibold">{s.spec.result}</h2>
        <Card aria-labelledby="sum-h">
          <CardHeader><CardTitle id="sum-h">{s.room.summary}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Stats items={missingHere ? [
              ['–', s.room.stats.net], ['–', s.room.stats.fields], ['–', s.room.stats.pieces], ['–', s.room.stats.minPlates], ['–', top[0]], ['–', s.room.stats.gross], ['–', s.room.stats.cutPlates],
            ] : [
              [nf(model.areaM2, 1) + ' m²', s.room.stats.net],
              ...(otherAreaCm2(model) > 0 ? [[nf(otherAreaCm2(model) / 1e4, 1) + ' m²', s.spec.otherM2] as [string, string]] : []),
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
                : <Button variant={entry ? 'outline' : 'default'} disabled={missingHere} onClick={() => runCut(id, req)}>{s.room.cutBtn}</Button>}
              {missingHere && !busy && <Button variant="link" className="h-auto min-h-11 px-1 underline" onClick={() => jumpToField(id, empty.find((x) => x.startsWith(id + '.'))!.slice(id.length + 1))}>{s.panel.cutBlocked}</Button>}
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
        </section>
      </main>

      <div className="right flex min-w-0 max-md:contents md:col-start-3 md:row-start-1 md:row-span-1">
        <MeasurePanel>
          {(section) => (
            <>
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
              {section === 'plates' && (
                <div className="flex flex-col items-start gap-3 p-1">
                  <p className="max-w-[40ch] text-sm text-muted-foreground">{s.overview.settingsLink}</p>
                  <Button variant="outline" onClick={() => { usePanel.getState().close(); setTab(OVERVIEW); setTimeout(() => document.getElementById('project-settings')?.scrollIntoView({ block: 'start' }), 50); }}>{s.overview.settingsOpen}</Button>
                </div>
              )}
            </>
          )}
        </MeasurePanel>
        <PanelRail room={id} />
      </div>
    </div>
  );
}
