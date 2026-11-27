// Thin client for /api/projects. Never throws: every outcome is a typed result. Every request carries the session token
// of the signed-in user (auth/index.tsx); the server refuses everything else.
import { getAuthToken } from '../auth/token';
import { sanitizeProject, type Project } from './project';

/** What the signed-in user may do with an opened project. `claim` = an old link-only project nobody owns yet. */
export type Access = 'owner' | 'edit' | 'view' | 'claim';
export interface CloudProjectInfo { id: string; name: string; updatedAt: number; revision: number }
export interface Sharing { viewToken: string | null; editToken: string | null }
export type LinkOp = 'create' | 'off' | 'regenerate';

export type ApiResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'conflict'; project: Project; revision: number }
  | { kind: 'notfound' }
  | { kind: 'forbidden'; reason: string }  // 403: not yours, link off, read-only, owner only
  | { kind: 'unauthorized' }               // 401: no valid session
  | { kind: 'unavailable' }                // API not there (plain dev server, single-file build, file://)
  | { kind: 'offline' }                    // network failure
  | { kind: 'error'; status: number; retry: boolean };

export interface CloudApi {
  list(): Promise<ApiResult<CloudProjectInfo[]>>;
  create(p: Project): Promise<ApiResult<{ id: string; revision: number }>>;
  /** `key` = the secret of a share link (?k=), or of an old link-only project (its id) */
  get(id: string, key?: string | null): Promise<ApiResult<{ project: Project; revision: number; access: Access }>>;
  put(id: string, p: Project, baseRevision: number, keepalive?: boolean, key?: string | null): Promise<ApiResult<{ revision: number }>>;
  claim(id: string, key: string): Promise<ApiResult<{ revision: number }>>;
  remove(id: string): Promise<ApiResult<null>>;
  getSharing(id: string): Promise<ApiResult<Sharing>>;
  setSharing(id: string, ops: { view?: LinkOp; edit?: LinkOp }): Promise<ApiResult<Sharing>>;
}

/** True where the app can never reach the /api/projects function (single-file artifact build, file://, sandboxed frames). */
export function cloudDisabled(): boolean {
  if (typeof __SINGLEFILE__ !== 'undefined' && __SINGLEFILE__) return true;
  return typeof location === 'undefined' || !/^https?:$/.test(location.protocol);
}

