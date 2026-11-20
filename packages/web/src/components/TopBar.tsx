import { useEffect, useRef, useState } from 'react';
import { ROOM_IDS, type RoomId } from '@slabs/core';
import { AlertTriangle, Check, Layers, Loader2, Menu, Pencil, Plus, Redo2, RefreshCw, Undo2 } from 'lucide-react';
import { buildRequest, hashRequest } from '../cut/request';
import { roomName, s } from '../i18n';
import { sanitizeProject } from '../state/project';
import { useStore, type Tab, type Theme } from '../state/store';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
  const fileRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const [renaming, setRenaming] = useState(false);
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
    <header className="bar sticky top-0 z-30 border-b bg-background md:bg-background/85 md:backdrop-blur" ref={barRef}>
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-background" href="#main">{s.bar.skip}</a>
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-14 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-background" href="#dim-h">{s.bar.skipDims}</a>
      <div className="mx-auto flex max-w-[1760px] flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-2.5">
        <span className="hidden items-center gap-2 pr-1 text-base font-semibold tracking-tight md:flex"><span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Layers className="size-4" /></span>Slabs</span>
        <div className="flex min-w-0 flex-1 items-center gap-1 md:flex-none">
          {renaming ? (
            <Input autoFocus aria-label={s.project.name} className="w-56 max-w-full" value={project.name} onChange={(e) => setName(e.target.value)} onBlur={() => setRenaming(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setRenaming(false); }} />
          ) : (
            <Select value={project.id} onValueChange={(v) => void switchProject(v)}>
              <SelectTrigger aria-label={s.bar.project} className="w-full min-w-0 md:w-56"><SelectValue>{project.name}</SelectValue></SelectTrigger>
              <SelectContent>{list.map((p) => <SelectItem key={p.id} value={p.id}>{p.id === project.id ? project.name : p.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Tip label={s.bar.rename}><Button variant="ghost" size="icon" aria-label={s.bar.rename} onClick={() => setRenaming(true)}><Pencil /></Button></Tip>
          <Tip label={s.bar.newProject}><Button variant="ghost" size="icon" className="max-md:hidden" aria-label={s.bar.newProject} onClick={newProject}><Plus /></Button></Tip>
        </div>
        <span className="hidden flex-1 md:block" />
        <div className="totalbar contents max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:flex max-md:items-center max-md:gap-2 max-md:border-t max-md:bg-card max-md:p-2 max-md:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className={cn('total flex min-h-11 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg border bg-card px-3 py-1 text-sm md:flex-none', (missing || (R && !fresh)) && 'stale border-dashed', !R && !missing && 'none')} aria-label={s.bar.totalLabel} role="group">
            {missing ? <span className="flex items-center gap-1.5 text-destructive"><AlertTriangle className="size-4" />{s.room.missingDims}</span> : !R ? <span className="text-muted-foreground">{busy ? s.bar.calculating : s.bar.noResult}</span> : !ok ? (
              <span className="flex items-center gap-1.5 text-destructive"><AlertTriangle className="size-4" />{s.bar.blocked}</span>
            ) : (
              <>
                <span><b className="text-base">{R.plates.length}</b> {s.bar.plates(R.plates.length)}</span>
                <span><b className="text-base">{Math.round(R.stats.cost).toLocaleString(lang)}</b> zł</span>
                <span className="text-muted-foreground">{s.bar.waste(Math.round((1 - R.stats.utilisation) * 100))}</span>
                <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-medium hover:underline" onClick={() => setTab(SHARED)}>
                  {warnings ? <><AlertTriangle className="size-4 text-warning" />{s.bar.warnings(warnings)}</> : <><Check className="size-4 text-success" />{s.bar.noWarnings}</>}
                </button>
              </>
            )}
          </div>
          <span className={cn('calcstate', busy ? 'busy' : !R ? 'none' : fresh ? 'fresh' : 'stale', 'inline-flex items-center gap-1 text-sm font-medium whitespace-nowrap', !busy && R && !fresh && 'text-destructive', !busy && !R && 'hidden')} role="status" aria-live="polite">
            {busy ? <><Loader2 className="size-4 animate-spin" />{s.bar.calculating}</> : !R ? '' : fresh ? <><Check className="size-4 text-success" />{s.bar.stateFresh}</> : <>{s.bar.stateStale}</>}
          </span>
          {busy
            ? <Button variant="outline" onClick={() => cancelCut(SHARED)}>{s.shared.cancel}</Button>
            : <Button id="calc" aria-label={s.bar.calc} className="max-md:w-11 max-md:px-0" onClick={() => runCut(SHARED, req)}><RefreshCw /><span className="max-md:hidden">{s.bar.calc}</span></Button>}
        </div>
        <div className="flex items-center gap-1">
          <Tip label={s.history.undoHint}><Button id="undo" variant="outline" size="icon" aria-label={s.history.undoHint} disabled={!canUndo} onClick={undo}><Undo2 /></Button></Tip>
          <Tip label={s.history.redoHint}><Button id="redo" variant="outline" size="icon" aria-label={s.history.redoHint} disabled={!canRedo} onClick={redo}><Redo2 /></Button></Tip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" aria-label={s.bar.menu}><Menu /><span className="max-md:hidden">{s.bar.menu}</span></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="whitespace-normal">{s.project.storageNote}</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => newProject()}>{s.bar.newProject}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => resetAll()}>{s.history.resetBtn}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={doExport}>{s.project.export}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => fileRef.current?.click()}>{s.project.import}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void doShare()}>{s.project.share}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{s.app.theme}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
                {(['auto', 'light', 'dark'] as const).map((t) => <DropdownMenuRadioItem key={t} value={t}>{s.project.theme[t]}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{s.app.language}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={lang} onValueChange={(v) => setLang(v as 'pl' | 'en')}>
                <DropdownMenuRadioItem value="pl" lang="pl">Polski</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="en" lang="en">English</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              {projects.length > 1 && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onSelect={() => { if (confirm(s.bar.deleteConfirm(project.name))) void deleteProject(project.id); }}>{s.bar.deleteProject}</DropdownMenuItem></>}
            </DropdownMenuContent>
          </DropdownMenu>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => void doImport(e.target.files?.[0])} />
        </div>
      </div>
      <div className="mx-auto max-w-[1760px] overflow-x-auto px-4 py-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList aria-label={s.app.tabsLabel}>
            {tabs.map(([id, name]) => <TabsTrigger key={id} value={id} id={`tab-${id}`} data-t={id}>{name}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      </div>
      {msg && <p className="mx-auto max-w-[1760px] px-4 pb-2 text-sm text-muted-foreground" role="status">{msg}</p>}
    </header>
  );
}
