import { useMemo } from 'react';
import { ROOMS, ROOM_IDS, pieceArea, roomSlivers } from '@slabs/core';
import { sharedSheets, ROOM_COLORS } from '@slabs/render';
import { s } from '../i18n';
import { buildRequest, hashRequest, roomModel } from '../cut/request';
import { useStore } from '../state/store';
import { CheckField, NumField } from './Fields';
import { Blocking, pieceLabel } from './Issues';
import { SheetGrid, Stats } from './Svg';

const SLOT = 'rozkroj';

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
  const sheets = useMemo(() => (R && !blocked ? sharedSheets(R) : []), [R, blocked]);
  const band = project.shared.band;
  const info = ROOM_IDS.map((id) => {
    const m = roomModel(project, id);
    const r = req.rooms.find((x) => x.key === ROOMS[id].key)!;
    const fit = r.pieces.reduce((a, p) => a + pieceArea(p), 0);
    return { id, m, n: r.pieces.length, area: fit / 1e4, fit, slivers: roomSlivers(m, project.settings.minStripCm).length };
  });
  const color = (key: string) => ROOM_COLORS.find((c) => c.k === key)?.col ?? '#ccc';
  return (
    <div className="wrap" data-room="rozkroj">
      <header>
        <div><h1>{s.shared.title}</h1><p>{s.shared.intro}</p></div>
        <div className="actions">
          {busy
            ? <button type="button" onClick={() => cancelCut(SLOT)}>{s.shared.cancel}</button>
            : <button type="button" className="pri" id="calc" onClick={() => runCut(SLOT, req)}>{s.shared.calc}</button>}
          <span className="status" role="status">
            {busy ? s.shared.running : status.startsWith('error:') ? `${s.shared.failed}: ${status.slice(6)}` : R && fresh ? s.shared.done(R.plates.length) : ''}
          </span>
        </div>
      </header>
      <div className="card">
        <h2>{s.shared.rooms}</h2>
        {info.map(({ id, n, area, m, slivers }) => (
          <div className="room" key={id}>
            <span className="sw" style={{ background: color(ROOMS[id].key) }} />
            <b>{ROOMS[id].name}</b>
            <label><CheckField id={`on_${id}`} checked={project.rooms[id].on} onChange={(v) => setRoomOn(id, v)} /> {s.shared.include}</label>
            <span className="unit">{s.shared.pieces(n, area.toFixed(1), Math.round(m.p.PL!), Math.round(m.p.PW!))}</span>
            {slivers > 0 && project.rooms[id].on && <span className="warn" role="status">{s.room.slivers(slivers, project.settings.minStripCm)}</span>}
          </div>
        ))}
      </div>
      <div className="card">
        <h2>{s.shared.band}</h2>
        <div className="fields wide">
          <div className="frow"><label htmlFor="bl">{s.shared.bandLen}</label><div className="in"><NumField id="bl" value={band.len} onValue={(v) => setBand({ len: v })} /><span className="unit">cm</span></div></div>
          <div className="frow"><label htmlFor="bh">{s.shared.bandH}</label><div className="in"><NumField id="bh" value={band.h} onValue={(v) => setBand({ h: v })} /><span className="unit">cm</span></div></div>
          <div className="frow"><label htmlFor="bm">{s.shared.bandMin}</label><div className="in"><NumField id="bm" value={band.min} onValue={(v) => setBand({ min: v })} /><span className="unit">cm</span></div></div>
          <div className="frow"><label htmlFor="bx">{s.shared.bandMax}</label><div className="in"><NumField id="bx" value={band.max} onValue={(v) => setBand({ max: v })} /><span className="unit">cm</span></div></div>
          <div className="frow"><label htmlFor="bu">{s.shared.bandUse}</label><div className="in"><CheckField id="bu" checked={!!band.use} onChange={(v) => setBand({ use: v ? 1 : 0 })} /></div></div>
          <div className="frow"><label htmlFor="pr">{s.shared.price}</label><div className="in"><NumField id="pr" value={project.shared.price} onValue={(v) => setShared({ price: v })} /><span className="unit">zł</span></div></div>
          <div className="frow"><label htmlFor="sp">{s.shared.split}</label><div className="in"><CheckField id="sp" checked={project.shared.split} onChange={(v) => setShared({ split: v })} /></div></div>
        </div>
      </div>
      {R && (
        <>
          <div className="card">
            <h2>{s.room.summary}</h2>
            {!fresh && <p className="warn"><span className="badge">{s.room.stale}</span> {s.room.staleNote}</p>}
            <Blocking issues={R.blocking} />
            {!blocked && <div className={fresh ? undefined : 'stale'}><Stats items={[
              [R.plates.length, s.shared.stats.plates],
              [R.stats.grossM2.toFixed(1) + ' m²', s.shared.stats.gross],
              [Math.round(R.stats.utilisation * 100) + '%', s.shared.stats.util],
              [Math.round(R.stats.cost).toLocaleString('pl-PL') + ' zł', s.shared.stats.cost(project.shared.price)],
              [R.roomPlates, s.shared.stats.rooms],
              [R.extraPlates, s.shared.stats.extra],
              [R.stats.separate, s.shared.stats.separate],
              [Math.round(R.fromOff) + ' cm', s.shared.stats.fromOff],
              ...(R.stats.kerfM2 > 0 ? [[R.stats.kerfM2.toFixed(2) + ' m²', s.shared.stats.kerf] as [string, string]] : []),
              ...(R.stats.allowanceM2 > 0 ? [[R.stats.allowanceM2.toFixed(2) + ' m²', s.shared.stats.allowance] as [string, string]] : []),
              ...(R.stats.offcutKeptM2 > 0 ? [[R.stats.offcutKeptM2.toFixed(2) + ' m²', s.shared.stats.offcuts] as [string, string]] : []),
              [R.stats.wasteM2.toFixed(2) + ' m²', s.shared.stats.waste],
            ]} /></div>}
            {R.splitCount > 0 && !blocked && <p className="note">{s.room.splitNote(R.splitCount)}</p>}
            {R.clamped.length > 0 && <p className="note">{s.room.clampedNote(R.clamped.map((c) => pieceLabel(c.room, c.ids, c.seg)).join(', '))}</p>}
            {R.slivers.length > 0 && <p className="warn" role="status">{s.room.slivers(R.slivers.length, project.settings.minStripCm)}: {R.slivers.map((v) => `${pieceLabel(v.room, v.ids)} ${Math.round(v.width * 10) / 10} cm`).join('; ')}</p>}
            {R.warn.length > 0 && <p className="warn">{R.warn.join('; ')}</p>}
            <div className="tbl">
              <table>
                <thead><tr>{s.shared.tableHead.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {R.per.map((p) => {
                    const i = info.find((x) => ROOMS[x.id].key === p.key)!;
                    const win = (i.fit - i.m.areaCm2) / 1e4, allow = (p.area - i.fit) / 1e4;
                    const diff = [win > 0.005 ? `${s.shared.diffWindow} ${win.toFixed(2)}` : '', allow > 0.005 ? `${s.shared.diffAllow} ${allow.toFixed(2)}` : ''].filter(Boolean).join(', ');
                    return <tr key={p.key}><td>{p.name}</td><td>{p.n}</td><td>{i.m.areaM2.toFixed(1)} m²</td><td>{(p.area / 1e4).toFixed(1)} m²{diff && <span className="unit"> ({s.shared.netDiff.toLowerCase()}: +{diff} m²)</span>}</td><td>{p.alone}</td></tr>;
                  })}
                  <tr><td>{s.shared.bandRow}</td><td>{s.shared.bandPieces(R.segs.length)}</td><td>–</td><td>{((R.bandLen * R.bandH) / 1e4).toFixed(1)} m²</td><td>{R.bandAlone}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="cap">
              {s.shared.sumCap(Math.round(R.bandLen), Math.round(R.bandH), Math.round(R.fromOff), Math.round(R.bandLen - R.fromOff), R.extraPlates, R.segs.length, Math.round(Math.min(band.max || R.PW, R.PW)), R.stats.separate - R.plates.length)}
            </p>
          </div>
          <div className="card">
            <h2>{s.room.cut}</h2>
            <p className="cap">{s.shared.sheetsCap}</p>
            <div className={fresh ? undefined : 'stale'}><SheetGrid sheets={sheets} /></div>
          </div>
        </>
      )}
    </div>
  );
}