export function createApi(fetchFn: typeof fetch = (...a) => fetch(...a), base = '/api/projects', token: () => Promise<string | null> = getAuthToken): CloudApi {
  async function call(url: string, init: RequestInit): Promise<{ res: Response } | { fail: ApiResult<never> }> {
    let res: Response;
    const t = await token().catch(() => null);
    const headers = { ...(init.headers as Record<string, string> | undefined), ...(t ? { authorization: `Bearer ${t}` } : {}) };
    try { res = await fetchFn(url, { ...init, headers }); } catch { return { fail: { kind: 'offline' } }; }
    // Every real response carries x-slabs-api. A static host answers 404/200+HTML without it.
    if (!res.headers.get('x-slabs-api')) return { fail: res.status >= 500 ? { kind: 'offline' } : { kind: 'unavailable' } };
    // no session to send (a build without login): the server cannot be used, the app stays in browser-only saving
    if (res.status === 401 && !t) return { fail: { kind: 'unavailable' } };
    return { res };
  }
  const body = (p: Project) => JSON.stringify(p);
  const rev = (res: Response) => Number(res.headers.get('x-revision')) || 0;
  const withKey = (u: string, key?: string | null) => (key ? `${u}${u.includes('?') ? '&' : '?'}k=${encodeURIComponent(key)}` : u);
  const url = (id: string, sub = '', key?: string | null) => withKey(`${base}/${encodeURIComponent(id)}${sub}`, key);
  async function fromStatus(res: Response): Promise<ApiResult<never>> {
    if (res.status === 404) return { kind: 'notfound' };
    if (res.status === 401) return { kind: 'unauthorized' };
    if (res.status === 403) {
      let reason = 'forbidden';
      try { reason = ((await res.json()) as { error?: string }).error ?? reason; } catch { /* keep */ }
      return { kind: 'forbidden', reason };
    }
    return { kind: 'error', status: res.status, retry: res.status >= 500 || res.status === 429 };
  }
  const parse = async <T>(res: Response, pick: (j: unknown) => T | null): Promise<ApiResult<T>> => {
    try { const v = pick(await res.json()); return v === null ? { kind: 'error', status: 500, retry: true } : { kind: 'ok', value: v }; }
    catch { return { kind: 'error', status: 500, retry: true }; }
  };
  const sharing = (j: unknown): Sharing | null => {
    const o = j as { viewToken?: unknown; editToken?: unknown } | null;
    if (!o || typeof o !== 'object') return null;
    return { viewToken: typeof o.viewToken === 'string' ? o.viewToken : null, editToken: typeof o.editToken === 'string' ? o.editToken : null };
  };

  return {
    async list() {
      const r = await call(base, { method: 'GET', cache: 'no-store' });
      if ('fail' in r) return r.fail;
      if (r.res.status !== 200) return fromStatus(r.res);
      return parse(r.res, (j) => (Array.isArray(j)
        ? j.filter((x): x is CloudProjectInfo => !!x && typeof x.id === 'string').map((x) => ({ id: x.id, name: String(x.name ?? ''), updatedAt: Number(x.updatedAt) || 0, revision: Number(x.revision) || 1 }))
        : null));
    },
    async create(p) {
      const r = await call(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body(p) });
      if ('fail' in r) return r.fail;
      if (r.res.status !== 201) return fromStatus(r.res);
      return parse(r.res, (j) => { const o = j as { id: string; revision: number }; return { id: o.id, revision: o.revision }; });
    },
    async get(id, key) {
      const r = await call(url(id, '', key), { method: 'GET', cache: 'no-store' });
      if ('fail' in r) return r.fail;
      if (r.res.status !== 200) return fromStatus(r.res);
      const access = (r.res.headers.get('x-access') ?? 'owner') as Access;
      try {
        const project = sanitizeProject(await r.res.json());
        return project ? { kind: 'ok', value: { project, revision: rev(r.res), access } } : { kind: 'error', status: 500, retry: false };
      } catch { return { kind: 'error', status: 500, retry: true }; }
    },
    async put(id, p, baseRevision, keepalive = false, key) {
      const r = await call(url(id, '', key), {
        method: 'PUT', headers: { 'content-type': 'application/json', 'x-base-revision': String(baseRevision) }, body: body(p), keepalive,
      });
      if ('fail' in r) return r.fail;
      if (r.res.status === 409) {
        try {
          const project = sanitizeProject(await r.res.json());
          if (project) return { kind: 'conflict', project, revision: rev(r.res) };
        } catch { /* fall through */ }
        return { kind: 'error', status: 409, retry: false };
      }
      if (r.res.status !== 200) return fromStatus(r.res);
      return parse(r.res, (j) => ({ revision: (j as { revision: number }).revision }));
    },
    async claim(id, key) {
      const r = await call(url(id, '/claim', key), { method: 'POST' });
      if ('fail' in r) return r.fail;
      if (r.res.status === 409) return { kind: 'error', status: 409, retry: false };
      if (r.res.status !== 200) return fromStatus(r.res);
      return parse(r.res, (j) => ({ revision: Number((j as { revision: number }).revision) || 1 }));
    },
    async remove(id) {
      const r = await call(url(id), { method: 'DELETE' });
      if ('fail' in r) return r.fail;
      if (r.res.status !== 200) return fromStatus(r.res);
      return { kind: 'ok', value: null };
    },
    async getSharing(id) {
      const r = await call(url(id, '/sharing'), { method: 'GET', cache: 'no-store' });
      if ('fail' in r) return r.fail;
      if (r.res.status !== 200) return fromStatus(r.res);
      return parse(r.res, sharing);
    },
    async setSharing(id, ops) {
      const r = await call(url(id, '/sharing'), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ops) });
      if ('fail' in r) return r.fail;
      if (r.res.status === 409) return { kind: 'error', status: 409, retry: true };
      if (r.res.status !== 200) return fromStatus(r.res);
      return parse(r.res, sharing);
    },
  };
}
