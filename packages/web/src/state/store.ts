import { create } from 'zustand';
import { toast as sonner } from 'sonner';
import CutWorker from '../cut/cut.worker?worker&inline'; // inline (blob) worker: works from one HTML file as well
import { ROOMS, ROOM_IDS, type CutRequest, type CutResult, type Opening, type RoofSplits, type RoomId } from '@slabs/core';
import { lang as lang0, s as s_, setLang as setLang0, type Lang } from '../i18n';
import { hashRequest } from '../cut/request';
import { DEFAULT_BAND, exampleProject, newProject, sanitizeProject, type AllowanceMm, type BandItem, type Project, type ProjectSettings } from './project';
import { buildRequest } from '../cut/request';
import { decodeShare, deleteStored, encodeShare, listProjects, loadConflict, loadStored, metaStore, requestPersistence, saveStored, stashConflict, type ProjectInfo } from './storage';
import { cloudDisabled, createApi } from './cloudApi';
import { openProject } from './open';
import { Syncer, type SyncStatus } from './sync';
import { setNames } from '../i18n';
import type { FeatureKey } from './names';

/** The pages of a project: the overview (home), a room, or a band. */
export type Tab = 'przeglad' | RoomId | `band-${string}`;
export const OVERVIEW: Tab = 'przeglad';
export const bandTab = (id: string): Tab => `band-${id}`;
export const tabBandId = (t: Tab): string | null => (t.startsWith('band-') ? t.slice(5) : null);
export const isRoomTab = (t: Tab): t is RoomId => t !== OVERVIEW && !t.startsWith('band-');
export type Theme = 'auto' | 'light' | 'dark';
export interface CutEntry { key: string; result: CutResult }
/** A short message with an optional undo button ("Przywrócono wymiary domyślne"). */
export interface Toast { id: number; text: string; undo: boolean }

/** One band for now; the data and the navigation already take a list. */
export const MAX_BANDS = 1;
const HISTORY_LIMIT = 200;
/** Edits of the same field within this time are one undo step (typing a number is not 4 steps). */
const COALESCE_MS = 1200;

interface AppState {
  loaded: boolean;
  project: Project;
  tab: Tab;
  theme: Theme;
  lang: Lang;
  status: string;
  /** state of saving to the server */
  sync: SyncStatus;
  /** the online copy of the open project (its link is ?p=<cloudId>) */
  cloudId: string | null;
  /** undo history of the project (newest last) and the steps that were undone */
  past: Project[];
  future: Project[];
  /** counts undo/redo/replace operations: text fields drop what they were showing */
  rev: number;
  toast: Toast | null;
  /** projects kept in this browser */
  projects: ProjectInfo[];
  /** selected surface (R number) per room */
  selected: Partial<Record<RoomId, number>>;
  /** fields the user emptied ("room.key"): their dimension is drawn dashed with a question mark */
  empty: string[];
  cuts: Record<string, CutEntry>;
  running: Record<string, boolean>;
  init: () => Promise<void>;
  setTab: (t: Tab) => void;
  setStatus: (s: string) => void;
  setTheme: (t: Theme) => void;
  setLang: (l: Lang) => void;
  setName: (n: string) => void;
  setParam: (room: RoomId, key: string, value: number) => void;
  setParams: (room: RoomId, patch: Record<string, number>) => void;
  resetRoom: (room: RoomId) => void;
  resetAll: () => void;
  undo: () => void;
  redo: () => void;
  showToast: (text: string, undo?: boolean) => void;
  dismissToast: () => void;
  setRoomOn: (room: RoomId, on: boolean) => void;
  setSettings: (patch: Partial<Omit<ProjectSettings, 'allowances' | 'plate'>>) => void;
  setPlate: (patch: Partial<ProjectSettings['plate']>) => void;
  setAllowances: (patch: Partial<AllowanceMm>) => void;
  replaceSettings: (s: ProjectSettings) => void;
  setBand: (id: string, patch: Partial<Omit<BandItem, 'id' | 'name'>>) => void;
  renameBand: (id: string, name: string) => void;
  /** adds a band (one per project for now) and opens it; returns its id */
  addBand: () => string | null;
  removeBand: (id: string) => void;
  loadProject: (p: Project) => void;
  newProject: () => void;
  switchProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  select: (room: RoomId, key: number) => void;
  /** the opening selected on the drawing */
  selOpening: string | null;
  selectOpening: (id: string | null) => void;
  addOpening: (room: RoomId, o: Opening) => void;
  /** moves or reshapes an opening; quick successive edits of one opening are one undo step */
  setOpening: (room: RoomId, id: string, pts: Array<[number, number]>) => void;
  setOpeningKind: (room: RoomId, id: string, kind: Opening['kind']) => void;
  removeOpening: (room: RoomId, id: string) => void;
  setEmpty: (id: string, empty: boolean) => void;
  /** where the roof sheet of a room is split; quick successive edits with the same `key` are one undo step */
  setSplits: (room: RoomId, splits: RoofSplits, key?: string) => void;
  /** the one-time note about start offsets dropped by the move to the roof sheet */
  dismissMigration: () => void;
  /** names (empty text = back to the generic name) */
  renameRoom: (room: RoomId, name: string) => void;
  renameSurface: (room: RoomId, surface: number, name: string) => void;
  renameFeature: (room: RoomId, feature: FeatureKey, name: string) => void;
  renameOpening: (room: RoomId, id: string, name: string) => void;
  openExample: () => void;
  shareLink: () => string;
  cloudLink: () => string | null;
  retrySync: () => void;
  runCut: (slot: string, req: CutRequest) => void;
  cancelCut: (slot: string) => void;
}

