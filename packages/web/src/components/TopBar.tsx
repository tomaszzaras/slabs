import { useEffect, useRef, useState } from 'react';
import { ROOM_IDS, type RoomId } from '@slabs/core';
import { buildRequest, hashRequest } from '../cut/request';
import { roomName, s } from '../i18n';
import { sanitizeProject } from '../state/project';
import { useStore, type Tab, type Theme } from '../state/store';
import { IconCheck, IconMenu, IconPlus, IconRedo, IconRefresh, IconUndo, IconWarn } from './Icons';

const NEXT_THEME: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };
export const SHARED = 'rozkroj';

/** Top bar: project, room switcher, the project's total (always visible), the main action. */
export function TopBar() {
  const project = useStore((st) => st.project);
  const projects = useStore((st) => st.projects);
  const tab = useStore((st) => st.tab);
  const theme = useStore((st) => st.theme);
  const lang = useStore((st) => st.lang);
  const status = useStore((st) => st.status);
  const entry = useStore((st) => st.cuts[SHARED]);
  const missing = useStore((st) => st.empty.length);
  const busy = useStore((st) => !!st.running[SHARED]);
  const canUndo = useStore((st) => st.past.length > 0);
  const canRedo = useStore((st) => st.future.length > 0);
  const { setTab, setName, setTheme, setLang, loadProject, resetAll, shareLink, setStatus, undo, redo, newProject, switchProject, deleteProject, runCut, cancelCut } = useStore.getState();
  const [menu, setMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLElement>(null);
  useEffect(() => { // the side columns stick below the bar, whatever height it has
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--barh', el.offsetHeight + 'px'));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const tabs: Array<[Tab, string]> = [...ROOM_IDS.map((id: RoomId): [Tab, string] => [id, roomName(id)]), [SHARED, s.app.sharedTab]];
  const req = buildRequest(project);
  const R = entry?.result;
  const fresh = !!entry && entry.key === hashRequest(req);
  const warnings = R ? R.blocking.length + R.slivers.length + R.clamped.length + R.notes.length : 0;
  const ok = R && R.blocking.length === 0;

  const doExport = () => {
    const blob = new Blob([JSON.stringify(project, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (project.name.replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'projekt') + '.slabs.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setStatus(s.project.exported);
  };
  const doImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const p = sanitizeProject(JSON.parse(await file.text()));
      if (!p) throw new Error('format');
      loadProject(p);
      setStatus(s.project.imported);
    } catch { setStatus(s.project.importFailed); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const doShare = async () => {
    const url = shareLink();
    try { await navigator.clipboard.writeText(url); setStatus(s.project.linkCopied); }
    catch { setStatus(s.project.linkShown + ' ' + url); }
  };
  const msg = status === 'link' ? s.project.openedFromLink : status.startsWith('error:') ? '' : status;
  const list = projects.some((p) => p.id === project.id) ? projects : [{ id: project.id, name: project.name, updatedAt: 0 }, ...projects];
  return (
    <header className="bar" ref={barRef}>
      <a className="skip" href="#main">{s.bar.skip}</a>
      <a className="skip" href="#dim-h">{s.bar.skipDims}</a>
      <div className="bar-in">
        <span className="brand">Slabs</span>
        <div className="projsel">
          <label className="sr" htmlFor="projsel">{s.bar.project}</label>
          <select id="projsel" value={project.id} onChange={(e) => void switchProject(e.target.value)}>
            {list.map((p) => <option key={p.id} value={p.id}>{p.id === project.id ? project.name : p.name}</option>)}
          </select>
          <button type="button" className="quiet addproj" aria-label={s.bar.newProject} title={s.bar.newProject} onClick={newProject}><IconPlus /></button>
        </div>
        <span className="sp" />
        <div className="totalbar">
        <div className={'total' + (missing ? ' stale' : !R ? ' none' : fresh ? '' : ' stale')} aria-label={s.bar.totalLabel} role="group">
          {missing ? <span className="warn"><IconWarn /> {s.room.missingDims}</span> : !R ? <span className="muted">{busy ? s.bar.calculating : s.bar.noResult}</span> : !ok ? (
            <span className="warn"><IconWarn /> {s.bar.blocked}</span>
          ) : (
            <>
              <span><b>{R.plates.length}</b> {s.bar.plates(R.plates.length)}</span><span className="dot" aria-hidden="true">·</span>
              <span><b>{Math.round(R.stats.cost).toLocaleString(lang)}</b> zł</span><span className="dot" aria-hidden="true">·</span>
              <span>{s.bar.waste(Math.round((1 - R.stats.utilisation) * 100))}</span><span className="dot" aria-hidden="true">·</span>
              <button type="button" className="quiet" onClick={() => setTab(SHARED)}>{warnings ? <><IconWarn /> {s.bar.warnings(warnings)}</> : s.bar.noWarnings}</button>
            </>
          )}
        </div>
        <span className={'calcstate ' + (busy ? 'busy' : !R ? 'none' : fresh ? 'fresh' : 'stale')} role="status" aria-live="polite">
          {busy ? s.bar.calculating : !R ? '' : fresh ? <><IconCheck /> {s.bar.stateFresh}</> : <>{s.bar.stateStale}</>}
        </span>
        {busy
          ? <button type="button" onClick={() => cancelCut(SHARED)}>{s.shared.cancel}</button>
          : <button type="button" id="calc" aria-label={s.bar.calc} title={s.bar.calc} onClick={() => runCut(SHARED, req)}><IconRefresh /><span className="lbl">{s.bar.calcShort}</span></button>}
        </div>
        <button type="button" id="undo" aria-label={s.history.undoHint} title={s.history.undoHint} disabled={!canUndo} onClick={undo}><IconUndo /></button>
        <button type="button" id="redo" aria-label={s.history.redoHint} title={s.history.redoHint} disabled={!canRedo} onClick={redo}><IconRedo /></button>
        <div className="menu" onKeyDown={(e) => { if (e.key === 'Escape') setMenu(false); }}>
          <button type="button" aria-haspopup="true" aria-expanded={menu} aria-label={s.bar.menu} onClick={() => setMenu(!menu)}><IconMenu /> <span className="lbl">{s.bar.menu}</span></button>
          {menu && (
            <div className="menu-pop" role="group" aria-label={s.bar.menu}>
              <p className="note">{s.project.storageNote}</p>
              <label htmlFor="pname">{s.project.name}</label>
              <input id="pname" type="text" value={project.name} onChange={(e) => setName(e.target.value)} />
              <button type="button" onClick={() => { newProject(); setMenu(false); }}>{s.bar.newProject}</button>
              <button type="button" onClick={resetAll}>{s.history.resetBtn}</button>
              <button type="button" onClick={doExport}>{s.project.export}</button>
              <button type="button" onClick={() => fileRef.current?.click()}>{s.project.import}</button>
              <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => void doImport(e.target.files?.[0])} />
              <button type="button" onClick={() => void doShare()}>{s.project.share}</button>
              <button type="button" onClick={() => setTheme(NEXT_THEME[theme])}>{s.project.theme[theme]}</button>
              <div className="seg" role="group" aria-label={s.app.language}>
                {(['pl', 'en'] as const).map((l) => <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
              </div>
              {projects.length > 1 && <button type="button" onClick={() => { if (confirm(s.bar.deleteConfirm(project.name))) void deleteProject(project.id); }}>{s.bar.deleteProject}</button>}
            </div>
          )}
        </div>
      </div>
      <div className="bar-rooms">
        <div className="rooms" role="tablist" aria-label={s.app.tabsLabel}>
          {tabs.map(([id, name]) => (
            <button key={id} type="button" role="tab" id={`tab-${id}`} data-t={id} aria-selected={tab === id} onClick={() => setTab(id)}>{name}</button>
          ))}
        </div>
      </div>
      {msg && <p className="note-line" role="status">{msg}</p>}
    </header>
  );
}
