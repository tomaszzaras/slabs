import { create } from 'zustand';
import { ROOMS, ROOM_IDS, type CutRequest, type CutResult, type RoomId } from '@slabs/core';
import { lang as lang0, s as s_, setLang as setLang0, type Lang } from '../i18n';
import { hashRequest } from '../cut/request';
import { newProject, sanitizeProject, type AllowanceMm, type Project, type ProjectSettings } from './project';
import { buildRequest } from '../cut/request';
import { decodeShare, deleteStored, encodeShare, listProjects, loadStored, saveStored, type ProjectInfo } from './storage';

export type Tab = RoomId | 'rozkroj';
export type Theme = 'auto' | 'light' | 'dark';
export interface CutEntry { key: string; result: CutResult }
/** A short message with an optional undo button ("Przywrócono wymiary domyślne"). */
export interface Toast { id: number; text: string; undo: boolean }

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
  setSettings: (patch: Partial<Omit<ProjectSettings, 'allowances'>>) => void;
  setAllowances: (patch: Partial<AllowanceMm>) => void;
  replaceSettings: (s: ProjectSettings) => void;
  setShared: (patch: Partial<Project['shared']>) => void;
  setBand: (patch: Partial<Project['shared']['band']>) => void;
  loadProject: (p: Project) => void;
  newProject: () => void;
  switchProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  select: (room: RoomId, key: number) => void;
  setEmpty: (id: string, empty: boolean) => void;
  shareLink: () => string;
  runCut: (slot: string, req: CutRequest) => void;
  cancelCut: (slot: string) => void;
}

const workers: Record<string, Worker> = {};
let lastEdit = { key: '', at: 0 };
let toastId = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** A project opened from a link is not written over the stored one until the user changes it. */
let skipSaveFor: Project | null = null;

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
  };
  return {
    loaded: false,
    project: newProject(),
    tab: 'salon',
    theme: ((): Theme => { try { const v = localStorage.getItem('slabs-theme'); return v === 'light' || v === 'dark' ? v : 'auto'; } catch { return 'auto'; } })(),
    lang: lang0,
    status: '',
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
      const fromLink = decodeShare(location.hash);
      if (fromLink) {
        history.replaceState(null, '', location.pathname + location.search);
        skipSaveFor = fromLink;
        set({ project: fromLink, loaded: true, status: 'link' });
        return;
      }
      const stored = await loadStored();
      set({ project: stored ?? newProject(), loaded: true, projects: await listProjects() });
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
      set((st) => ({ project: past[past.length - 1]!, past: past.slice(0, -1), future: [project, ...future], rev: st.rev + 1, toast: null, empty: [] }));
    },
    redo: () => {
      const { past, project, future } = get();
      if (!future.length) return;
      lastEdit = { key: '', at: 0 };
      set((st) => ({ project: future[0]!, past: [...past, project], future: future.slice(1), rev: st.rev + 1, toast: null, empty: [] }));
    },
    showToast: (text, undo = false) => toast(text, undo),
    dismissToast: () => { clearTimeout(toastTimer); set({ toast: null }); },
    setRoomOn: (room, on) => edit((p) => ({ ...p, rooms: { ...p.rooms, [room]: { ...p.rooms[room], on } } })),
    setSettings: (patch) => edit((p) => ({ ...p, settings: { ...p.settings, ...patch } }), 'settings.' + Object.keys(patch).join()),
    setAllowances: (patch) => edit((p) => ({ ...p, settings: { ...p.settings, allowances: { ...p.settings.allowances, ...patch } } }), 'allow.' + Object.keys(patch).join()),
    replaceSettings: (settings) => edit((p) => ({ ...p, settings: structuredClone(settings) })),
    setShared: (patch) => edit((p) => ({ ...p, shared: { ...p.shared, ...patch } }), 'shared.' + Object.keys(patch).join()),
    setBand: (patch) => edit((p) => ({ ...p, shared: { ...p.shared, band: { ...p.shared.band, ...patch } } }), 'band.' + Object.keys(patch).join()),
    loadProject: (project) => { edit(() => sanitizeProject(project) ?? project); set({ cuts: {} }); },
    newProject: () => {
      const p = newProject(s_.app.newProjectName);
      void saveStored(p).then(async () => set({ projects: await listProjects() }));
      set({ project: p, past: [], future: [], cuts: {}, selected: {}, empty: [], rev: get().rev + 1 });
    },
    switchProject: async (id) => {
      if (id === get().project.id) return;
      await saveStored(get().project);
      const p = await loadStored(id);
      if (p) set({ project: p, past: [], future: [], cuts: {}, selected: {}, empty: [], rev: get().rev + 1, projects: await listProjects() });
    },
    deleteProject: async (id) => {
      await deleteStored(id);
      const list = await listProjects();
      if (id === get().project.id) {
        const next = list[0] ? await loadStored(list[0].id) : null;
        set({ project: next ?? newProject(), past: [], future: [], cuts: {}, selected: {}, empty: [], rev: get().rev + 1 });
      }
      set({ projects: await listProjects() });
    },
    setEmpty: (id, empty) => set((st) => (st.empty.includes(id) === empty ? st : { empty: empty ? [...st.empty, id] : st.empty.filter((x) => x !== id) })),
    select: (room, key) => set((st) => ({ selected: { ...st.selected, [room]: key } })),
    shareLink: () => `${location.origin}${location.pathname}#p=${encodeShare(get().project)}`,
    runCut(slot, req) {
      get().cancelCut(slot);
      const key = hashRequest(req);
      const w = new Worker(new URL('../cut/cut.worker.ts', import.meta.url), { type: 'module' });
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

// autosave (debounced)
useStore.subscribe((s, prev) => {
  if (!s.loaded || s.project === prev.project || s.project === skipSaveFor) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void saveStored(useStore.getState().project).then(async () => useStore.setState({ projects: await listProjects() })); }, 400);
});

// the project's total is always up to date: the shared cut recalculates a moment after the last change (in the worker)
let autoTimer: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe((s, prev) => {
  if (!s.loaded || s.project === prev.project || typeof Worker === 'undefined') return;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    const st = useStore.getState();
    const req = buildRequest(st.project);
    if (st.cuts['rozkroj']?.key === hashRequest(req)) return;
    st.runCut('rozkroj', req);
  }, 700);
});
