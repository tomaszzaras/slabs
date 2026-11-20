import { useMemo, useState } from 'react';
import { ROOMS, isAttic, roomSlivers, type RoomId } from '@slabs/core';
import { fitScale, planMarks, sharedSheets, surfaceList, surfaceMarks, surfaceWidthCm, wrapMark } from '@slabs/render';
import { drawingLabels as L, lang, nf, roomName, s, T_ } from '../i18n';
import { buildRequest, hashRequest, roomModel } from '../cut/request';
import { useStore } from '../state/store';
import { AlertTriangle, Check, Minus, Plus, Scissors } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Section } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Blocking, pieceLabel } from './Issues';
import { ExportButtons } from './ExportButtons';
import { Dimensions, StartPoints } from './ParamForm';
import { useWidth } from './Pan';
import { SurfaceEditor } from './SurfaceEditor';
import { SettingsPanel } from './SettingsPanel';
import { SheetGrid, Stats } from './Svg';

/** Legend of the marks, drawn with the same classes as the drawing. */
function Legend() {
  const sw = (inner: string) => <svg className="h-4 w-7 shrink-0" viewBox="0 0 28 16" aria-hidden="true" dangerouslySetInnerHTML={{ __html: inner }} />;
  return (
    <ul className="legend flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-muted-foreground" aria-label={s.room.legendTitle}>
      <li className="flex items-center gap-2">{sw('<line x1="1" y1="8" x2="27" y2="8" class="mk-chalk"/>')}{s.room.legend.chalk}</li>
      <li className="flex items-center gap-2">{sw('<line x1="6" y1="2" x2="6" y2="14" class="mk-start-tick"/><line x1="8" y1="8" x2="26" y2="8" class="mk-arrow"/>')}{s.room.legend.start}</li>
      <li className="flex items-center gap-2">{sw('<path d="M3 2L25 14M25 2L3 14" class="mk-x"/>')}{s.room.legend.waste}</li>
      <li className="flex items-center gap-2">{sw('<circle cx="14" cy="8" r="6" class="mk-face"/><circle cx="14" cy="8" r="1.8" class="mk-face-dot"/>')}{s.room.legend.face}</li>
      <li className="flex items-center gap-2">{sw('<line x1="1" y1="8" x2="27" y2="8" class="mk-fold"/>')}{s.room.legend.fold}</li>
      <li className="flex items-center gap-2">{sw('<line x1="1" y1="8" x2="27" y2="8" class="mk-split"/>')}{s.room.legend.split}</li>
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
  const [frameRef, frameW] = useWidth<HTMLDivElement>();
  const scale = fitScale(surfaceWidthCm(model, selKey), frameW || 800) * zoom;
  const nfi = (v: number) => nf(Math.round(v * 10) / 10, Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1);
  const marks = useMemo(() => surfaceMarks(model, selKey, key, { scale, minStrip, plateLen, nf: nfi, labels: L }), [model, selKey, scale, minStrip, plateLen, key]);
  const drawing = useMemo(() => (marks ? wrapMark(marks, `${sel.ref}: ${T_(sel.title)}`) : ''), [marks, sel.ref, sel.title]);
  const setParam = useStore((st) => st.setParam);
  const empty = useStore((st) => st.empty);
  const nameOf = (param: string) => { const f = ROOMS[id].fields.find((x) => x.key === param); return f ? T_(f.label) : param; };
  const planWidthCm = isAttic(model) ? (model.XT !== undefined ? model.XR - model.XT : model.p.W!) : model.p.bx!;
  const miniScale = Math.min(0.5, 190 / Math.max(100, planWidthCm));
  const mini = useMemo(() => wrapMark(planMarks(model, key, { scale: miniScale, minStrip, plateLen, nf: nfi, labels: L }), s.room.plan), [model, key, miniScale, minStrip, plateLen]);

  const req = useMemo(() => buildRequest(project, id), [project, id]);
  const fresh = !!entry && entry.key === hashRequest(req);
  const cut = entry?.result ?? null;
  const blocked = !!cut && cut.blocking.length > 0;
  const sheets = useMemo(() => (cut && !blocked ? sharedSheets(cut, L) : []), [cut, blocked]);
  const use = cut ? Math.round(cut.stats.utilisation * 100) : 0;
  const top: [string, number] = id === 'salon' ? [s.room.stats.topRidge, isAttic(model) ? model.RID : 0] : id === 'lazienka-2' ? [s.room.stats.topRoom, model.TOPH] : [s.room.stats.topAny, model.TOPH];
  const ref = model.refs.find((r) => r.id === sel.ref);
  const stateOf = (x: (typeof list)[number]) => x.slivers ? { warn: true, text: s.room.stateSliver(x.slivers) } : x.splitNote ? { warn: false, text: s.room.stateSplit } : { warn: false, text: s.room.stateOk };

  return (
    <div className="shell mx-auto grid max-w-[1760px] grid-cols-1 md:grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[17rem_minmax(0,1fr)_22rem]" data-room={id}>
      <nav className="left p-4 md:sticky md:top-[var(--barh,112px)] md:max-h-[calc(100vh-var(--barh,112px))] md:self-start md:overflow-auto" aria-label={s.room.surfaces}>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{s.room.floorPlan}</h2>
        <div className="minimap mb-5 overflow-auto rounded-lg border bg-card" dangerouslySetInnerHTML={{ __html: mini }} />
        <h2 id="surf-h" className="mb-2 text-sm font-semibold text-muted-foreground">{s.room.surfaces}</h2>
        <ul className="surf-list relative flex gap-1.5 overflow-x-auto pb-1.5 md:flex-col md:overflow-visible" aria-labelledby="surf-h">
          {list.map((x) => {
            const st = stateOf(x);
            const on = x.key === selKey;
            return (
              <li key={x.key} className="max-md:w-56 max-md:shrink-0">
                <button type="button" aria-current={on} data-ref={x.ref}
                  onClick={() => { select(id, x.key); if (window.innerWidth < 768) document.getElementById('surface-h')?.scrollIntoView({ block: 'start' }); }}
                  className={cn('surf grid min-h-14 w-full grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 rounded-lg border border-transparent px-2.5 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50', on && 'border-primary/40 bg-primary/10')}>
                  <Badge variant={on ? 'default' : 'outline'} className="row-span-2 justify-center py-1 text-[13px]">{x.ref}</Badge>
                  <span className="text-sm leading-tight font-medium"><span className="sr-only">{x.ref}: </span>{T_(x.title)}</span>
                  <span className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', st.warn && 'font-medium text-destructive')}>
                    {st.warn ? <AlertTriangle className="size-3.5" /> : x.splitNote ? <Scissors className="size-3.5" /> : <Check className="size-3.5 text-success" />}{st.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <main id="main" className="centre flex min-w-0 flex-col gap-5 p-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{roomName(id)}</h1>
          <p className="max-w-[66ch] text-sm text-muted-foreground">{s.room.intro}</p>
        </div>

        <Card aria-labelledby="surface-h">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle id="surface-h">{sel.ref} – {T_(sel.title)}</CardTitle>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" aria-label={s.room.zoomOut} onClick={() => setZoom(Math.max(0.5, zoom / 1.25))}><Minus /></Button>
              <Button variant="outline" size="icon" aria-label={s.room.zoomIn} onClick={() => setZoom(Math.min(3, zoom * 1.25))}><Plus /></Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{s.room.dragHint}</p>
            <div ref={frameRef} className="overflow-hidden rounded-lg border">{marks && <SurfaceEditor html={drawing} drawing={marks} onShift={(p, v) => setParam(id, p, v)} onMeasure={(p, v) => setParam(id, p, v)} empty={empty.filter((x) => x.startsWith(id + '.')).map((x) => x.slice(id.length + 1))} nameOf={nameOf} />}</div>
            <Legend />
          </CardContent>
        </Card>

        <Card aria-labelledby="sum-h">
          <CardHeader><CardTitle id="sum-h">{s.room.summary}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Stats items={[
              [nf(model.areaM2, 1) + ' m²', s.room.stats.net],
              [model.fields, s.room.stats.fields],
              [model.minPlates, s.room.stats.minPlates],
              [Math.round(top[1]) + ' cm', top[0]],
              [cut && !blocked ? nf(cut.stats.grossM2, 1) + ' m²' : '–', s.room.stats.gross],
              [cut && !blocked ? cut.plates.length : '–', s.room.stats.cutPlates],
            ]} />
            {slivers.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm" role="status"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>{s.room.slivers(slivers.length, minStrip)}: {slivers.map((v) => s.room.sliverItem(v.ref, v.id, nf(v.width, 1))).join('; ')}</span></p>
            )}
          </CardContent>
        </Card>

        <Card aria-labelledby="cut-h">
          <CardHeader><CardTitle id="cut-h">{s.room.cut}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {busy
                ? <Button variant="outline" onClick={() => cancelCut(id)}>{s.shared.cancel}</Button>
                : <Button variant="outline" onClick={() => runCut(id, req)}>{s.room.cutBtn}</Button>}
              {busy && <span className="text-sm text-muted-foreground" role="status">{s.shared.running}</span>}
            </div>
            {entry && !fresh && <p className="flex flex-wrap items-center gap-2 text-sm"><Badge variant="destructive" className="badge">{s.room.stale}</Badge><span className="text-muted-foreground">{s.room.staleNote}</span></p>}
            {!entry && (
              <div className="empty flex flex-col items-start gap-1 rounded-lg border border-dashed p-5"><b>{s.room.emptyCutTitle}</b><p className="text-sm text-muted-foreground">{s.room.cutHint}</p></div>
            )}
            {cut && !blocked && <p className="max-w-[66ch] text-sm text-muted-foreground">{s.room.cutCap(Math.round(cut.PL), Math.round(cut.PW), cut.plates.length, use)}</p>}
            {cut && !blocked && cut.splitCount > 0 && <p className="text-xs text-muted-foreground">{s.room.splitNote(cut.splitCount)}</p>}
            {cut && cut.clamped.length > 0 && <p className="text-xs text-muted-foreground">{s.room.clampedNote(cut.clamped.map((c) => pieceLabel(c.room, c.ids, c.seg)).join(', '))}</p>}
            {cut && <Blocking issues={cut.blocking} />}
            {cut && <ExportButtons R={cut} title={roomName(id)} />}
            <div className={entry && !fresh ? 'stale opacity-50' : undefined}><SheetGrid sheets={sheets} /></div>
          </CardContent>
        </Card>
      </main>

      <aside className="right border-t p-4 md:col-span-2 lg:sticky lg:top-[var(--barh,112px)] lg:col-span-1 lg:max-h-[calc(100vh-var(--barh,112px))] lg:self-start lg:overflow-auto lg:border-t-0 lg:border-l" aria-label={s.room.inspector}>
        <section className="mb-6" aria-labelledby="dim-h">
          <h2 id="dim-h" className="mb-1 text-base font-semibold">{s.room.dimensions}</h2>
          <Dimensions id={id} model={model} />
          <Button variant="outline" className="mt-3" onClick={() => resetRoom(id)}>{s.history.resetBtn}</Button>
        </section>
        <section className="mb-6 flex flex-col gap-2" aria-labelledby="sp-h">
          <h2 id="sp-h" className="text-base font-semibold">{s.room.startPoints}</h2>
          <p className="text-sm text-muted-foreground">{s.room.startCap}</p>
          <StartPoints id={id} model={model} selected={selKey} onSelect={(k) => select(id, k)} />
          {ref && (
            <Section title={s.room.refsOne(ref.id)}>
              <p className="text-xs text-muted-foreground">{ref.where}</p>
              <p className="text-xs text-muted-foreground">{ref.coord}</p>
              <p className="text-xs text-muted-foreground">{s.room.fieldsOf(ref.fields)}</p>
            </Section>
          )}
        </section>
        <section className="mb-6" aria-labelledby="refs-h">
          <h2 id="refs-h" className="text-base font-semibold">{s.room.refs}</h2>
          <Section title={s.room.refsTable} keepMounted>
            <p className="mb-2 text-sm text-muted-foreground">{s.room.refsCap}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr>{s.room.refsHead.map((h) => <th key={h} className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">{h}</th>)}</tr></thead>
                <tbody>{model.refs.map((r) => <tr key={r.id} className="border-t"><td className="px-2 py-1.5 font-semibold">{r.id}</td><td className="px-2 py-1.5">{r.name}</td><td className="px-2 py-1.5">{r.fields}</td><td className="px-2 py-1.5">{r.where}</td><td className="px-2 py-1.5">{r.coord}</td></tr>)}</tbody>
              </table>
            </div>
            {isAttic(model) && <p className="mt-2 text-xs text-muted-foreground">{s.room.refsNoteAttic}</p>}
          </Section>
        </section>
        <SettingsPanel />
      </aside>
    </div>
  );
}
