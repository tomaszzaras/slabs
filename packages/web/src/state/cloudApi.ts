// Thin client for /api/projects. Never throws: every outcome is a typed result.
import { sanitizeProject, type Project } from './project';

export type ApiResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'conflict'; project: Project; revision: number }
  | { kind: 'notfound' }
  | { kind: 'unavailable' }          // API not there (plain dev server, single-file build, file://)
  | { kind: 'offline' }              // network failure
  | { kind: 'error'; status: number; retry: boolean };

export interface CloudApi {
  create(p: Project): Promise<ApiResult<{ id: string; revision: number }>>;
  get(id: string): Promise<ApiResult<{ project: Project; revision: number }>>;
  put(id: string, p: Project, baseRevision: number, keepalive?: boolean): Promise<ApiResult<{ revision: number }>>;
}

/** True where the app can never reach the /api/projects function (single-file artifact build, file://, sandboxed frames). */
export function cloudDisabled(): boolean {
  if (typeof __SINGLEFILE__ !== 'undefined' && __SINGLEFILE__) return true;
  return typeof location === 'undefined' || !/^https?:$/.test(location.protocol);
}

export function createApi(fetchFn: typeof fetch = (...a) => fetch(...a), base = '/api/projects'): CloudApi {
  async function call(url: string, init: RequestInit): Promise<{ res: Response } | { fail: ApiResult<never> }> {
    let res: Response;
    try { res = await fetchFn(url, init); } catch { return { fail: { kind: 'offline' } }; }
    // Every real response carries x-slabs-api. A static host answers 404/200+HTML without it.
    if (!res.headers.get('x-slabs-api')) return { fail: res.status >= 500 ? { kind: 'offline' } : { kind: 'unavailable' } };
    return { res };
  }
  const body = (p: Project) => JSON.stringify(p);
  const rev = (res: Response) => Number(res.headers.get('x-revision')) || 0;
  const fromStatus = (res: Response): ApiResult<never> =>
    res.status === 404 ? { kind: 'notfound' } : { kind: 'error', status: res.status, retry: res.status >= 500 || res.status === 429 };

  return {
    async create(p) {
      const r = await call(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body(p) });
      if ('fail' in r) return r.fail;
      if (r.res.status !== 201) return fromStatus(r.res);
      try { const j = await r.res.json() as { id: string; revision: number }; return { kind: 'ok', value: { id: j.id, revision: j.revision } }; }
      catch { return { kind: 'error', status: 500, retry: true }; }
    },
    async get(id) {
      const r = await call(`${base}/${encodeURIComponent(id)}`, { method: 'GET', cache: 'no-store' });
      if ('fail' in r) return r.fail;
      if (r.res.status !== 200) return fromStatus(r.res);
      try {
        const project = sanitizeProject(await r.res.json());
        return project ? { kind: 'ok', value: { project, revision: rev(r.res) } } : { kind: 'error', status: 500, retry: false };
      } catch { return { kind: 'error', status: 500, retry: true }; }
    },
    async put(id, p, baseRevision, keepalive = false) {
      const r = await call(`${base}/${encodeURIComponent(id)}`, {
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
      try { const j = await r.res.json() as { revision: number }; return { kind: 'ok', value: { revision: j.revision } }; }
      catch { return { kind: 'error', status: 500, retry: true }; }
    },
  };
}
