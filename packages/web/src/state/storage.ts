import { del, get, set } from 'idb-keyval';
import LZString from 'lz-string';
import { sanitizeProject, type Project } from './project';
import type { MetaStore, SyncMeta } from './sync';

const LEGACY = 'slabs:project:v1';
const INDEX = 'slabs:index:v2';
const key = (id: string) => `slabs:p:${id}`;

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
export async function listProjects(): Promise<ProjectInfo[]> {
  const idx = await read(INDEX);
  let list: ProjectInfo[] = Array.isArray(idx) ? (idx as ProjectInfo[]).filter((x) => x && typeof x.id === 'string') : [];
  if (!list.length) {
    const old = sanitizeProject(await read(LEGACY));
    if (old) { await saveStored(old); list = (await read(INDEX) as ProjectInfo[]) ?? []; }
  }
  const meta = readMetaMap();
  return list.map((x) => ({ ...x, cloudId: meta[x.id]?.id ?? null })).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadStored(id?: string): Promise<Project | null> {
  const list = await listProjects();
  const pick = id ?? list[0]?.id;
  if (!pick) return null;
  return sanitizeProject(await read(key(pick)));
}

export async function saveStored(p: Project): Promise<boolean> {
  const ok = await write(key(p.id), p);
  const idx = await read(INDEX);
  const list: ProjectInfo[] = Array.isArray(idx) ? (idx as ProjectInfo[]).filter((x) => x.id !== p.id) : [];
  list.push({ id: p.id, name: p.name, updatedAt: p.updatedAt });
  await write(INDEX, list);
  return ok;
}

export async function deleteStored(id: string): Promise<void> {
  try { await del(key(id)); } catch { /* ignore */ }
  try { localStorage.removeItem(key(id)); } catch { /* ignore */ }
  const idx = await read(INDEX);
  if (Array.isArray(idx)) await write(INDEX, (idx as ProjectInfo[]).filter((x) => x.id !== id));
}

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
const META_KEY = 'slabs:cloud:v2';
const CONFLICT_KEY = 'slabs:conflict:v2';

function readMetaMap(): Record<string, SyncMeta> {
  try { const m = JSON.parse(localStorage.getItem(META_KEY) ?? '{}') as unknown; return m && typeof m === 'object' ? m as Record<string, SyncMeta> : {}; } catch { return {}; }
}

/** Per local project: its cloud id, the revision it was last in sync with, and whether it has unsynced edits. */
export const metaStore: MetaStore = {
  load(localId) {
    const m = readMetaMap()[localId];
    return m && typeof m.id === 'string' ? { id: m.id, revision: Number(m.revision) || 0, dirty: !!m.dirty } : { id: null, revision: 0, dirty: false };
  },
  save(localId, m) {
    try {
      const all = readMetaMap();
      if (m.id) all[localId] = m; else delete all[localId];
      localStorage.setItem(META_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
  },
};

/** The local copy that lost against a newer server revision, kept until the user restores or dismisses it. */
export async function stashConflict(localId: string, p: Project | null): Promise<void> {
  try { if (p) await set(CONFLICT_KEY, { localId, project: p }); else await del(CONFLICT_KEY); } catch { /* ignore */ }
}
export async function loadConflict(): Promise<{ localId: string; project: Project } | null> {
  try {
    const v = await get(CONFLICT_KEY) as { localId?: unknown; project?: unknown } | undefined;
    const project = sanitizeProject(v?.project);
    return project && typeof v?.localId === 'string' ? { localId: v.localId, project } : null;
  } catch { return null; }
}

/** Ask the browser not to evict our storage. Fire and forget. */
export function requestPersistence(): void {
  try { void navigator.storage?.persist?.(); } catch { /* ignore */ }
}
