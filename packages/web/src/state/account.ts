// The signed-in user's project list and "Dodaj do konta": no DOM, no React, effects injected where it matters.
import type { ClaimOffer } from './open';
import type { CloudApi, CloudProjectInfo } from './cloudApi';
import { blankProject, type Project } from './project';
import { legacyBrowser, legacyMeta, saveStoredIn, type ProjectInfo } from './storage';

/** Entries of the project list that exist only on the server (no copy in this browser yet) get the id "cloud:<id>". */
export const CLOUD_PREFIX = 'cloud:';

/** The user's projects: this browser's copies plus the ones only the server has, newest first. */
export function mergeProjects(local: ProjectInfo[], server: CloudProjectInfo[] | null): ProjectInfo[] {
  const have = new Set(local.map((x) => x.cloudId).filter(Boolean));
  const extra: ProjectInfo[] = (server ?? []).filter((x) => !have.has(x.id)).map((x) => ({ id: CLOUD_PREFIX + x.id, name: x.name, updatedAt: x.updatedAt, cloudId: x.id }));
  // the server knows the newer name / time of a project another device saved
  const byCloud = new Map((server ?? []).map((x) => [x.id, x]));
  const merged = local.map((x) => { const c = x.cloudId ? byCloud.get(x.cloudId) : undefined; return c && c.updatedAt > x.updatedAt ? { ...x, name: c.name || x.name, updatedAt: c.updatedAt } : x; });
  return [...merged, ...extra].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** A project that can be added to the account. */
export interface ClaimItem {
  key: string;
  name: string;
  updatedAt: number;
  project: Project;
  /** the old online copy (an old link-only project); null = only in this browser */
  cloudId: string | null;
  /** what the browser remembered about that copy */
  revision: number;
  dirty: boolean;
  /** the id in this browser's old store (removed after it was added); null for a project that came from a link */
  localId: string | null;
  source: 'browser' | 'link';
}

const offeredKey = (userId: string) => `slabs:claim-offered:${userId}`;
const readOffered = (userId: string): string[] => { try { const v = JSON.parse(localStorage.getItem(offeredKey(userId)) ?? '[]') as unknown; return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; } };
export function markOffered(userId: string, ids: string[]): void {
  try { localStorage.setItem(offeredKey(userId), JSON.stringify([...new Set([...readOffered(userId), ...ids])])); } catch { /* ignore */ }
}

/**
 * Projects found in this browser before login (offered once per user), plus the old link project that was just opened.
 * `all` also lists the ones that were offered before and left alone (menu "Dodaj projekty z tej przeglądarki").
 */
export async function findClaimItems(userId: string, link: ClaimOffer | undefined, all = false): Promise<ClaimItem[]> {
  const offered = new Set(all ? [] : readOffered(userId));
  const items: ClaimItem[] = [];
  const seenCloud = new Set<string>();
  if (link) {
    items.push({ key: 'link:' + link.cloudId, name: link.project.name, updatedAt: link.project.updatedAt, project: { ...link.project, id: blankProject().id }, cloudId: link.cloudId, revision: link.revision, dirty: false, localId: null, source: 'link' });
    seenCloud.add(link.cloudId);
  }
  for (const info of await legacyBrowser.list()) {
    if (offered.has(info.id) || (info.cloudId && seenCloud.has(info.cloudId))) continue;
    const project = await legacyBrowser.load(info.id);
    if (!project) continue;
    const m = legacyMeta(info.id);
    items.push({ key: 'browser:' + info.id, name: info.name, updatedAt: info.updatedAt, project, cloudId: m.id, revision: m.revision, dirty: m.dirty, localId: info.id, source: 'browser' });
  }
  return items;
}

export interface ClaimOutcome { added: string[]; failed: string[]; /** claim key -> the id of the copy now in the account's browser store */ local: Record<string, string> }

/** Adds the chosen projects to the account: claims old online copies, uploads the rest. Nothing is removed from the browser unless it arrived. */
export async function addToAccount(api: CloudApi, items: ClaimItem[]): Promise<ClaimOutcome> {
  const out: ClaimOutcome = { added: [], failed: [], local: {} };
  for (const it of items) {
    let done = false;
    if (it.cloudId) {
      const r = await api.claim(it.cloudId, it.cloudId);
      if (r.kind === 'ok') {
        await saveStoredIn(it.project, { id: it.cloudId, revision: it.source === 'link' ? r.value.revision : it.revision || r.value.revision, dirty: it.dirty });
        done = true;
      }
    }
    if (!done) { // no online copy, or somebody else owns / deleted it: upload this copy as a new project of the account
      const r = await api.create(it.project);
      if (r.kind === 'ok') { await saveStoredIn(it.project, { id: r.value.id, revision: r.value.revision, dirty: false }); done = true; }
      else if (r.kind === 'offline') { await saveStoredIn(it.project, null); done = true; } // kept in the account's browser copy, uploaded when opened
    }
    if (!done) { out.failed.push(it.key); continue; }
    out.added.push(it.key);
    out.local[it.key] = it.project.id;
    if (it.localId) await legacyBrowser.remove(it.localId);
  }
  return out;
}