/** Sets a key of a record, or removes it when the text is empty. */
function setOrDrop<T extends Record<string, string | undefined>>(rec: T, key: string, name: string): T {
  const out = { ...rec } as Record<string, string | undefined>;
  const v = name.trim().slice(0, 60);
  if (v) out[key] = v; else delete out[key];
  return out as T;
}

const workers: Record<string, Worker> = {};
let lastEdit = { key: '', at: 0 };
let toastId = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** A project opened from a link is not written over the stored one until the user changes it. */
let skipSaveFor: Project | null = null;
const api = createApi();
const newLocalId = () => newProject().id;

/** Wires the project to the server: see state/sync.ts. */
export const syncer = new Syncer({
  api,
  meta: metaStore,
  onStatus: (sync) => useStore.setState({ sync }),
  onId: (cloudId) => {
    useStore.setState({ cloudId });
    try {
      const u = new URL(location.href);
      if (cloudId) u.searchParams.set('p', cloudId); else u.searchParams.delete('p');
      u.hash = '';
      history.replaceState(null, '', u);
    } catch { /* ignore */ }
    void listProjects().then((projects) => useStore.setState({ projects }));
  },
  onConflict: (server, local) => {
    const cur = useStore.getState().project;
    const srv = { ...server, id: cur.id };
    skipSaveFor = srv;
    void stashConflict(cur.id, local);
    void saveStored(srv);
    useStore.setState((st) => ({ project: srv, past: [], future: [], cuts: {}, rev: st.rev + 1 }));
    offerLocalCopy(local);
  },
});
/** The toast of a conflict: the newer server copy is open, the copy from this device is one click away (and stays stored until then). */
function offerLocalCopy(local: Project) {
  sonner(s_.cloud.conflict, {
    duration: Infinity,
    action: { label: s_.cloud.restoreLocal, onClick: () => { useStore.getState().loadProject(local); void stashConflict('', null); } },
    onDismiss: () => { void stashConflict('', null); },
  });
}

