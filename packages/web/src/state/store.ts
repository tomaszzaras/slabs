import { create } from 'zustand';
import { toast as sonner } from 'sonner';
import CutWorker from '../cut/cut.worker?worker&inline'; // inline (blob) worker: works from one HTML file as well
import { ROOF_KEYS, templateById, type AddTemplateId, type CutRequest, type CutResult, type Dir, type Finish, type Opening, type RoofKey, type RoofSpec, type RoofSplits, type RoomSpec } from '@slabs/core';
import { lang as lang0, roomName, s as s_, setLang as setLang0, type Lang } from '../i18n';
import { hashRequest } from '../cut/request';
import { DEFAULT_BAND, MAX_ROOMS, ROOF_LIMITS, blankProject, exampleProject, newRoomId, sanitizeProject, startSpecs, type AllowanceMm, type BandItem, type Project, type ProjectSettings, type RoomRef } from './project';
import { buildRequest } from '../cut/request';
import { decodeShare, deleteStored, encodeShare, listProjects, loadConflict, loadStored, metaStore, requestPersistence, saveStored, setStorageScope, stashConflict, type ProjectInfo } from './storage';
import { cloudDisabled, createApi, type CloudProjectInfo, type LinkOp, type Sharing } from './cloudApi';
import { openProject } from './open';
import { CLOUD_PREFIX, addToAccount, findClaimItems, markOffered, mergeProjects, type ClaimItem } from './account';
import { authEnabled } from '../auth';
import { currentUserId } from '../auth/token';
import { Syncer, type SyncStatus } from './sync';
import { setNames } from '../i18n';
import type { FeatureKey } from './names';
import { allWallsWood, applyParam, setSurf, type WoodMode } from './specEdit';

