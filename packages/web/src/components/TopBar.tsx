import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Layers, Loader2, Menu, Pencil, Plus, Redo2, RefreshCw, Undo2 } from 'lucide-react';
import { buildRequest, hashRequest } from '../cut/request';
import { bandName, genericBandName, genericRoomName, roomName, s } from '../i18n';
import { InlineName } from './InlineName';
import { sanitizeProject } from '../state/project';
import { OVERVIEW, bandTab, isRoomTab, tabBandId, useStore, useTab, type Tab, type Theme } from '../state/store';
import { Button } from '@/components/ui/button';
import { AuthControls, authEnabled, canSignIn } from '@/auth';
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
  const tab = useTab();
  const theme = useStore((st) => st.theme);
  const lang = useStore((st) => st.lang);
  const status = useStore((st) => st.status);
  const sync = useStore((st) => st.sync);
  const access = useStore((st) => st.access);
  const claimLeft = useStore((st) => st.claimLeft);
  const owner = access === 'owner';
  const view = access === 'view';
  const entry = useStore((st) => st.cuts[SHARED]);
  const missing = useStore((st) => st.empty.length);
  const busy = useStore((st) => !!st.running[SHARED]);
  const canUndo = useStore((st) => st.past.length > 0);
  const canRedo = useStore((st) => st.future.length > 0);
  const { setAddOpen, renameBand, setTab, setName, setTheme, setLang, loadProject, resetAll, shareLink, cloudLink, retrySync, setStatus, undo, redo, newProject, switchProject, deleteProject, runCut, cancelCut, renameRoom, openExample, openShare, openClaim } = useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [renamingTab, setRenamingTab] = useState<Tab | null>(null);
  useEffect(() => { document.getElementById('tab-' + tab)?.scrollIntoView({ inline: 'nearest', block: 'nearest' }); }, [tab]); // the open tab is always in view in the scrollable strip
  useEffect(() => { // the side columns stick below the bar, whatever height it has
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--barh', el.offsetHeight + 'px'));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Przegląd (home) · the rooms · the bands
  const tabs: Array<[Tab, string]> = [[OVERVIEW, s.app.overviewTab], ...project.roomOrder.map((id): [Tab, string] => [id, roomName(id)]), ...project.bands.map((b): [Tab, string] => [bandTab(b.id), bandName(b)])];
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
  const doCloudLink = async () => {
    const url = cloudLink();
    if (!url) { setStatus(s.project.cloudLinkNone); return; }
    try { await navigator.clipboard.writeText(url); setStatus(s.project.cloudLinkCopied); }
    catch { setStatus(s.project.linkShown + ' ' + url); }
  };
  const msg = status === 'link' ? s.project.openedFromLink : status.startsWith('error:') ? '' : status;
  const list = projects.some((p) => p.id === project.id) ? projects : [{ id: project.id, name: project.name, updatedAt: 0 }, ...projects];
  const syncBad = sync === 'error' || sync === 'offline';
  return (
    <header className="bar sticky top-0 z-30 bg-background" ref={barRef}>
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-background" href="#main">{s.bar.skip}</a>
      {isRoomTab(tab) && <a className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-14 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-background" href="#dim-h">{s.bar.skipDims}</a>}
      {/* Row 1 - who and where: brand, project, save state | history, menu, account */}
      <div className="mx-auto flex max-w-[1760px] flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 md:gap-x-3 md:px-6">
        <span className="hidden items-center gap-2.5 pr-2 text-base font-semibold tracking-tight md:flex"><span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-xs"><Layers className="size-4" /></span>Slabs</span>
        <span aria-hidden="true" className="hidden h-6 w-px bg-border md:block" />
        <div className="flex min-w-0 flex-1 items-center gap-1 md:flex-none">
          {renaming && owner ? (
            <Input autoFocus aria-label={s.project.name} className="w-56 max-w-full font-medium" value={project.name} onChange={(e) => setName(e.target.value)} onBlur={() => setRenaming(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setRenaming(false); }} />
          ) : (
            <Select value={project.id} onValueChange={(v) => void switchProject(v)}>
              <SelectTrigger aria-label={s.bar.project} className="w-full min-w-0 font-medium md:w-64">
                <span aria-hidden="true" data-dot={sync} className={cn('size-2 shrink-0 rounded-full md:hidden', syncBad ? 'bg-destructive' : sync === 'saving' ? 'animate-pulse bg-warning' : sync === 'saved' ? 'bg-success' : 'bg-muted-foreground/50')} />
                <SelectValue>{project.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>{list.map((p) => <SelectItem key={p.id} value={p.id}>{p.id === project.id ? project.name : p.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {owner && <Tip label={s.bar.rename}><Button variant="ghost" size="icon" className="max-md:hidden" aria-label={s.bar.rename} onClick={() => setRenaming(true)}><Pencil /></Button></Tip>}
          <Tip label={s.bar.newProject}><Button variant="ghost" size="icon" className="max-md:hidden" aria-label={s.bar.newProject} onClick={newProject}><Plus /></Button></Tip>
        </div>
        {(() => {
          const Tag = syncBad ? 'button' : 'span';
          return (
            <Tag data-sync={sync} role="status" aria-live="polite" {...(syncBad ? { type: 'button' as const, onClick: retrySync, title: s.cloud.retry } : {})}
              className={cn('syncst inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium',
                syncBad ? 'text-destructive hover:bg-accent max-md:order-last max-md:basis-full max-md:justify-center max-md:border max-md:border-current' : 'text-muted-foreground max-md:sr-only')}>
              {sync === 'saving' ? <Loader2 className="size-3.5 animate-spin" /> : sync === 'saved' ? <Check className="size-3.5 text-success" /> : syncBad ? <AlertTriangle className="size-3.5" /> : null}
              {s.cloud[sync]}
            </Tag>
          );
        })()}
        <span className="flex-1 max-md:hidden" />
        <div className="inline-flex items-center divide-x overflow-hidden rounded-lg border bg-card shadow-xs">
          <Tip label={s.history.undoHint}><Button id="undo" variant="ghost" size="icon" className="rounded-none" aria-label={s.history.undoHint} disabled={!canUndo} onClick={undo}><Undo2 /></Button></Tip>
          <Tip label={s.history.redoHint}><Button id="redo" variant="ghost" size="icon" className="rounded-none" aria-label={s.history.redoHint} disabled={!canRedo} onClick={redo}><Redo2 /></Button></Tip>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" className="max-md:px-0" aria-label={s.bar.menu}><Menu /><span className="max-md:hidden">{s.bar.menu}</span></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="whitespace-normal">{sync === 'local' ? s.project.storageNoteLocal : authEnabled ? s.project.storageNoteAccount : s.project.storageNote}</DropdownMenuLabel>
            {owner && <DropdownMenuItem className="md:hidden" onSelect={() => setRenaming(true)}>{s.bar.rename}</DropdownMenuItem>}
            {authEnabled && owner && <DropdownMenuItem data-a="share" onSelect={() => void openShare()}>{s.share.menu}</DropdownMenuItem>}
            {!authEnabled && sync !== 'local' && <DropdownMenuItem data-a="copy-project-link" onSelect={() => void doCloudLink()}>{s.project.copyProjectLink}</DropdownMenuItem>}
            {authEnabled && claimLeft > 0 && <DropdownMenuItem data-a="claim-open" onSelect={() => void openClaim()}>{s.claim.menu}</DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => newProject()}>{s.bar.newProject}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openExample()}>{s.names.openExample}</DropdownMenuItem>
            <DropdownMenuItem disabled={view} onSelect={() => resetAll()}>{s.history.resetBtn}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={doExport}>{s.project.export}</DropdownMenuItem>
            <DropdownMenuItem disabled={view} onSelect={() => fileRef.current?.click()}>{s.project.import}</DropdownMenuItem>
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
            {owner && projects.length > 1 && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onSelect={() => { if (confirm(s.bar.deleteConfirm(project.name))) void deleteProject(project.id); }}>{s.bar.deleteProject}</DropdownMenuItem></>}
          </DropdownMenuContent>
        </DropdownMenu>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => void doImport(e.target.files?.[0])} />
        {(authEnabled || canSignIn) && <div className="flex min-h-11 min-w-11 items-center justify-center md:ml-1 md:border-l md:pl-3"><AuthControls /></div>}
      </div>
      {msg && <p className="border-t bg-accent/40 px-4 py-1.5 text-center text-sm text-muted-foreground md:px-6" role="status">{msg}</p>}
      {/* Row 2 - the work: rooms and the project's result | calculate */}
      <div className="mx-auto flex max-w-[1760px] items-center gap-3 border-b px-4 md:px-6 max-md:border-t">
        <div className="flex min-w-0 flex-1 items-center overflow-x-auto overflow-y-hidden pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,#000_calc(100%-1.5rem),transparent)]">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList aria-label={s.app.tabsLabel} className="h-11 gap-0.5 rounded-none bg-transparent p-0">
              {tabs.map(([id, name]) => {
                const bid = tabBandId(id);
                return renamingTab === id
                  ? <InlineName key={id} value={name} generic={bid ? genericBandName() : genericRoomName(id)} editing onEditing={(v) => { if (!v) setRenamingTab(null); }} onCommit={(n) => (bid ? renameBand(bid, n) : renameRoom(id, n))} />
                  : <TabsTrigger key={id} value={id} id={`tab-${id}`} data-t={id} title={id === OVERVIEW ? undefined : s.names.tabHint} onDoubleClick={id === OVERVIEW ? undefined : () => setRenamingTab(id)}
                      className="relative px-3.5 hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 data-[state=active]:after:opacity-100">{name}</TabsTrigger>;
              })}
            </TabsList>
          </Tabs>
        </div>
        <Tip label={s.rooms.add}><Button variant="ghost" className="shrink-0 text-muted-foreground hover:text-foreground max-xl:px-0" data-add-tab data-a="add-room" aria-label={s.rooms.add} disabled={view} onClick={() => setAddOpen(true)}><Plus /><span className="max-xl:hidden">{s.rooms.add}</span></Button></Tip>
        <div className="totalbar max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:flex max-md:items-center max-md:gap-2 max-md:border-t max-md:bg-card max-md:p-2 max-md:pb-[max(0.5rem,env(safe-area-inset-bottom))] md:flex md:shrink-0 md:items-center md:gap-3 md:py-1.5">
          <div className={cn('total flex min-h-11 flex-1 flex-wrap items-center gap-x-4 gap-y-0.5 rounded-lg border border-transparent bg-muted/70 px-3.5 py-1 text-sm md:flex-none', (missing || (R && !fresh)) && 'stale border-dashed border-border bg-card', !R && !missing && 'none')} aria-label={s.bar.totalLabel} role="group">
            {missing ? <span className="flex items-center gap-1.5 text-destructive"><AlertTriangle className="size-4" />{s.room.missingDims}</span> : !R ? <span className="text-muted-foreground">{busy ? s.bar.calculating : s.bar.noResult}</span> : !ok ? (
              <span className="flex items-center gap-1.5 text-destructive"><AlertTriangle className="size-4" />{s.bar.blocked}</span>
            ) : (
              <>
                <span className="tabular-nums"><b className="text-base font-semibold">{R.plates.length}</b> {s.bar.plates(R.plates.length)}</span>
                <span className="tabular-nums"><b className="text-base font-semibold">{Math.round(R.stats.cost).toLocaleString(lang)}</b> zł</span>
                <span className="tabular-nums text-muted-foreground">{s.bar.waste(Math.round((1 - R.stats.utilisation) * 100))}</span>
                <button type="button" className="-mr-1.5 inline-flex min-h-11 items-center gap-1 rounded-md px-1.5 text-sm font-medium hover:bg-accent" onClick={() => setTab(OVERVIEW)}>
                  {warnings ? <><AlertTriangle className="size-4 text-warning" />{s.bar.warnings(warnings)}</> : <><Check className="size-4 text-success" />{s.bar.noWarnings}</>}
                </button>
              </>
            )}
          </div>
          <span className={cn('calcstate', busy ? 'busy' : !R ? 'none' : fresh ? 'fresh' : 'stale', 'inline-flex items-center gap-1 text-sm font-medium whitespace-nowrap', !busy && R && !fresh && 'text-destructive', !busy && R && fresh && 'sr-only', !busy && !R && 'hidden')} role="status" aria-live="polite">
            {busy ? <><Loader2 className="size-4 animate-spin" />{s.bar.calculating}</> : !R ? '' : fresh ? <><Check className="size-4 text-success" />{s.bar.stateFresh}</> : <>{s.bar.stateStale}</>}
          </span>
          {busy
            ? <Button variant="outline" onClick={() => cancelCut(SHARED)}>{s.shared.cancel}</Button>
            : <Button id="calc" aria-label={s.bar.calc} className="max-md:w-11 max-md:px-0" onClick={() => runCut(SHARED, req)}><RefreshCw /><span className="max-md:hidden">{s.bar.calc}</span></Button>}
        </div>
      </div>
    </header>
  );
}