export const useStore = create<AppState>((set, get) => {
  /** Every project change goes through here, so every change can be undone. `key` merges quick edits of one field. */
  const edit = (fn: (p: Project) => Project, key?: string) => set((s) => {
    const now = Date.now();
    const merge = !!key && key === lastEdit.key && now - lastEdit.at < COALESCE_MS && s.past.length > 0;
    lastEdit = { key: key ?? '', at: now };
    const past = merge ? s.past : [...s.past, s.project].slice(-HISTORY_LIMIT);
    return { project: { ...fn(s.project), updatedAt: now }, past, future: [] };
  });
  const toast = (text: string, undo = false) => {
    clearTimeout(toastTimer);
    set({ toast: { id: ++toastId, text, undo } });
    toastTimer = setTimeout(() => set({ toast: null }), 8000);
    sonner.dismiss();
    sonner(text, { duration: 8000, action: undo ? { label: s_.history.toastUndo, onClick: () => useStore.getState().undo() } : undefined });
  };
  return {
    loaded: false,
    project: newProject(s_.app.defaultProjectName),
    tab: OVERVIEW,
    theme: ((): Theme => { try { const v = localStorage.getItem('slabs-theme'); return v === 'light' || v === 'dark' ? v : 'auto'; } catch { return 'auto'; } })(),
    lang: lang0,
    status: '',
    sync: cloudDisabled() ? 'local' : 'saved',
    cloudId: null,
    past: [],
    future: [],
    rev: 0,
    toast: null,
    projects: [],
    selected: {},
    empty: [],
    cuts: {},
    running: {},
    async init() {
      requestPersistence();
      const fromLink = decodeShare(location.hash);
      if (cloudDisabled()) { // single-file build, file://: browser-only saving
        const projects = await listProjects();
        const p = fromLink ? { ...fromLink, id: newLocalId() } : (await loadStored()) ?? newProject(s_.app.defaultProjectName);
        skipSaveFor = p;
        if (fromLink) history.replaceState(null, '', location.pathname + location.search);
        set({ project: p, loaded: true, projects, sync: 'local', status: fromLink ? 'link' : '' });
        return;
      }
      if (fromLink) {
        // a #p= link is an import of a copy: its own project (new id), saved online on the first edit
        const copy = { ...fromLink, id: newLocalId() };
        history.replaceState(null, '', location.pathname + location.search.replace(/[?&]p=[^&]*/, ''));
        skipSaveFor = copy;
        syncer.bind(copy.id);
        syncer.detach(copy);
        set({ project: copy, loaded: true, status: 'link', projects: await listProjects(), sync: syncer.status });
        return;
      }
      const projects = await listProjects();
      const newest = await loadStored();
      const r = await openProject(syncer, api, {
        linkId: cloudDisabled() ? null : new URLSearchParams(location.search).get('p'),
        newest,
        byCloudId: async (cloudId) => { const e = projects.find((x) => x.cloudId === cloudId); return e ? loadStored(e.id) : null; },
        taken: new Set(projects.map((x) => x.id)),
        fresh: () => newProject(s_.app.defaultProjectName),
        freshId: newLocalId,
      });
      skipSaveFor = r.project;
      void saveStored(r.project);
      set({ project: r.project, loaded: true, projects: await listProjects(), sync: syncer.status, cloudId: syncer.id });
      if (r.notice === 'notfound') sonner(s_.cloud.notFound, { duration: 12000 });
      else if (r.notice === 'loadfailed') sonner(s_.cloud.loadFailed, { duration: Infinity, action: { label: s_.cloud.reload, onClick: () => location.reload() } });
      const stash = await loadConflict();
      if (stash && stash.localId === r.project.id) offerLocalCopy(stash.project);
    },
    setTab: (tab) => set({ tab }),
    setStatus: (status) => set({ status }),
    setLang: (l) => { setLang0(l); set({ lang: l }); },
    setTheme: (theme) => { try { localStorage.setItem('slabs-theme', theme); } catch { /* ignore */ } set({ theme }); },
    setName: (name) => edit((p) => ({ ...p, name }), 'name'),
    setParam: (room, key, value) => get().project.rooms[room].params[key] === value ? undefined : edit((p) => ({ ...p, rooms: { ...p.rooms, [room]: { ...p.rooms[room], params: { ...p.rooms[room].params, [key]: value } } } }), `${room}.${key}`),
    setParams: (room, patch) => edit((p) => ({ ...p, rooms: { ...p.rooms, [room]: { ...p.rooms[room], params: { ...p.rooms[room].params, ...patch } } } })),
    resetRoom: (room) => {
      set((st) => ({ empty: st.empty.filter((x) => !x.startsWith(room + '.')) }));
      edit((p) => ({ ...p, rooms: { ...p.rooms, [room]: { ...p.rooms[room], params: { ...ROOMS[room].defaults } } } }));
      toast(s_.history.resetDone, true);
    },
    resetAll: () => {
      set({ empty: [] });
      edit((p) => {
        const rooms = { ...p.rooms };
        for (const id of ROOM_IDS) rooms[id] = { ...rooms[id], params: { ...ROOMS[id].defaults } };
        return { ...p, rooms };
      });
      toast(s_.history.resetDone, true);
    },
    undo: () => {
      const { past, project, future } = get();
      if (!past.length) return;
      lastEdit = { key: '', at: 0 };
      sonner.dismiss();
      set((st) => ({ project: past[past.length - 1]!, past: past.slice(0, -1), future: [project, ...future], rev: st.rev + 1, toast: null, empty: [] }));
    },
    redo: () => {
      const { past, project, future } = get();
      if (!future.length) return;
      lastEdit = { key: '', at: 0 };
      set((st) => ({ project: future[0]!, past: [...past, project], future: future.slice(1), rev: st.rev + 1, toast: null, empty: [] }));
    },
    showToast: (text, undo = false) => toast(text, undo),
    dismissToast: () => { clearTimeout(toastTimer); sonner.dismiss(); set({ toast: null }); },
    setRoomOn: (room, on) => edit((p) => ({ ...p, rooms: { ...p.rooms, [room]: { ...p.rooms[room], on } } })),
    setSettings: (patch) => edit((p) => ({ ...p, settings: { ...p.settings, ...patch } }), 'settings.' + Object.keys(patch).join()),
    setPlate: (patch) => edit((p) => ({ ...p, settings: { ...p.settings, plate: { ...p.settings.plate, ...patch } } }), 'plate.' + Object.keys(patch).join()),
    setAllowances: (patch) => edit((p) => ({ ...p, settings: { ...p.settings, allowances: { ...p.settings.allowances, ...patch } } }), 'allow.' + Object.keys(patch).join()),
    replaceSettings: (settings) => edit((p) => ({ ...p, settings: structuredClone(settings) })),
    setBand: (id, patch) => edit((p) => ({ ...p, bands: p.bands.map((b) => (b.id === id ? { ...b, ...patch } : b)) }), `band.${id}.` + Object.keys(patch).join()),
    renameBand: (id, name) => edit((p) => ({ ...p, bands: p.bands.map((b) => { if (b.id !== id) return b; const { name: _old, ...rest } = b; const v = name.trim().slice(0, 60); return v ? { ...rest, name: v } : rest; }) })),
    addBand: () => {
      if (get().project.bands.length >= MAX_BANDS) return null;
      const id = 'b' + Math.random().toString(36).slice(2, 7);
      edit((p) => ({ ...p, bands: [...p.bands, { id, ...DEFAULT_BAND }] }));
      set({ tab: bandTab(id) });
      return id;
    },
    removeBand: (id) => {
      edit((p) => ({ ...p, bands: p.bands.filter((b) => b.id !== id) }));
      set({ tab: OVERVIEW });
      toast(s_.band.removed, true);
    },
    // an imported file / restored copy replaces the content of the open project (same local id, same online copy)
    loadProject: (project) => { edit((cur) => ({ ...(sanitizeProject(project) ?? project), id: cur.id })); set({ cuts: {} }); },
    newProject: () => {
      const p = newProject(s_.app.newProjectName);
      skipSaveFor = p;
      syncer.bind(p.id);
      syncer.detach(); // gets its own online copy on the first edit
      void saveStored(p).then(async () => set({ projects: await listProjects() }));
      set({ project: p, past: [], future: [], cuts: {}, selected: {}, tab: OVERVIEW, empty: [], rev: get().rev + 1 });
    },
    switchProject: async (id) => {
      if (id === get().project.id) return;
      await saveStored(get().project);
      const p = await loadStored(id);
      if (p) skipSaveFor = p;
      if (p) { syncer.bind(p.id); if (!syncer.id) { syncer.detach(p); void syncer.flush(p); } else if (syncer.dirty) void syncer.flush(p); }
      if (p) set({ sync: syncer.status, cloudId: syncer.id, project: p, past: [], future: [], cuts: {}, selected: {}, tab: OVERVIEW, empty: [], rev: get().rev + 1, projects: await listProjects() });
    },
    deleteProject: async (id) => {
      await deleteStored(id);
      const list = await listProjects();
      if (id === get().project.id) {
        const next = list[0] ? await loadStored(list[0].id) : null;
        const shown = next ?? newProject(s_.app.defaultProjectName);
        skipSaveFor = shown;
        syncer.bind(shown.id);
        if (!syncer.id) syncer.detach(shown);
        set({ project: shown, past: [], future: [], cuts: {}, selected: {}, tab: OVERVIEW, empty: [], rev: get().rev + 1 });
      }
      set({ projects: await listProjects() });
    },
    renameRoom: (room, name) => edit((p) => ({ ...p, names: { ...p.names, rooms: setOrDrop(p.names.rooms, room, name) } })),
    renameSurface: (room, surface, name) => edit((p) => ({ ...p, names: { ...p.names, surfaces: { ...p.names.surfaces, [room]: setOrDrop(p.names.surfaces[room] ?? {}, String(surface), name) } } })),
    renameFeature: (room, feature, name) => edit((p) => ({ ...p, names: { ...p.names, features: { ...p.names.features, [room]: setOrDrop(p.names.features[room] ?? {}, feature, name) } } })),
    renameOpening: (room, id, name) => edit((p) => ({ ...p, openings: { ...p.openings, [room]: p.openings[room].map((o) => { if (o.id !== id) return o; const { name: _old, ...rest } = o; return name.trim() ? { ...rest, name: name.trim().slice(0, 60) } : rest; }) } })),
    openExample: () => {
      const p = exampleProject(s_.names.example);
      skipSaveFor = p;
      syncer.bind(p.id);
      syncer.detach();
      void saveStored(p).then(async () => set({ projects: await listProjects() }));
      set({ project: p, past: [], future: [], cuts: {}, selected: {}, tab: OVERVIEW, empty: [], rev: get().rev + 1 });
    },
    setSplits: (room, splits, key) => edit((p) => ({ ...p, splits: { ...p.splits, [room]: splits } }), key ? `splits.${room}.${key}` : undefined),
    dismissMigration: () => edit((p) => { const { migration: _m, ...rest } = p; return rest; }),
    setEmpty: (id, empty) => set((st) => (st.empty.includes(id) === empty ? st : { empty: empty ? [...st.empty, id] : st.empty.filter((x) => x !== id) })),
    select: (room, key) => set((st) => ({ selected: { ...st.selected, [room]: key }, selOpening: null })),
    selOpening: null,
    selectOpening: (id) => set({ selOpening: id }),
    addOpening: (room, o) => { edit((p) => ({ ...p, openings: { ...p.openings, [room]: [...p.openings[room], o].slice(0, 6) } })); set({ selOpening: o.id }); },
    setOpening: (room, id, pts) => edit((p) => ({ ...p, openings: { ...p.openings, [room]: p.openings[room].map((o) => (o.id === id ? { ...o, pts } : o)) } }), `open.${room}.${id}`),
    setOpeningKind: (room, id, kind) => edit((p) => ({ ...p, openings: { ...p.openings, [room]: p.openings[room].map((o) => (o.id === id ? { ...o, kind } : o)) } })),
    removeOpening: (room, id) => { edit((p) => ({ ...p, openings: { ...p.openings, [room]: p.openings[room].filter((o) => o.id !== id) } })); set({ selOpening: null }); toast(s_.openings.removed, true); },
    cloudLink: () => { const id = syncer.id; return id ? `${location.origin}${location.pathname}?p=${id}` : null; },
    retrySync: () => { void syncer.retryNow(); },
    shareLink: () => `${location.origin}${location.pathname}#p=${encodeShare(get().project)}`,
    runCut(slot, req) {
      get().cancelCut(slot);
      const key = hashRequest(req);
      const w = new CutWorker();
      workers[slot] = w;
      set((s) => ({ running: { ...s.running, [slot]: true } }));
      const done = () => { w.terminate(); delete workers[slot]; set((s) => ({ running: { ...s.running, [slot]: false } })); };
      w.onmessage = (e: MessageEvent<{ id: number; result?: CutResult; error?: string }>) => {
        if (e.data.result) set((s) => ({ cuts: { ...s.cuts, [slot]: { key, result: e.data.result! } }, status: '' }));
        else set({ status: 'error:' + (e.data.error ?? '') });
        done();
      };
      w.onerror = (e) => { set({ status: 'error:' + e.message }); done(); };
      w.postMessage({ id: 1, req });
    },
    cancelCut(slot) {
      const w = workers[slot];
      if (!w) return;
      w.terminate();
      delete workers[slot];
      set((s) => ({ running: { ...s.running, [slot]: false } }));
    },
  };
});