/** The pages of a project: the overview (home), a room, or a band. */
export type Tab = string;
export const OVERVIEW: Tab = 'przeglad';
export const bandTab = (id: string): Tab => `band-${id}`;
export const tabBandId = (t: Tab): string | null => (t.startsWith('band-') ? t.slice(5) : null);
export const isRoomTab = (t: Tab): boolean => t !== OVERVIEW && !t.startsWith('band-');
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
  /** owner = the user's own project; edit / view = somebody else's project opened by a share link (view: read-only) */
  access: 'owner' | 'edit' | 'view';
  /** projects that can be added to the account ("Dodaj do konta"), and whether that dialog is open */
  claimItems: ClaimItem[];
  claimOpen: boolean;
  /** old browser projects that were not added (the menu offers them again) */
  claimLeft: number;
  closeClaim: (add: string[] | null) => Promise<void>;
  openClaim: () => Promise<void>;
  /** the sharing dialog (owner only) and the links it shows */
  shareOpen: boolean;
  sharing: Sharing | null;
  sharingError: boolean;
  openShare: () => Promise<void>;
  /** somebody else's project (opened by a link): keep a copy of it in the user's own account */
  copyToAccount: () => Promise<void>;
  closeShare: () => void;
  changeSharing: (ops: { view?: LinkOp; edit?: LinkOp }) => Promise<void>;
  /** undo history of the project (newest last) and the steps that were undone */
  past: Project[];
  future: Project[];
  /** counts undo/redo/replace operations: text fields drop what they were showing */
  rev: number;
  toast: Toast | null;
  /** the "Dodaj pomieszczenie" dialog is open */
  addOpen: boolean;
  setAddOpen: (o: boolean) => void;
  /** the room wizard ("Kreator") is open */
  wizardOpen: boolean;
  setWizardOpen: (o: boolean) => void;
  /** adds a room from a finished spec (the wizard) and opens it; null when the project is full */
  addRoomSpec: (spec: RoomSpec, name: string) => RoomRef | null;
  /** the floor plan of a room with a free outline */
  setOutline: (room: RoomRef, outline: Array<[number, number]>) => void;
  /** projects kept in this browser */
  projects: ProjectInfo[];
  /** selected surface (R number) per room */
  selected: Partial<Record<RoomRef, number>>;
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
  setParam: (room: RoomRef, key: string, value: number) => void;
  setParams: (room: RoomRef, patch: Record<string, number>) => void;
  /** changes a room's definition (footprint, position, ceiling ...); quick edits with the same `key` are one undo step */
  setSpec: (room: RoomRef, fn: (s: RoomSpec) => RoomSpec, key?: string) => void;
  /** direction / finish of one surface (the cladding); `undefined` takes the default */
  setSurface: (room: RoomRef, surface: number, patch: { dir?: Dir | undefined; finish?: Finish | undefined }) => void;
  /** every wall: wood up to a height from the floor, or the given height below the ceiling */
  setAllWalls: (room: RoomRef, h: number, mode: WoodMode) => void;
  resetRoom: (room: RoomRef) => void;
  resetAll: () => void;
  undo: () => void;
  redo: () => void;
  showToast: (text: string, undo?: boolean) => void;
  dismissToast: () => void;
  setRoomOn: (room: RoomRef, on: boolean) => void;
  /** adds a room from a template and opens it (its first measurement is focused); returns its id, or null when the project is full */
  addRoom: (template: AddTemplateId, name: string, side?: 'left' | 'right') => RoomRef | null;
  duplicateRoom: (room: RoomRef) => RoomRef | null;
  /** moves a room by `by` places in the list (−1 = to the left) */
  moveRoom: (room: RoomRef, by: number) => void;
  /** removes a room; the toast offers undo (the caller asks for confirmation when the room holds data) */
  removeRoom: (room: RoomRef) => void;
  /** house roof ("Dach domu"): the project default of the rooms under the roof */
  setRoof: (patch: Partial<RoofSpec>) => void;
  /** a room takes the project's value of a roof field again */
  resetRoomRoof: (room: RoomRef, key: RoofKey) => void;
  /** a room starts to have its own value of a roof field (first equal to the house roof's) */
  startRoofOverride: (room: RoomRef, key: RoofKey) => void;
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
  select: (room: RoomRef, key: number) => void;
  /** the opening selected on the drawing */
  selOpening: string | null;
  selectOpening: (id: string | null) => void;
  addOpening: (room: RoomRef, o: Opening) => void;
  /** moves or reshapes an opening; quick successive edits of one opening are one undo step */
  setOpening: (room: RoomRef, id: string, pts: Array<[number, number]>) => void;
  setOpeningKind: (room: RoomRef, id: string, kind: Opening['kind']) => void;
  removeOpening: (room: RoomRef, id: string) => void;
  setEmpty: (id: string, empty: boolean) => void;
  /** where the roof sheet of a room is split; quick successive edits with the same `key` are one undo step */
  setSplits: (room: RoomRef, splits: RoofSplits, key?: string) => void;
  /** the one-time note about start offsets dropped by the move to the roof sheet */
  dismissMigration: () => void;
  /** names (empty text = back to the generic name) */
  renameRoom: (room: RoomRef, name: string) => void;
  renameSurface: (room: RoomRef, surface: number, name: string) => void;
  renameFeature: (room: RoomRef, feature: FeatureKey, name: string) => void;
  renameOpening: (room: RoomRef, id: string, name: string) => void;
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

/** The room's start values again (its template's spec, or the house preset it is named after); no roof override left. */
function resetRoomIn(p: Project, room: RoomRef): Project {
  const r = p.rooms[room];
  if (!r) return p;
  const starts = startSpecs(r, room);
  const spec = starts.find((q) => q.pos === r.spec.pos && q.ceiling.kind === r.spec.ceiling.kind) ?? starts[0];
  if (!spec) return p;
  return { ...p, rooms: { ...p.rooms, [room]: { on: r.on, ...(r.tpl ? { tpl: r.tpl } : {}), spec: structuredClone(spec) } } };
}

