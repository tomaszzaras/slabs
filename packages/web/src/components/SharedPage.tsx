import { useMemo } from 'react';
import { ROOMS, ROOM_IDS, pieceArea, roomSlivers } from '@slabs/core';
import { lang, nf, roomName, roomNameByKey, s } from '../i18n';
import { buildRequest, hashRequest, roomModel } from '../cut/request';
import { useStore } from '../state/store';
import { CheckField, NumField } from './Fields';
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

export function SharedPage() {
  const project = useStore((st) => st.project);
  const entry = useStore((st) => st.cuts[SLOT]);
  const busy = useStore((st) => !!st.running[SLOT]);
  const status = useStore((st) => st.status);
  const { runCut, cancelCut, setRoomOn, setBand, setShared } = useStore.getState();
  const req = useMemo(() => buildRequest(project), [project]);
  const fresh = !!entry && entry.key === hashRequest(req);
  const R = entry?.result ?? null;
  const blocked = !!R && R.blocking.length > 0;
  const band = project.shared.band;
  const info = ROOM_IDS.map((id) => {
    const m = roomModel(project, id, lang);
    const r = req.rooms.find((x) => x.key === ROOMS[id].key)!;
    const fit = r.pieces.reduce((a, p) => a + pieceArea(p), 0);
    return { id, m, n: r.pieces.length, area: fit / 1e4, fit, slivers: roomSlivers(m, project.settings.minStripCm).length };
  });
  return (
    <main id="main" className="shared-wrap mx-auto flex max-w-[1760px] flex-col gap-5 p-4" data-room="rozkroj">
      <div className="flex flex-col gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">{s.shared.title}</h1><p className="max-w-[66ch] text-sm text-muted-foreground">{s.shared.intro}</p></div>
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
        <CardHeader><CardTitle>{s.shared.rooms}</CardTitle></CardHeader>
        <CardContent className="flex flex-col">
          {info.map(({ id, n, area, m, slivers }) => (
            <div className="room-row flex flex-wrap items-center gap-x-4 gap-y-1 border-b py-1.5 last:border-b-0" key={id}>
              <svg className="h-[18px] w-7 shrink-0 rounded-sm border" viewBox="0 0 28 18" aria-hidden="true"><rect width="28" height="18" style={{ fill: `url(#pt-${PAT[ROOMS[id].key]})` }} /></svg>
              <b className="min-w-28">{roomName(id)}</b>
              <Label className="flex min-h-11 items-center gap-2"><CheckField id={`on_${id}`} checked={project.rooms[id].on} onChange={(v) => setRoomOn(id, v)} />{s.shared.include}</Label>
              <span className="text-sm text-muted-foreground">{s.shared.pieces(n, nf(area, 1), Math.round(m.p.PL!), Math.round(m.p.PW!))}</span>
              {slivers > 0 && project.rooms[id].on && <Badge variant="warning" role="status">{s.room.slivers(slivers, project.settings.minStripCm)}</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{s.shared.band}</CardTitle></CardHeader>
        <CardContent className="grid gap-x-8 gap-y-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,20rem),1fr))]">
          <BandRow id="bl" label={s.shared.bandLen} unit="cm"><NumField id="bl" className="flex-1 basis-16" value={band.len} onValue={(v) => setBand({ len: v })} /></BandRow>
          <BandRow id="bh" label={s.shared.bandH} unit="cm"><NumField id="bh" className="flex-1 basis-16" value={band.h} onValue={(v) => setBand({ h: v })} /></BandRow>
          <BandRow id="bm" label={s.shared.bandMin} unit="cm"><NumField id="bm" className="flex-1 basis-16" value={band.min} onValue={(v) => setBand({ min: v })} /></BandRow>
          <BandRow id="bx" label={s.shared.bandMax} unit="cm"><NumField id="bx" className="flex-1 basis-16" value={band.max} onValue={(v) => setBand({ max: v })} /></BandRow>
          <BandRow id="pr" label={s.shared.price} unit="zł"><NumField id="pr" className="flex-1 basis-16" value={project.shared.price} onValue={(v) => setShared({ price: v })} /></BandRow>
          <BandRow id="bu" label={s.shared.bandUse}><CheckField id="bu" checked={!!band.use} onChange={(v) => setBand({ use: v ? 1 : 0 })} /></BandRow>
          <BandRow id="sp" label={s.shared.split}><CheckField id="sp" checked={project.shared.split} onChange={(v) => setShared({ split: v })} /></BandRow>
        </CardContent>
      </Card>
      <Card><CardContent><SettingsPanel /></CardContent></Card>
      {!R && <div className="empty flex flex-col items-start gap-1 rounded-xl border border-dashed p-6"><b>{s.shared.emptyTitle}</b><p className="text-sm text-muted-foreground">{s.shared.emptyBody}</p></div>}
      {R && (
        <>
          <Card>
            <CardHeader><CardTitle>{s.room.summary}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!fresh && <p className="flex flex-wrap items-center gap-2 text-sm"><Badge variant="destructive" className="badge">{s.room.stale}</Badge><span className="text-muted-foreground">{s.room.staleNote}</span></p>}
              <Blocking issues={R.blocking} />
              {!blocked && <div className={fresh ? undefined : 'stale opacity-50'}><Stats items={[
                [R.plates.length, s.shared.stats.plates],
                [nf(R.stats.grossM2, 1) + ' m²', s.shared.stats.gross],
                [Math.round(R.stats.utilisation * 100) + '%', s.shared.stats.util],
                [nf(Math.round(R.stats.cost)) + ' zł', s.shared.stats.cost(project.shared.price)],
                [R.roomPlates, s.shared.stats.rooms],
                [R.extraPlates, s.shared.stats.extra],
                [R.stats.separate, s.shared.stats.separate],
                [Math.round(R.fromOff) + ' cm', s.shared.stats.fromOff],
                ...(R.stats.kerfM2 > 0 ? [[nf(R.stats.kerfM2, 2) + ' m²', s.shared.stats.kerf] as [string, string]] : []),
                ...(R.stats.allowanceM2 > 0 ? [[nf(R.stats.allowanceM2, 2) + ' m²', s.shared.stats.allowance] as [string, string]] : []),
                ...(R.stats.offcutKeptM2 > 0 ? [[nf(R.stats.offcutKeptM2, 2) + ' m²', s.shared.stats.offcuts] as [string, string]] : []),
                [nf(R.stats.wasteM2, 2) + ' m²', s.shared.stats.waste],
              ]} /></div>}
              {R.splitCount > 0 && !blocked && <p className="text-xs text-muted-foreground">{s.room.splitNote(R.splitCount)}</p>}
              {R.clamped.length > 0 && <p className="text-xs text-muted-foreground">{s.room.clampedNote(R.clamped.map((c) => pieceLabel(c.room, c.ids, c.seg)).join(', '))}</p>}
              {R.slivers.length > 0 && <p className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm" role="status">{s.room.slivers(R.slivers.length, project.settings.minStripCm)}: {R.slivers.map((v) => `${pieceLabel(v.room, v.ids)} ${nf(v.width, 1)} cm`).join('; ')}</p>}
              {R.notes.length > 0 && <p className="text-sm text-destructive">{R.notes.map((n) => (n.code === 'plateDiffers' ? s.shared.plateDiffers(roomNameByKey(n.room), n.PL, n.PW) : s.shared.bandTooTall)).join('; ')}</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr>{s.shared.tableHead.map((h) => <th key={h} className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>)}</tr></thead>
                  <tbody>
                    {R.per.map((p) => {
                      const i = info.find((x) => ROOMS[x.id].key === p.key)!;
                      const win = (i.fit - i.m.areaCm2) / 1e4, allow = (p.area - i.fit) / 1e4;
                      const diff = [win > 0.005 ? `${s.shared.diffWindow} ${nf(win, 2)}` : '', allow > 0.005 ? `${s.shared.diffAllow} ${nf(allow, 2)}` : ''].filter(Boolean).join(', ');
                      return <tr key={p.key} className="border-t"><td className="px-2 py-2 font-medium">{roomNameByKey(p.key)}</td><td className="px-2 py-2">{p.n}</td><td className="px-2 py-2">{nf(i.m.areaM2, 1)} m²</td><td className="px-2 py-2">{nf(p.area / 1e4, 1)} m²{diff && <span className="text-xs text-muted-foreground"> ({s.shared.netDiff.toLowerCase()}: +{diff} m²)</span>}</td><td className="px-2 py-2">{p.alone}</td></tr>;
                    })}
                    <tr className="border-t"><td className="px-2 py-2 font-medium">{s.shared.bandRow}</td><td className="px-2 py-2">{s.shared.bandPieces(R.segs.length)}</td><td className="px-2 py-2">–</td><td className="px-2 py-2">{nf((R.bandLen * R.bandH) / 1e4, 1)} m²</td><td className="px-2 py-2">{R.bandAlone}</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="max-w-[80ch] text-sm text-muted-foreground">
                {s.shared.sumCap(Math.round(R.bandLen), Math.round(R.bandH), Math.round(R.fromOff), Math.round(R.bandLen - R.fromOff), R.extraPlates, R.segs.length, Math.round(Math.min(band.max || R.PW, R.PW)), R.stats.separate - R.plates.length)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{s.room.cut}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="max-w-[80ch] text-sm text-muted-foreground">{s.shared.sheetsCap}</p>
              <ExportButtons R={R} title={s.app.sharedTab} />
              <div className={fresh ? undefined : 'stale opacity-50'}>{!blocked && <SheetGrid R={R} minOffcut={project.settings.minOffcutCm} minStrip={project.settings.minStripCm} />}</div>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

function BandRow({ id, label, unit, children }: { id: string; label: string; unit?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-3">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5">{children}{unit && <span className="text-sm text-muted-foreground">{unit}</span>}</div>
    </div>
  );
}
