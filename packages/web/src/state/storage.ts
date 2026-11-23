import { del, get, set } from 'idb-keyval';
import LZString from 'lz-string';
import { sanitizeProject, type Project } from './project';
import type { MetaStore, SyncMeta } from './sync';

const LEGACY = 'slabs:project:v1';
/**
 * The browser copy is kept per signed-in user: with login, "slabs:u:<userId>:" is put in front of every key, so one person's
 * projects are never shown to (or uploaded by) another person who signs in on the same browser. Without login (local dev,
 * single-file build) the scope is empty and the keys are the old ones. The old, unscoped projects of a browser are what is
 * offered once as "Dodaj do konta" after the first sign-in (see claim.ts).
 */
let scope = '';
export function setStorageScope(userId: string | null): void { scope = userId ? `u:${userId}:` : ''; }
export const storageScope = (): string => scope;
const indexKey = (sc: string) => `slabs:${sc}index:v2`;
const key = (id: string, sc = scope) => `slabs:${sc}p:${id}`;

export interface ProjectInfo { id: string; name: string; updatedAt: number; /** the online copy of this project, if it has one */ cloudId?: string | null }

async function read(k: string): Promise<unknown> {
  try { const v = await get(k); if (v !== undefined) return v; } catch { /* fall through */ }
  try { const raw = localStorage.getItem(k); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return undefined;
}
async function write(k: string, v: unknown): Promise<boolean> {
  try { await set(k, v); return true; } catch { /* fall through */ }
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
}

/** All projects kept in this browser, newest first. The single project of version 1 is migrated. */
export async function listProjects(sc = scope): Promise<ProjectInfo[]> {
  const INDEX = indexKey(sc);
  const idx = await read(INDEX);
  let list: ProjectInfo[] = Array.isArray(idx) ? (idx as ProjectInfo[]).filter((x) => x && typeof x.id === 'string') : [];
  if (!list.length && sc === '') {
    const old = sanitizeProject(await read(LEGACY));
    if (old) { await saveStored(old, ''); list = (await read(INDEX) as ProjectInfo[]) ?? []; }
  }
  const meta = readMetaMap(sc);
  return list.map((x) => ({ ...x, cloudId: meta[x.id]?.id ?? null })).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadStored(id?: string, sc = scope): Promise<Project | null> {
  const list = await listProjects(sc);
  const pick = id ?? list[0]?.id;
  if (!pick) return null;
  return sanitizeProject(await read(key(pick, sc)));
}

export async function saveStored(p: Project, sc = scope): Promise<boolean> {
  const INDEX = indexKey(sc);
  const ok = await write(key(p.id, sc), p);
  const idx = await read(INDEX);
  const list: ProjectInfo[] = Array.isArray(idx) ? (idx as ProjectInfo[]).filter((x) => x.id !== p.id) : [];
  list.push({ id: p.id, name: p.name, updatedAt: p.updatedAt });
  await write(INDEX, list);
  return ok;
}

export async function deleteStored(id: string, sc = scope): Promise<void> {
  const INDEX = indexKey(sc);
  try { await del(key(id, sc)); } catch { /* ignore */ }
  try { localStorage.removeItem(key(id, sc)); } catch { /* ignore */ }
  const idx = await read(INDEX);
  const rest = Array.isArray(idx) ? (idx as ProjectInfo[]).filter((x) => x.id !== id) : [];
  if (Array.isArray(idx)) await write(INDEX, rest);
  if (sc === '' && !rest.length) { try { await del(LEGACY); } catch { /* ignore */ } try { localStorage.removeItem(LEGACY); } catch { /* ignore */ } } // the version-1 project must not come back
  const all = readMetaMap(sc);
  if (all[id]) { delete all[id]; try { localStorage.setItem(metaKey(sc), JSON.stringify(all)); } catch { /* ignore */ } }
}

/** A project that was never saved to this scope: write it under the signed-in user's keys (used by "Dodaj do konta"). */
export async function saveStoredIn(p: Project, meta: SyncMeta | null): Promise<void> {
  await saveStored(p);
  if (meta) metaStore.save(p.id, meta);
}
/** The old browser projects (no login scope) and what is remembered about their online copy. */
export const legacyMeta = (id: string): SyncMeta => {
  const m = readMetaMap('')[id];
  return m && typeof m.id === 'string' ? { id: m.id, revision: Number(m.revision) || 0, dirty: !!m.dirty } : { id: null, revision: 0, dirty: false };
};
export const legacyBrowser = {
  list: () => listProjects(''),
  load: (id: string) => loadStored(id, ''),
  remove: (id: string) => deleteStored(id, ''),
};

export const encodeShare = (p: Project): string => LZString.compressToEncodedURIComponent(JSON.stringify(p));

export function decodeShare(hash: string): Project | null {
  const m = /^#?p=(.+)$/.exec(hash);
  if (!m) return null;
  try {
    const json = LZString.decompressFromEncodedURIComponent(m[1]!);
    return json ? sanitizeProject(JSON.parse(json)) : null;
  } catch { return null; }
}

// ---- cloud sync bookkeeping ----------------------------------------------------------------------------------------
const metaKey = (sc: string) => `slabs:${sc}cloud:v2`;
const conflictKey = () => `slabs:${scope}conflict:v2`;

function readMetaMap(sc = scope): Record<string, SyncMeta> {
  try { const m = JSON.parse(localStorage.getItem(metaKey(sc)) ?? '{}') as unknown; return m && typeof m === 'object' ? m as Record<string, SyncMeta> : {}; } catch { return {}; }
}

/** Per local project: its cloud id, the revision it was last in sync with, and whether it has unsynced edits. */
export const metaStore: MetaStore = {
  load(localId) {
    const m = localId.startsWith('shared:') ? undefined : readMetaMap()[localId]; // a project opened by somebody else's link is never remembered here
    return m && typeof m.id === 'string' ? { id: m.id, revision: Number(m.revision) || 0, dirty: !!m.dirty } : { id: null, revision: 0, dirty: false };
  },
  save(localId, m) {
    if (localId.startsWith('shared:')) return;
    try {
      const all = readMetaMap();
      if (m.id) all[localId] = m; else delete all[localId];
      localStorage.setItem(metaKey(scope), JSON.stringify(all));
    } catch { /* ignore */ }
  },
};

/** The local copy that lost against a newer server revision, kept until the user restores or dismisses it. */
export async function stashConflict(localId: string, p: Project | null): Promise<void> {
  try { if (p) await set(conflictKey(), { localId, project: p }); else await del(conflictKey()); } catch { /* ignore */ }
}
export async function loadConflict(): Promise<{ localId: string; project: Project } | null> {
  try {
    const v = await get(conflictKey()) as { localId?: unknown; project?: unknown } | undefined;
    const project = sanitizeProject(v?.project);
    return project && typeof v?.localId === 'string' ? { localId: v.localId, project } : null;
  } catch { return null; }
}

/** Ask the browser not to evict our storage. Fire and forget. */
export function requestPersistence(): void {
  try { void navigator.storage?.persist?.(); } catch { /* ignore */ }
}