const workers: Record<string, Worker> = {};
let lastEdit = { key: '', at: 0 };
let toastId = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** A project opened from a link is not written over the stored one until the user changes it. */
let skipSaveFor: Project | null = null;
const api = createApi();
const newLocalId = () => blankProject().id;
/** What the server said last about the user's projects (null = not known: offline, or no login). */
let serverList: CloudProjectInfo[] | null = null;
/** The project list: this browser's projects, with login also the ones only the server has. */
async function projectsList(): Promise<ProjectInfo[]> {
  const local = await listProjects();
  return authEnabled ? mergeProjects(local, serverList) : local;
}
async function refreshServerList(): Promise<void> {
  if (!authEnabled) return;
  const r = await api.list();
  if (r.kind === 'ok') serverList = r.value;
  useStore.setState({ projects: await projectsList() });
}
/** The user's own project, saved and synced; shared projects (opened by somebody's link) are only kept in memory. */
const OWN = { access: 'owner' as const, sharing: null, sharingError: false, shareOpen: false };
let readOnlyToastAt = 0

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
      if (cloudId && syncer.key) u.searchParams.set('k', syncer.key); else u.searchParams.delete('k');
      u.hash = '';
      history.replaceState(null, '', u);
    } catch { /* ignore */ }
    void projectsList().then((projects) => useStore.setState({ projects }));
    if (cloudId && authEnabled && !serverList?.some((x) => x.id === cloudId)) void refreshServerList();
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
    if (s.access === 'view') { // read-only (view link): nothing changes, and the user is told once in a while
      if (Date.now() - readOnlyToastAt > 4000) { readOnlyToastAt = Date.now(); sonner(s_.access.readOnlyToast); }
      return {};
    }
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
    project: blankProject(s_.app.defaultProjectName),
    tab: OVERVIEW,
    theme: ((): Theme => { try { const v = localStorage.getItem('slabs-theme'); return v === 'light' || v === 'dark' ? v : 'auto'; } catch { return 'auto'; } })(),
    lang: lang0,
    status: '',
    sync: cloudDisabled() ? 'local' : 'saved',
    cloudId: null,
    access: 'owner',
    claimItems: [],
    claimOpen: false,
    claimLeft: 0,
    shareOpen: false,
    sharing: null,
    sharingError: false,
    past: [],
    future: [],
    rev: 0,
    toast: null,
    addOpen: false,
    setAddOpen: (addOpen) => set({ addOpen }),
    wizardOpen: false,
    setWizardOpen: (wizardOpen) => set({ wizardOpen, ...(wizardOpen ? { addOpen: false } : {}) }),
    addRoomSpec: (spec, name) => {
      const p0 = get().project;
      if (p0.roomOrder.length >= MAX_ROOMS) return null;
      const id = newRoomId(p0);
      const used = new Set(p0.roomOrder.map((r) => roomName(r)));
      let n = 1;
      while (used.has(s_.names.room(n))) n++;
      const given = name.trim() || s_.names.room(n);
      edit((p) => ({ ...p, roomOrder: [...p.roomOrder, id], rooms: { ...p.rooms, [id]: { on: true, tpl: 'empty' as AddTemplateId, spec } }, openings: { ...p.openings, [id]: [] }, splits: { ...p.splits, [id]: {} }, names: { ...p.names, rooms: setOrDrop(p.names.rooms, id, given) } }));
      set({ tab: id });
      return id;
    },
    setOutline: (room, outline) => edit((p) => {
      const r = p.rooms[room];
      if (!r?.spec.outline) return p;
      const xs = outline.map((q) => q[0]), ys = outline.map((q) => q[1]);
      return { ...p, rooms: { ...p.rooms, [room]: { ...r, spec: { ...r.spec, outline, w: Math.max(...xs) - Math.min(...xs), l: Math.max(...ys) - Math.min(...ys) } } } };
    }, `${room}.outline`),
    projects: [],
    selected: {},
    empty: [],
    cuts: {},
    running: {},
    async init() {
      requestPersistence();
      const userId = authEnabled ? currentUserId() : null;
      setStorageScope(userId); // the browser copy belongs to the signed-in user (none without login)
      const fromLink = decodeShare(location.hash);
      if (cloudDisabled()) { // single-file build, file://: browser-only saving
        const projects = await listProjects();
        const p = fromLink ? { ...fromLink, id: newLocalId() } : (await loadStored()) ?? blankProject(s_.app.defaultProjectName);
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
        set({ project: copy, loaded: true, status: 'link', projects: await projectsList(), sync: syncer.status });
        return;
      }
      const projects = await listProjects();
      if (authEnabled) { const r = await api.list(); if (r.kind === 'ok') serverList = r.value; }
      const params = new URLSearchParams(location.search);
      let linkId = cloudDisabled() ? null : params.get('p');
      const linkKey = cloudDisabled() ? null : params.get('k');
      // newest project: this browser's most recent copy, or - on a new device - the account's most recent project from the server
      const newest = await loadStored();
      if (authEnabled && !linkId) {
        const merged = mergeProjects(projects, serverList);
        const top = merged[0];
        if (top && top.id.startsWith(CLOUD_PREFIX) && (!newest || top.updatedAt > newest.updatedAt)) linkId = top.cloudId ?? null;
      }
      const r = await openProject(syncer, api, {
        linkId,
        key: linkKey,
        newest,
        byCloudId: async (cloudId) => { const e = projects.find((x) => x.cloudId === cloudId); return e ? loadStored(e.id) : null; },
        taken: new Set(projects.map((x) => x.id)),
        fresh: () => blankProject(s_.app.defaultProjectName),
        freshId: newLocalId,
      });
      skipSaveFor = r.project;
      // a brand-new empty project is not stored (or listed, or uploaded) until the user changes something
      if (r.access === 'owner' && !(authEnabled && !newest && !syncer.id)) void saveStored(r.project);
      set({ project: r.project, loaded: true, projects: await projectsList(), sync: syncer.status, cloudId: syncer.id, access: r.access });
      if (r.notice === 'notfound') sonner(s_.cloud.notFound, { duration: 12000 });
      else if (r.notice === 'forbidden') sonner(s_.access.noAccess, { duration: 15000 });
      else if (r.notice === 'loadfailed') sonner(s_.cloud.loadFailed, { duration: Infinity, action: { label: s_.cloud.reload, onClick: () => location.reload() } });
      const stash = await loadConflict();
      if (stash && stash.localId === r.project.id) offerLocalCopy(stash.project);
      if (authEnabled && userId) {
        const items = await findClaimItems(userId, r.claim);
        if (items.length) set({ claimItems: items, claimOpen: true, claimLeft: items.filter((x) => x.source === 'browser').length });
      }
    },
    closeClaim: async (add) => {
      const userId = currentUserId();
      const items = get().claimItems;
      set({ claimOpen: false });
      if (!userId) return;
      markOffered(userId, items.filter((x) => x.localId).map((x) => x.localId!));
      if (!add || !add.length) { set({ claimItems: [], claimLeft: items.filter((x) => x.source === 'browser').length }); return; }
      const res = await addToAccount(api, items.filter((x) => add.includes(x.key)));
      set({ claimItems: items.filter((x) => res.failed.includes(x.key)), claimLeft: items.filter((x) => x.source === 'browser' && !res.added.includes(x.key)).length });
      await refreshServerList();
      if (res.added.length) sonner(s_.access.added(res.added.length));
      if (res.failed.length) sonner(s_.access.addFailed, { duration: 12000 });
      // the project the user came for: the opened link, else (when nothing was started yet) the newest one that was added
      const st = get();
      const linked = items.find((x) => x.source === 'link' && res.added.includes(x.key));
      const untouched = !syncer.id && st.past.length === 0 && st.access === 'owner';
      const pick = linked ?? (untouched ? [...items].filter((x) => res.added.includes(x.key)).sort((a, b) => b.updatedAt - a.updatedAt)[0] : undefined);
      const lid = pick ? res.local[pick.key] : undefined;
      if (lid) await get().switchProject(lid);
    },
    openClaim: async () => {
      const userId = currentUserId();
      if (!userId) return;
      const items = await findClaimItems(userId, undefined, true);
      set({ claimItems: items, claimOpen: true });
    },
    openShare: async () => {
      if (get().access !== 'owner') return;
      set({ shareOpen: true, sharing: null, sharingError: false });
      if (!syncer.id) await syncer.flush(get().project); // a project without an online copy gets one first
      const id = syncer.id;
      if (!id) { set({ sharingError: true }); return; }
      const r = await api.getSharing(id);
      if (r.kind === 'ok') set({ sharing: r.value }); else set({ sharingError: true });
    },
    closeShare: () => set({ shareOpen: false }),
    copyToAccount: async () => {
      const cur = get().project;
      const p = { ...structuredClone(cur), id: newLocalId(), name: s_.access.copyName(cur.name), updatedAt: Date.now() };
      skipSaveFor = p;
      syncer.bind(p.id);
      syncer.detach(p);
      await saveStored(p);
      set({ project: p, ...OWN, past: [], future: [], cuts: {}, selected: {}, tab: OVERVIEW, empty: [], rev: get().rev + 1 });
      void syncer.flush(p).then(() => { sonner(s_.access.copyMineDone); return refreshServerList(); });
    },
    changeSharing: async (ops) => {
      const id = syncer.id;
      if (!id) return;
      const r = await api.setSharing(id, ops);
      if (r.kind === 'ok') set({ sharing: r.value, sharingError: false }); else set({ sharingError: true });
    },
    setTab: (tab) => set({ tab }),
    setStatus: (status) => set({ status }),
    setLang: (l) => { setLang0(l); set({ lang: l }); },
    setTheme: (theme) => { try { localStorage.setItem('slabs-theme', theme); } catch { /* ignore */ } set({ theme }); },
    setName: (name) => { if (get().access === 'owner') edit((p) => ({ ...p, name }), 'name'); }, // renaming is the owner's
    setParam: (room, key, value) => {
      if (!get().project.rooms[room] || applyParam(get().project, room, key, value) === get().project) return; // nothing changes: no undo step
      edit((p) => applyParam(p, room, key, value), `${room}.${key}`);
    },
    setParams: (room, patch) => edit((p) => Object.entries(patch).reduce((q, [k, v]) => applyParam(q, room, k, v), p)),
    setSpec: (room, fn, key) => edit((p) => (p.rooms[room] ? { ...p, rooms: { ...p.rooms, [room]: { ...p.rooms[room]!, spec: fn(p.rooms[room]!.spec) } } } : p), key ? `${room}.spec.${key}` : undefined),
    setSurface: (room, surface, patch) => edit((p) => (p.rooms[room] ? { ...p, rooms: { ...p.rooms, [room]: { ...p.rooms[room]!, spec: setSurf(p.rooms[room]!.spec, surface, patch) } } } : p), `${room}.surf.${surface}`),
    setAllWalls: (room, h, mode) => edit((p) => (p.rooms[room] ? { ...p, rooms: { ...p.rooms, [room]: { ...p.rooms[room]!, spec: allWallsWood(p.rooms[room]!.spec, h, mode) } } } : p)),
    resetRoom: (room) => {
      set((st) => ({ empty: st.empty.filter((x) => !x.startsWith(room + '.')) }));
      edit((p) => resetRoomIn(p, room));
      toast(s_.history.resetDone, true);
    },
    resetAll: () => {
      set({ empty: [] });
      edit((p) => p.roomOrder.reduce(resetRoomIn, p));
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
    addRoom: (template, name, side) => {
      const p0 = get().project;
      if (p0.roomOrder.length >= MAX_ROOMS) return null;
      const tpl = templateById(template);
      if (!tpl.spec) return null;
      const spec = tpl.spec(side);
      const id = newRoomId(p0);
      // a room without a name gets "Pomieszczenie n" (the first n nobody uses), written into the project: it does not change when rooms move
      const used = new Set(p0.roomOrder.map((r) => roomName(r)));
      let n = 1;
      while (used.has(s_.names.room(n))) n++;
      const given = name.trim() || s_.names.room(n);
      edit((p) => ({
        ...p,
        roomOrder: [...p.roomOrder, id],
        rooms: { ...p.rooms, [id]: { on: true, tpl: template, spec } },
        openings: { ...p.openings, [id]: [] },
        splits: { ...p.splits, [id]: {} },
        names: { ...p.names, rooms: setOrDrop(p.names.rooms, id, given) },
      }));
      set({ tab: id });
      return id;
    },
    duplicateRoom: (room) => {
      const p0 = get().project;
      const src = p0.rooms[room];
      if (!src || p0.roomOrder.length >= MAX_ROOMS) return null;
      const id = newRoomId(p0);
      const copyName = s_.rooms.copyName(roomName(room));
      edit((p) => {
        const order = [...p.roomOrder];
        order.splice(order.indexOf(room) + 1, 0, id);
        return {
          ...p, roomOrder: order,
          rooms: { ...p.rooms, [id]: structuredClone(src) },
          openings: { ...p.openings, [id]: structuredClone(p.openings[room] ?? []) },
          splits: { ...p.splits, [id]: structuredClone(p.splits[room] ?? {}) },
          names: {
            rooms: setOrDrop(p.names.rooms, id, copyName),
            surfaces: p.names.surfaces[room] ? { ...p.names.surfaces, [id]: { ...p.names.surfaces[room] } } : p.names.surfaces,
            features: p.names.features[room] ? { ...p.names.features, [id]: { ...p.names.features[room] } } : p.names.features,
          },
        };
      });
      set({ tab: id });
      return id;
    },
    moveRoom: (room, by) => {
      const order = get().project.roomOrder, i = order.indexOf(room), j = Math.max(0, Math.min(order.length - 1, i + by));
      if (i < 0 || i === j) return;
      edit((p) => { const o = [...p.roomOrder]; o.splice(i, 1); o.splice(j, 0, room); return { ...p, roomOrder: o }; });
    },
    removeRoom: (room) => {
      const p0 = get().project;
      const i = p0.roomOrder.indexOf(room);
      if (i < 0) return;
      get().cancelCut(room);
      const next = p0.roomOrder[i + 1] ?? p0.roomOrder[i - 1];
      edit((p) => {
        const rooms = { ...p.rooms }, openings = { ...p.openings }, splits = { ...p.splits }, surfaces = { ...p.names.surfaces }, features = { ...p.names.features };
        delete rooms[room]; delete openings[room]; delete splits[room]; delete surfaces[room]; delete features[room];
        const nameRooms = { ...p.names.rooms }; delete nameRooms[room];
        const { migration: m, ...rest } = p;
        const dropped = m?.dropped.filter((d) => d.room !== room) ?? [];
        return { ...rest, roomOrder: p.roomOrder.filter((x) => x !== room), rooms, openings, splits, names: { rooms: nameRooms, surfaces, features }, ...(m && (dropped.length || m.renamed) ? { migration: { ...m, dropped } } : {}) };
      });
      set((st) => {
        const cuts = { ...st.cuts }, selected = { ...st.selected };
        delete cuts[room]; delete selected[room];
        return { cuts, selected, empty: st.empty.filter((x) => !x.startsWith(room + '.')), tab: st.tab === room ? (next ?? OVERVIEW) : st.tab };
      });
      toast(s_.rooms.removed(roomName(room)), true);
    },
    setRoof: (patch) => edit((p) => {
      const roof = { ...p.roof };
      for (const k of ROOF_KEYS) if (patch[k] !== undefined && isFinite(patch[k]!)) roof[k] = Math.min(ROOF_LIMITS[k][1], Math.max(ROOF_LIMITS[k][0], patch[k]!));
      // a room whose own value now equals the house value follows it again
      const rooms = { ...p.rooms };
      for (const id of p.roomOrder) {
        const r = rooms[id]!;
        if (!r.roof) continue;
        const own = Object.fromEntries(Object.entries(r.roof).filter(([k, v]) => v !== roof[k as RoofKey]));
        if (Object.keys(own).length !== Object.keys(r.roof).length) { const { roof: _o, ...rest } = r; rooms[id] = Object.keys(own).length ? { ...rest, roof: own } : rest; }
      }
      return { ...p, roof, rooms };
    }, 'roof.' + Object.keys(patch).join()),
    startRoofOverride: (room, key) => edit((p) => (p.rooms[room] ? { ...p, rooms: { ...p.rooms, [room]: { ...p.rooms[room]!, roof: { ...p.rooms[room]!.roof, [key]: p.roof[key] } } } } : p)),
    resetRoomRoof: (room, key) => edit((p) => {
      const r = p.rooms[room];
      if (!r?.roof || r.roof[key] === undefined) return p;
      const own = { ...r.roof };
      delete own[key];
      const { roof: _o, ...rest } = r;
      return { ...p, rooms: { ...p.rooms, [room]: Object.keys(own).length ? { ...rest, roof: own } : rest } };
    }),
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
      const p = blankProject(s_.app.newProjectName);
      skipSaveFor = p;
      syncer.bind(p.id);
      syncer.detach(); // gets its own online copy on the first edit
      void saveStored(p).then(async () => set({ projects: await projectsList() }));
      set({ project: p, ...OWN, past: [], future: [], cuts: {}, selected: {}, tab: OVERVIEW, empty: [], rev: get().rev + 1 });
    },
    switchProject: async (id0) => {
      let id = id0;
      if (id === get().project.id) return;
      if (get().access === 'owner' && (!authEnabled || get().project !== skipSaveFor)) await saveStored(get().project); // (an untouched new project is not worth storing)
      if (id.startsWith(CLOUD_PREFIX)) { // an account project that this browser has no copy of yet: fetch it, keep a copy
        const cloudId = id.slice(CLOUD_PREFIX.length);
        const r = await api.get(cloudId);
        if (r.kind !== 'ok' || r.value.access !== 'owner') { sonner(s_.cloud.loadFailed, { duration: 12000 }); return; }
        const local = { ...r.value.project, id: newLocalId() };
        await saveStored(local);
        metaStore.save(local.id, { id: cloudId, revision: r.value.revision, dirty: false });
        id = local.id;
      }
      const p = await loadStored(id);
      if (p) skipSaveFor = p;
      if (p) { syncer.bind(p.id); if (!syncer.id) { syncer.detach(p); void syncer.flush(p); } else if (syncer.dirty) void syncer.flush(p); }
      if (p) set({ sync: syncer.status, cloudId: syncer.id, project: p, ...OWN, past: [], future: [], cuts: {}, selected: {}, tab: OVERVIEW, empty: [], rev: get().rev + 1, projects: await projectsList() });
    },
    deleteProject: async (id) => {
      if (get().access !== 'owner') return; // deleting is the owner's
      const cloud = id === get().project.id ? syncer.id : metaStore.load(id).id;
      if (authEnabled && cloud) {
        const r = await api.remove(cloud);
        if (r.kind !== 'ok' && r.kind !== 'notfound') { sonner(s_.access.deleteFailed, { duration: 12000 }); return; }
        serverList = serverList?.filter((x) => x.id !== cloud) ?? null;
      }
      await deleteStored(id);
      const list = await listProjects();
      if (id === get().project.id) {
        const next = list[0] ? await loadStored(list[0].id) : null;
        const shown = next ?? blankProject(s_.app.defaultProjectName);
        skipSaveFor = shown;
        syncer.bind(shown.id);
        if (!syncer.id) syncer.detach(shown);
        set({ project: shown, ...OWN, past: [], future: [], cuts: {}, selected: {}, tab: OVERVIEW, empty: [], rev: get().rev + 1 });
      }
      set({ projects: await projectsList() });
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
      void saveStored(p).then(async () => set({ projects: await projectsList() }));
      set({ project: p, ...OWN, past: [], future: [], cuts: {}, selected: {}, tab: OVERVIEW, empty: [], rev: get().rev + 1 });
    },
    setSplits: (room, splits, key) => edit((p) => ({ ...p, splits: { ...p.splits, [room]: splits } }), key ? `splits.${room}.${key}` : undefined),
    dismissMigration: () => edit((p) => { const { migration: _m, ...rest } = p; return rest; }),
    setEmpty: (id, empty) => set((st) => (st.access === 'view' || st.empty.includes(id) === empty ? st : { empty: empty ? [...st.empty, id] : st.empty.filter((x) => x !== id) })),
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
setNames(useStore.getState().project.names, useStore.getState().project.roomOrder);
useStore.subscribe((st, prev) => { if (st.project.names !== prev.project.names || st.project.roomOrder !== prev.project.roomOrder) setNames(st.project.names, st.project.roomOrder); });

