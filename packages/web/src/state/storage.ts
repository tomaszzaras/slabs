import { get, set } from 'idb-keyval';
import LZString from 'lz-string';
import { sanitizeProject, type Project } from './project';

const KEY = 'slabs:project:v1';
const LS_KEY = 'slabs:project:v1';

/** IndexedDB first, localStorage as a fallback (private windows, blocked storage). */
export async function loadStored(): Promise<Project | null> {
  try {
    const v = await get(KEY);
    const p = sanitizeProject(v);
    if (p) return p;
  } catch { /* fall through */ }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return sanitizeProject(JSON.parse(raw));
  } catch { /* ignore */ }
  return null;
}

export async function saveStored(p: Project): Promise<boolean> {
  try { await set(KEY, p); return true; } catch { /* fall through */ }
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); return true; } catch { return false; }
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
