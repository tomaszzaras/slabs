// Decides which project to show when the app starts, and wires the syncer to it. No DOM, no React.
import type { Access, CloudApi } from './cloudApi';
import type { Project } from './project';
import type { Syncer } from './sync';

export type OpenNotice = 'notfound' | 'loadfailed' | 'forbidden' | null;
/** An old link-only project was opened by its old link: the user may add it to the account ("Dodaj do konta"). */
export interface ClaimOffer { cloudId: string; project: Project; revision: number }
export interface OpenResult {
  project: Project;
  notice: OpenNotice;
  /** owner = the user's own project; edit / view = somebody else's project opened by a share link (not cached in this browser) */
  access: 'owner' | 'edit' | 'view';
  claim?: ClaimOffer;
}

export interface OpenContext {
  /** ?p= from the address (null when absent) */
  linkId: string | null;
  /** ?k= from the address: the secret of a share link (null when absent) */
  key?: string | null;
  /** the most recently used project in this browser */
  newest: Project | null;
  /** the local project that holds this cloud project (null when none does) */
  byCloudId: (cloudId: string) => Promise<Project | null>;
  /** local ids already used in this browser */
  taken: Set<string>;
  fresh: () => Project;
  freshId: () => string;
}

export async function openProject(syncer: Syncer, api: CloudApi, ctx: OpenContext): Promise<OpenResult> {
  const { linkId, newest } = ctx;
  const cache = linkId ? await ctx.byCloudId(linkId) : newest;
  if (cache) syncer.bind(cache.id);
  const id = linkId ?? (cache ? syncer.id : null);
  const cacheMatches = !!cache && !!id && syncer.id === id;

  /** Show a local project; upload it unless it already has a cloud copy (migration of existing local projects). */
  const useLocal = (p: Project | null, notice: OpenNotice): OpenResult => {
    // (always the user's own project)
    const project = p ?? ctx.fresh();
    syncer.bind(project.id);
    if (syncer.id) { syncer.attach(syncer.id, syncer.revision, syncer.dirty); if (syncer.dirty) void syncer.flush(project); }
    else { syncer.detach(project); if (p) void syncer.flush(project); }
    return { project, notice, access: 'owner' };
  };

  if (!id) return useLocal(newest, null);

  // Local edits the server has not seen yet: they win the first push (a 409 then keeps both copies).
  if (cacheMatches && syncer.dirty) {
    syncer.attach(id, syncer.revision, true);
    void syncer.flush(cache!);
    return { project: cache!, notice: null, access: 'owner' };
  }

  const r = await api.get(id, ctx.key ?? id); // the old link of an unclaimed project is its id
  switch (r.kind) {
    case 'ok': {
      const access: Access = r.value.access;
      if (access === 'claim') return { ...useLocal(newest, null), claim: { cloudId: id, project: r.value.project, revision: r.value.revision } };
      if (access === 'view' || access === 'edit') {
        // somebody else's project: a throw-away local id, never stored in this browser
        const project = { ...r.value.project, id: `shared:${id}` };
        syncer.bind(project.id);
        syncer.key = ctx.key ?? null;
        syncer.attach(id, r.value.revision);
        if (access === 'view') syncer.setReadOnly();
        return { project, notice: null, access };
      }
      const sid = r.value.project.id;
      const project = cacheMatches ? { ...r.value.project, id: cache!.id } : ctx.taken.has(sid) ? { ...r.value.project, id: ctx.freshId() } : r.value.project;
      syncer.bind(project.id);
      syncer.attach(id, r.value.revision);
      return { project, notice: null, access: 'owner' };
    }
    case 'unavailable': {
      syncer.disable();
      const p = cache ?? newest ?? ctx.fresh();
      syncer.bind(p.id);
      return { project: p, notice: null, access: 'owner' };
    }
    case 'forbidden':
      return useLocal(newest, 'forbidden');
    case 'notfound': {
      // a stale remembered id: upload the local project again; an unknown link: keep working on the newest local project
      if (cache && cacheMatches) { syncer.detach(cache); void syncer.flush(cache); return { project: cache, notice: linkId ? 'notfound' : null, access: 'owner' }; }
      return useLocal(newest, 'notfound');
    }
    case 'offline':
    case 'unauthorized':
    case 'error':
      if (cacheMatches) {
        syncer.attach(id, syncer.revision, syncer.dirty);
        syncer.markOffline(r.kind === 'error');
        return { project: cache!, notice: null, access: 'owner' };
      }
      return useLocal(newest, 'loadfailed');
    default:
      return useLocal(newest, null);
  }
}