if (cloudDisabled()) syncer.disable(); // no server to talk to: browser-only saving

// autosave: the browser copy after 400 ms, the online copy after 800 ms (inside the syncer)
useStore.subscribe((s, prev) => {
  if (!s.loaded || s.project === prev.project || s.project === skipSaveFor || s.access === 'view') return;
  clearTimeout(saveTimer);
  if (s.access === 'edit') { syncer.change(s.project); return; } // somebody else's project: only the server keeps it
  saveTimer = setTimeout(() => { void saveStored(useStore.getState().project).then(async () => useStore.setState({ projects: await projectsList() })); }, 400);
  syncer.change(s.project);
});

// last chance to save (tab hidden or closed, phone locked), and retry when the network is back
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const hide = () => {
    clearTimeout(saveTimer);
    const st = useStore.getState();
    if (st.loaded && st.project !== skipSaveFor && st.access === 'owner') void saveStored(st.project);
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
  }, 700);
});

/** The page that is shown: the chosen one, or the overview when a band or room page is gone (removed, undone, another project). */
export function useTab(): Tab {
  const tab = useStore((st) => st.tab);
  const bands = useStore((st) => st.project.bands);
  const rooms = useStore((st) => st.project.rooms);
  const id = tabBandId(tab);
  if (id) return bands.some((b) => b.id === id) ? tab : OVERVIEW;
  return tab === OVERVIEW || rooms[tab] ? tab : OVERVIEW;
}