// names of rooms and surfaces are read by the text helpers in i18n while rendering: keep them in step with the open project
setNames(useStore.getState().project.names);
useStore.subscribe((st, prev) => { if (st.project.names !== prev.project.names) setNames(st.project.names); });

if (cloudDisabled()) syncer.disable(); // no server to talk to: browser-only saving

// autosave: the browser copy after 400 ms, the online copy after 800 ms (inside the syncer)
useStore.subscribe((s, prev) => {
  if (!s.loaded || s.project === prev.project || s.project === skipSaveFor) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void saveStored(useStore.getState().project).then(async () => useStore.setState({ projects: await listProjects() })); }, 400);
  syncer.change(s.project);
});

// last chance to save (tab hidden or closed, phone locked), and retry when the network is back
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const hide = () => {
    clearTimeout(saveTimer);
    const st = useStore.getState();
    if (st.loaded && st.project !== skipSaveFor) void saveStored(st.project);
    syncer.flushOnHide();
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hide(); });
  window.addEventListener('pagehide', hide);
  window.addEventListener('online', () => { void syncer.retryNow(); });
}

// the project's total is always up to date: the shared cut recalculates a moment after the last change (in the worker)
let autoTimer: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe((s, prev) => {
  if (!s.loaded || s.project === prev.project || typeof Worker === 'undefined') return;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    const st = useStore.getState();
    const req = buildRequest(st.project);
    if (st.cuts['rozkroj']?.key !== hashRequest(req)) st.runCut('rozkroj', req);
    // with tongue and groove the same project is also cut with plain plates, to show what the profile costs in plates
    if (st.project.settings.plate.profile !== 'none') {
      const plain = buildRequest(st.project, undefined, true);
      if (st.cuts['rozkroj:plain']?.key !== hashRequest(plain)) st.runCut('rozkroj:plain', plain);
    }
  }, 700);
});

/** The page that is shown: the chosen one, or the overview when a band page is gone (removed, undone, another project). */
export function useTab(): Tab {
  const tab = useStore((st) => st.tab);
  const bands = useStore((st) => st.project.bands);
  const id = tabBandId(tab);
  return id && !bands.some((b) => b.id === id) ? OVERVIEW : tab;
}
