// Decides which project to show when the app starts, and wires the syncer to it. No DOM, no React.
import type { CloudApi } from './cloudApi';
import type { Project } from './project';
import type { Syncer } from './sync';

export type OpenNotice = 'notfound' | 'loadfailed' | null;
export interface OpenResult { project: Project; notice: OpenNotice }

export interface OpenContext {
  /** ?p= from the address (null when absent) */
  linkId: string | null;
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
    const project = p ?? ctx.fresh();
    syncer.bind(project.id);
    if (syncer.id) { syncer.attach(syncer.id, syncer.revision, syncer.dirty); if (syncer.dirty) void syncer.flush(project); }
    else { syncer.detach(project); if (p) void syncer.flush(project); }
    return { project, notice };
  };

  if (!id) return useLocal(newest, null);

  // Local edits the server has not seen yet: they win the first push (a 409 then keeps both copies).
  if (cacheMatches && syncer.dirty) {
    syncer.attach(id, syncer.revision, true);
    void syncer.flush(cache!);
    return { project: cache!, notice: null };
  }

  const r = await api.get(id);
  switch (r.kind) {
    case 'ok': {
      const sid = r.value.project.id;
      const project = cacheMatches ? { ...r.value.project, id: cache!.id } : ctx.taken.has(sid) ? { ...r.value.project, id: ctx.freshId() } : r.value.project;
      syncer.bind(project.id);
      syncer.attach(id, r.value.revision);
      return { project, notice: null };
    }
    case 'unavailable': {
      syncer.disable();
      const p = cache ?? newest ?? ctx.fresh();
      syncer.bind(p.id);
      return { project: p, notice: null };
    }
    case 'notfound': {
      // a stale remembered id: upload the local project again; an unknown link: keep working on the newest local project
      if (cache && cacheMatches) { syncer.detach(cache); void syncer.flush(cache); return { project: cache, notice: linkId ? 'notfound' : null }; }
      return useLocal(newest, 'notfound');
    }
    case 'offline':
    case 'error':
      if (cacheMatches) {
        syncer.attach(id, syncer.revision, syncer.dirty);
        syncer.markOffline(r.kind === 'error');
        return { project: cache!, notice: null };
      }
      return useLocal(newest, 'loadfailed');
    default:
      return useLocal(newest, null);
  }
}
