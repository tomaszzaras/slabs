import { create } from 'zustand';
import { ROOMS, type CutRequest, type CutResult, type RoomId } from '@slabs/core';
import { hashRequest } from '../cut/request';
import { newProject, sanitizeProject, type AllowanceMm, type Project, type ProjectSettings } from './project';
import { decodeShare, encodeShare, loadStored, saveStored } from './storage';

export type Tab = RoomId | 'rozkroj';
export type Theme = 'auto' | 'light' | 'dark';
export interface CutEntry { key: string; result: CutResult }

interface AppState {
  loaded: boolean;
  project: Project;
  tab: Tab;
  theme: Theme;
  status: string;
  cuts: Record<string, CutEntry>;
  running: Record<string, boolean>;
  init: () => Promise<void>;
  setTab: (t: Tab) => void;
  setStatus: (s: string) => void;
  setTheme: (t: Theme) => void;
  setName: (n: string) => void;
  setParam: (room: RoomId, key: string, value: number) => void;
  resetRoom: (room: RoomId) => void;
  setRoomOn: (room: RoomId, on: boolean) => void;
  setSettings: (patch: Partial<Omit<ProjectSettings, 'allowances'>>) => void;
  setAllowances: (patch: Partial<AllowanceMm>) => void;
  replaceSettings: (s: ProjectSettings) => void;
  setShared: (patch: Partial<Project['shared']>) => void;
  setBand: (patch: Partial<Project['shared']['band']>) => void;
  loadProject: (p: Project) => void;
  newProject: () => void;
  shareLink: () => string;
  runCut: (slot: string, req: CutRequest) => void;
  cancelCut: (slot: string) => void;
}

const workers: Record<string, Worker> = {};
let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** A project opened from a link is not written over the stored one until the user changes it. */
let skipSaveFor: Project | null = null;

export const useStore = create<AppState>((set, get) => {
  const edit = (fn: (p: Project) => Project) => set((s) => ({ project: { ...fn(s.project), updatedAt: Date.now() } }));
  return {
    loaded: false,
    project: newProject(),
    tab: 'salon',
    theme: ((): Theme => { try { const v = localStorage.getItem('slabs-theme'); return v === 'light' || v === 'dark' ? v : 'auto'; } catch { return 'auto'; } })(),
    status: '',
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
      set({ project: stored ?? newProject(), loaded: true });
    },
    setTab: (tab) => set({ tab }),
    setStatus: (status) => set({ status }),
    setTheme: (theme) => { try { localStorage.setItem('slabs-theme', theme); } catch { /* ignore */ } set({ theme }); },
    setName: (name) => edit((p) => ({ ...p, name })),
    setParam: (room, key, value) => edit((p) => ({ ...p, rooms: { ...p.rooms, [room]: { ...p.rooms[room], params: { ...p.rooms[room].params, [key]: value } } } })),
    resetRoom: (room) => edit((p) => ({ ...p, rooms: { ...p.rooms, [room]: { ...p.rooms[room], params: { ...ROOMS[room].defaults } } } })),
    setRoomOn: (room, on) => edit((p) => ({ ...p, rooms: { ...p.rooms, [room]: { ...p.rooms[room], on } } })),
    setSettings: (patch) => edit((p) => ({ ...p, settings: { ...p.settings, ...patch } })),
    setAllowances: (patch) => edit((p) => ({ ...p, settings: { ...p.settings, allowances: { ...p.settings.allowances, ...patch } } })),
    replaceSettings: (settings) => edit((p) => ({ ...p, settings: structuredClone(settings) })),
    setShared: (patch) => edit((p) => ({ ...p, shared: { ...p.shared, ...patch } })),
    setBand: (patch) => edit((p) => ({ ...p, shared: { ...p.shared, band: { ...p.shared.band, ...patch } } })),
    loadProject: (project) => set({ project: sanitizeProject(project) ?? project, cuts: {} }),
    newProject: () => set({ project: newProject(), cuts: {} }),
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
  saveTimer = setTimeout(() => { void saveStored(useStore.getState().project); }, 400);
});
