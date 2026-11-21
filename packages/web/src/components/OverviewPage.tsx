import { useMemo } from 'react';
import { ROOMS, ROOM_IDS, pieceArea, roomSlivers } from '@slabs/core';
import { bandName, lang, nf, roomName, roomNameByKey, s } from '../i18n';
import { AlertTriangle, Check } from 'lucide-react';
import { buildRequest, hashRequest, roomModel } from '../cut/request';
import { bandTab, useStore } from '../state/store';
import { ArrowRight } from 'lucide-react';
import { CheckField } from './Fields';
import { Section } from '@/components/ui/collapsible';
import { Blocking, pieceLabel } from './Issues';
import { ExportButtons } from './ExportButtons';
import { SettingsPanel } from './SettingsPanel';
import { SheetGrid, Stats } from './Svg';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

const SLOT = 'rozkroj';
const PAT: Record<string, string> = { S: 'r0', Sy: 'r1', 'Ł1': 'r2', 'Ł2': 'r3' };

export function OverviewPage() {
  const project = useStore((st) => st.project);
  const entry = useStore((st) => st.cuts[SLOT]);
  const busy = useStore((st) => !!st.running[SLOT]);
  const status = useStore((st) => st.status);
  const { runCut, cancelCut, setRoomOn, setBand, setTab } = useStore.getState();
  const req = useMemo(() => buildRequest(project), [project]);
  const fresh = !!entry && entry.key === hashRequest(req);
  const R = entry?.result ?? null;
  const plainEntry = useStore((st) => st.cuts['rozkroj:plain']);
  const plain = R?.tongue && plainEntry && plainEntry.result.blocking.length === 0 ? plainEntry.result : null;
  const blocked = !!R && R.blocking.length > 0;
  const info = ROOM_IDS.map((id) => {
    const m = roomModel(project, id, lang);
    const r = req.rooms.find((x) => x.key === ROOMS[id].key)!;
    const fit = r.pieces.reduce((a, p) => a + pieceArea(p), 0);
    return { id, m, n: r.pieces.length, area: fit / 1e4, fit, slivers: roomSlivers(m, project.settings.minStripCm).length };
  });
  const warnings = R ? R.blocking.length + R.slivers.length + R.clamped.length + R.notes.length : 0;
  const bandNote = !!R && R.notes.some((n) => n.code === 'bandTooTall');
  const stale = !!R && !fresh;
  const wide = typeof window === 'undefined' || window.innerWidth >= 768;
  return (
    <main id="main" className="shared-wrap mx-auto flex max-w-[1760px] flex-col gap-5 p-4" data-room="przeglad">
      <div className="flex flex-col gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">{s.overview.title}</h1><p className="max-w-[66ch] text-sm text-muted-foreground">{s.overview.intro}</p></div>
        <div className="flex flex-wrap items-center gap-3">
          {busy
            ? <Button variant="outline" onClick={() => cancelCut(SLOT)}>{s.shared.cancel}</Button>
            : <Button id="calc2" onClick={() => runCut(SLOT, req)}>{s.bar.calc}</Button>}
          <span className="text-sm text-muted-foreground" role="status">
            {busy ? s.shared.running : status.startsWith('error:') ? `${s.shared.failed}: ${status.slice(6)}` : R && fresh ? s.shared.done(R.plates.length) : ''}
          </span>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>{s.overview.totalTitle}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!R && <p className="text-sm text-muted-foreground">{s.shared.emptyBody}</p>}
          {R && !blocked && <p className={'text-xl font-semibold tracking-tight' + (stale ? ' opacity-50' : '')} data-testid="project-total">{s.overview.total(R.plates.length, nf(Math.round(R.stats.cost)), Math.round((1 - R.stats.utilisation) * 100))}</p>}
          {R && <p className="flex items-center gap-1.5 text-sm" role="status">{blocked ? <><AlertTriangle className="size-4 text-destructive" />{s.bar.blocked}</> : warnings ? <><AlertTriangle className="size-4 text-warning" />{s.bar.warnings(warnings)}</> : <><Check className="size-4 text-success" />{s.bar.noWarnings}</>}</p>}
          {stale && <p className="flex flex-wrap items-center gap-2 text-sm"><Badge variant="destructive" className="badge">{s.room.stale}</Badge><span className="text-muted-foreground">{s.room.staleNote}</span><Button size="sm" onClick={() => runCut(SLOT, req)}>{s.bar.calc}</Button></p>}
          {R && <Blocking issues={R.blocking} />}
          {R && !blocked && (
            <div className={fresh ? undefined : 'stale opacity-50'}>
              <Stats items={[
                [R.plates.length, s.shared.stats.plates],
                ...(plain ? [[plain.plates.length, s.shared.stats.plain + ' · ' + s.shared.stats.plainDiff(R.plates.length - plain.plates.length)] as [number, string]] : []),
                [nf(R.stats.grossM2, 1) + ' m²', s.shared.stats.gross],
                [nf(Math.round(R.stats.cost)) + ' zł', s.shared.stats.cost(project.settings.platePrice)],
                [Math.round(R.stats.utilisation * 100) + '%', s.shared.stats.util],
              ]} />
              <Section title={s.overview.details} defaultOpen={wide}>
                <Stats items={[
                  [R.roomPlates, s.shared.stats.rooms],
                  [R.extraPlates, s.shared.stats.extra],
                  [R.stats.separate, s.shared.stats.separate],
                  [Math.round(R.fromOff) + ' cm', s.shared.stats.fromOff],
                  ...(R.stats.kerfM2 > 0 ? [[nf(R.stats.kerfM2, 2) + ' m²', s.shared.stats.kerf] as [string, string]] : []),
                  ...(R.stats.allowanceM2 > 0 ? [[nf(R.stats.allowanceM2, 2) + ' m²', s.shared.stats.allowance] as [string, string]] : []),
                  ...(R.stats.offcutKeptM2 > 0 ? [[nf(R.stats.offcutKeptM2, 2) + ' m²', s.shared.stats.offcuts] as [string, string]] : []),
                  [nf(R.stats.wasteM2, 2) + ' m²', s.shared.stats.waste],
                ]} />
              </Section>
            </div>
          )}
          {R && R.tongue && !blocked && <p className="max-w-[80ch] text-xs text-muted-foreground">{s.shared.tgNote}</p>}
          {R && R.splitCount > 0 && !blocked && <p className="text-xs text-muted-foreground">{s.room.splitNote(R.splitCount)}</p>}
          {R && R.clamped.length > 0 && <p className="text-xs text-muted-foreground">{s.room.clampedNote(R.clamped.map((c) => pieceLabel(c.room, c.ids, c.seg)).join(', '))}</p>}
          {R && R.slivers.length > 0 && <p className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm" role="status">{s.room.slivers(R.slivers.length, project.settings.minStripCm)}: {R.slivers.map((v) => `${pieceLabel(v.room, v.ids)} ${nf(v.width, 1)} cm`).join('; ')}</p>}
          {R && R.notes.length > 0 && <p className="text-sm text-destructive">{R.notes.map((n) => (n.code === 'plateDiffers' ? s.shared.plateDiffers(roomNameByKey(n.room), n.PL, n.PW) : s.shared.bandTooTall)).join('; ')}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{s.overview.itemsTitle}</CardTitle></CardHeader>
        <CardContent className="relative overflow-x-auto">
          <table className="w-full text-sm" data-testid="items-table">
            <thead><tr>{s.overview.head.map((h, i) => <th key={h} scope="col" className={'px-2 py-2 text-left text-xs font-medium text-muted-foreground' + (i === 1 || i === 2 || i === 3 ? ' max-sm:hidden' : '')}>{h}</th>)}</tr></thead>
            <tbody>
              {info.map(({ id, n, area, slivers }) => {
                const on = project.rooms[id].on, per = R?.per.find((x) => x.key === ROOMS[id].key);
                return (
                  <tr key={id} className="border-t" data-item={id}>
                    <td className="px-2 py-1.5">
                      <button type="button" className="group inline-flex min-h-11 items-center gap-1.5 rounded-md text-left font-medium hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none" data-open={id} aria-label={s.overview.open(roomName(id))} onClick={() => setTab(id)}>
                        <svg className="h-[18px] w-7 shrink-0 rounded-sm border" viewBox="0 0 28 18" aria-hidden="true"><rect width="28" height="18" style={{ fill: `url(#pt-${PAT[ROOMS[id].key]})` }} /></svg>
                        {roomName(id)}<ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                      </button>
                      <span className="block text-xs text-muted-foreground sm:hidden">{on ? s.shared.pieces(n, nf(area, 1), Math.round(req.rooms.find((x) => x.key === ROOMS[id].key)!.PL), Math.round(req.rooms.find((x) => x.key === ROOMS[id].key)!.PW)) : s.overview.off}</span>
                    </td>
                    <td className="px-2 py-1.5 max-sm:hidden">{n}</td>
                    <td className="px-2 py-1.5 max-sm:hidden">{nf(area, 1)} m²</td>
                    <td className="px-2 py-1.5 max-sm:hidden">{per && on ? per.alone : '–'}</td>
                    <td className="px-2 py-1.5">{slivers > 0 && on ? <Badge variant="warning" role="status">{s.room.slivers(slivers, project.settings.minStripCm)}</Badge> : <span className="text-muted-foreground">{on ? s.overview.ok : s.overview.off}</span>}</td>
                    <td className="px-2 py-1.5"><Label className="flex min-h-11 items-center gap-2"><CheckField id={`on_${id}`} checked={on} onChange={(v) => setRoomOn(id, v)} /><span className="sr-only">{s.overview.include(roomName(id))}</span></Label></td>
                  </tr>
                );
              })}
              {project.bands.map((b) => {
                const name = bandName(b);
                return (
                  <tr key={b.id} className="border-t" data-item={bandTab(b.id)}>
                    <td className="px-2 py-1.5">
                      <button type="button" className="group inline-flex min-h-11 items-center gap-1.5 rounded-md text-left font-medium hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none" data-open={bandTab(b.id)} aria-label={s.overview.open(name)} onClick={() => setTab(bandTab(b.id))}>
                        <svg className="h-[18px] w-7 shrink-0 rounded-sm border" viewBox="0 0 28 18" aria-hidden="true"><rect x="1" y="1" width="26" height="16" fill="none" stroke="currentColor" strokeDasharray="4 3" /></svg>
                        {name}<ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                      </button>
                      <span className="block text-xs text-muted-foreground sm:hidden">{b.on ? `${b.len} × ${b.h} cm` : s.overview.off}</span>
                    </td>
                    <td className="px-2 py-1.5 max-sm:hidden">{R && b.on && b.len > 0 ? s.overview.bandPieces(R.segs.length) : '–'}</td>
                    <td className="px-2 py-1.5 max-sm:hidden">{nf((b.len * b.h) / 1e4, 1)} m²</td>
                    <td className="px-2 py-1.5 max-sm:hidden">{R && b.on ? R.bandAlone : '–'}</td>
                    <td className="px-2 py-1.5">{bandNote && b.on ? <Badge variant="warning" role="status">{s.band.tooTall}</Badge> : <span className="text-muted-foreground">{b.on ? s.overview.ok : s.overview.off}</span>}</td>
                    <td className="px-2 py-1.5"><Label className="flex min-h-11 items-center gap-2"><CheckField id={`on_${b.id}`} checked={b.on} onChange={(v) => setBand(b.id, { on: v })} /><span className="sr-only">{s.overview.include(name)}</span></Label></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {!R && <div className="empty flex flex-col items-start gap-1 rounded-xl border border-dashed p-6"><b>{s.shared.emptyTitle}</b><p className="text-sm text-muted-foreground">{s.shared.emptyBody}</p></div>}
      {R && (
        <>
          <Card>
            <CardHeader><CardTitle>{s.overview.platesTitle}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="max-w-[80ch] text-sm text-muted-foreground">{s.shared.sheetsCap}</p>
              {fresh && <ExportButtons R={R} title={s.app.sharedTab} />}
              {!blocked && <Section title={s.overview.showPlates(R.plates.length)} defaultOpen={wide}><div className={fresh ? undefined : 'stale opacity-50'}><SheetGrid R={R} minOffcut={project.settings.minOffcutCm} minStrip={project.settings.minStripCm} /></div></Section>}
            </CardContent>
          </Card>
        </>
      )}
      <Card><CardContent><SettingsPanel /></CardContent></Card>
    </main>
  );
}
