import { useRef } from 'react';
import { ROOMS, ROOM_IDS } from '@slabs/core';
import { s } from '../i18n';
import { sanitizeProject } from '../state/project';
import { useStore, type Tab, type Theme } from '../state/store';

const NEXT_THEME: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };

export function Header() {
  const project = useStore((st) => st.project);
  const tab = useStore((st) => st.tab);
  const theme = useStore((st) => st.theme);
  const status = useStore((st) => st.status);
  const { setTab, setName, setTheme, loadProject, newProject, shareLink, setStatus } = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const tabs: Array<[Tab, string]> = [...ROOM_IDS.map((id): [Tab, string] => [id, ROOMS[id].name]), ['rozkroj', s.app.sharedTab]];

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
  return (
    <div className="top">
      <div className="toprow">
        <h1>{s.app.title}</h1>
        <input className="pname" aria-label={s.project.name} value={project.name} onChange={(e) => setName(e.target.value)} />
        <div className="actions">
          <button type="button" onClick={doExport}>{s.project.export}</button>
          <button type="button" onClick={() => fileRef.current?.click()}>{s.project.import}</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => void doImport(e.target.files?.[0])} />
          <button type="button" onClick={() => void doShare()}>{s.project.share}</button>
          <button type="button" onClick={() => { if (confirm(s.project.resetConfirm)) newProject(); }}>{s.project.reset}</button>
          <button type="button" onClick={() => setTheme(NEXT_THEME[theme])}>{s.project.theme[theme]}</button>
        </div>
      </div>
      <p>{s.app.intro}</p>
      <p className="note" role="status">{msg || s.project.storageNote}</p>
      <div className="tabs" role="tablist" aria-label={s.app.tabsLabel}>
        {tabs.map(([id, name]) => (
          <button key={id} type="button" role="tab" id={`tab-${id}`} data-t={id} aria-selected={tab === id} onClick={() => setTab(id)}>{name}</button>
        ))}
      </div>
    </div>
  );
}
