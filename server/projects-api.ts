// Request handling for /api/projects. Pure (Request -> Response) so it can be unit tested with an in-memory store and a
// stub authenticator. Every call needs a signed-in user (see ./auth.ts).
//
// A record is the project file (.slabs.json format) plus metadata kept next to it:
//   { revision, updatedAt, owner, name, viewToken, editToken }
// owner = user id; viewToken / editToken = secrets of the share links (null = that link is off). A record without an
// owner is an old link-only project: whoever opens it with its id (the old link) may claim it once (POST .../claim).
//
// GET    /api/projects                  my projects: [{ id, name, updatedAt, revision }]
// POST   /api/projects                  create (the caller becomes the owner)
// GET    /api/projects/:id[?k=token]    owner, or a link token (view / edit), or the old id of an unclaimed project (claim)
//                                       header x-access: owner | edit | view | claim
// PUT    /api/projects/:id[?k=token]    save (owner or edit link; header x-base-revision; 409 + server copy on a stale base)
// DELETE /api/projects/:id              owner only
// POST   /api/projects/:id/claim?k=id   attach an old link-only project to the caller's account
// GET    /api/projects/:id/sharing      owner only: { viewToken, editToken }
// PUT    /api/projects/:id/sharing      owner only: { view?, edit? } each 'create' | 'off' | 'regenerate'
import { sanitizeProject, type Project } from '../packages/web/src/state/project';
import type { Authenticator } from './auth';

export const MAX_BYTES = 2 * 1024 * 1024;
export const ID_RE = /^[A-Za-z0-9_-]{22,64}$/;

export interface BlobMeta { revision: number; updatedAt: number }
export interface ProjectStore {
  getWithMetadata(key: string, opts: { type: 'json' }): Promise<{ data: unknown; etag?: string; metadata: Record<string, unknown> } | null>;
  setJSON(key: string, data: unknown, opts: { metadata: Record<string, unknown>; onlyIfNew?: boolean; onlyIfMatch?: string }): Promise<{ modified: boolean }>;
  /** metadata only (no project body): for lists */
  getMeta(key: string): Promise<Record<string, unknown> | null>;
  delete(key: string): Promise<void>;
  /** per-user index of project ids */
  index: {
    add(owner: string, id: string): Promise<void>;
    remove(owner: string, id: string): Promise<void>;
    list(owner: string): Promise<string[]>;
  };
}

export type Access = 'owner' | 'edit' | 'view' | 'claim';
export interface Meta extends BlobMeta { owner?: string; name?: string; viewToken?: string | null; editToken?: string | null }
export interface Sharing { viewToken: string | null; editToken: string | null }

const HEADERS = { 'cache-control': 'no-store', 'x-slabs-api': '1' };
const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...HEADERS, 'content-type': 'application/json; charset=utf-8', ...extra } });
const err = (status: number, error: string) => json(status, { error });
const projectResponse = (status: number, project: unknown, m: BlobMeta, access: Access) =>
  json(status, project, { 'x-revision': String(m.revision), 'x-updated-at': String(m.updatedAt), 'x-access': access });

function randomToken(): string {
  const b = new Uint8Array(24); // 192 bits
  crypto.getRandomValues(b);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // 32 URL-safe chars
}
export const newId = randomToken;

async function readProject(req: Request): Promise<Project | Response> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) return err(413, 'too_large');
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BYTES) return err(413, 'too_large');
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return err(400, 'invalid_json'); }
  const p = sanitizeProject(raw);
  return p ?? err(400, 'invalid_project');
}

const metaOf = (m: Record<string, unknown>): Meta => ({
  revision: Number(m.revision) || 1,
  updatedAt: Number(m.updatedAt) || 0,
  ...(typeof m.owner === 'string' && m.owner ? { owner: m.owner } : {}),
  ...(typeof m.name === 'string' ? { name: m.name } : {}),
  viewToken: typeof m.viewToken === 'string' ? m.viewToken : null,
  editToken: typeof m.editToken === 'string' ? m.editToken : null,
});

/** Constant-time-ish string compare (tokens are random; this only avoids an early exit). */
function eq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** What this user may do with this record, given the link token `k` of the request. null = nothing. */
export function accessOf(meta: Meta, id: string, user: string, k: string | null): Access | null {
  if (!meta.owner) return k !== null && eq(k, id) ? 'claim' : null; // old link-only project: the id was the link
  if (meta.owner === user) return 'owner';
  if (k && meta.editToken && eq(k, meta.editToken)) return 'edit';
  if (k && meta.viewToken && eq(k, meta.viewToken)) return 'view';
  return null;
}

export async function handle(req: Request, store: ProjectStore, auth: Authenticator, now: () => number = Date.now): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  const m = /^\/api\/projects(?:\/([^/]+)(?:\/(claim|sharing))?)?$/.exec(path);
  if (!m) return err(404, 'not_found');
  const [, id, sub] = m;

  const user = await auth(req);
  if (!user) return err(401, 'unauthorized');

  if (!id) {
    if (req.method === 'GET') {
      const ids = await store.index.list(user);
      const rows = await Promise.all(ids.map(async (pid) => ({ pid, meta: await store.getMeta(pid) })));
      const list: Array<{ id: string; name: string; updatedAt: number; revision: number }> = [];
      for (const { pid, meta } of rows) {
        const mm = meta ? metaOf(meta) : null;
        if (!mm || mm.owner !== user) { await store.index.remove(user, pid); continue; } // stale index entry
        list.push({ id: pid, name: mm.name ?? '', updatedAt: mm.updatedAt, revision: mm.revision });
      }
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      return json(200, list);
    }
    if (req.method !== 'POST') return err(405, 'method_not_allowed');
    const p = await readProject(req);
    if (p instanceof Response) return p;
    const newKey = newId();
    const meta = { revision: 1, updatedAt: now() };
    const r = await store.setJSON(newKey, p, { metadata: { ...meta, owner: user, name: p.name, viewToken: null, editToken: null }, onlyIfNew: true });
    if (!r.modified) return err(500, 'id_collision');
    await store.index.add(user, newKey);
    return json(201, { id: newKey, ...meta }, { 'x-revision': '1', 'x-access': 'owner' });
  }

  if (!ID_RE.test(id)) return err(404, 'not_found');
  const k = url.searchParams.get('k');
  const cur = await store.getWithMetadata(id, { type: 'json' });
  if (!cur) return err(404, 'not_found');
  const curMeta = metaOf(cur.metadata);
  const access = accessOf(curMeta, id, user, k);
  if (!access) return err(curMeta.owner ? 403 : 404, curMeta.owner ? 'forbidden' : 'not_found'); // an unclaimed project does not reveal itself without its link

  if (sub === 'claim') {
    if (req.method !== 'POST') return err(405, 'method_not_allowed');
    if (access === 'owner') return json(200, { id, revision: curMeta.revision, updatedAt: curMeta.updatedAt }, { 'x-revision': String(curMeta.revision), 'x-access': 'owner' });
    if (access !== 'claim') return err(403, 'forbidden');
    const name = (cur.data as { name?: unknown } | null)?.name;
    const meta = { ...curMeta, owner: user, name: typeof name === 'string' ? name : '', viewToken: null, editToken: null };
    const r = await store.setJSON(id, cur.data, { metadata: { ...meta }, ...(cur.etag ? { onlyIfMatch: cur.etag } : {}) });
    if (!r.modified) return err(409, 'conflict'); // somebody else claimed or saved it just now: open it again
    await store.index.add(user, id);
    return json(200, { id, revision: meta.revision, updatedAt: meta.updatedAt }, { 'x-revision': String(meta.revision), 'x-access': 'owner' });
  }

  if (sub === 'sharing') {
    if (access !== 'owner') return err(403, 'owner_only');
    if (req.method === 'GET') return json(200, { viewToken: curMeta.viewToken ?? null, editToken: curMeta.editToken ?? null } satisfies Sharing);
    if (req.method !== 'PUT') return err(405, 'method_not_allowed');
    let body: { view?: unknown; edit?: unknown };
    try { body = JSON.parse(await req.text()) as typeof body; } catch { return err(400, 'invalid_json'); }
    const apply = (op: unknown, old: string | null | undefined): string | null | undefined | Response => {
      if (op === undefined) return old;
      if (op === 'off') return null;
      if (op === 'regenerate') return randomToken();
      if (op === 'create') return old || randomToken();
      return err(400, 'invalid_sharing');
    };
    const view = apply(body.view, curMeta.viewToken);
    if (view instanceof Response) return view;
    const edit = apply(body.edit, curMeta.editToken);
    if (edit instanceof Response) return edit;
    const meta = { ...curMeta, viewToken: view ?? null, editToken: edit ?? null };
    const r = await store.setJSON(id, cur.data, { metadata: { ...meta }, ...(cur.etag ? { onlyIfMatch: cur.etag } : {}) });
    if (!r.modified) return err(409, 'conflict'); // saved at the same moment: ask again
    return json(200, { viewToken: meta.viewToken, editToken: meta.editToken } satisfies Sharing);
  }

  if (req.method === 'GET') return projectResponse(200, cur.data, curMeta, access);

  if (req.method === 'DELETE') {
    if (access !== 'owner') return err(403, 'owner_only');
    await store.delete(id);
    await store.index.remove(user, id);
    return json(200, { deleted: true });
  }

  if (req.method === 'PUT') {
    if (access === 'view') return err(403, 'read_only');
    if (access === 'claim') return err(403, 'claim_required');
    const base = Number(req.headers.get('x-base-revision'));
    if (!Number.isInteger(base) || base < 1) return err(400, 'missing_base_revision');
    const p = await readProject(req);
    if (p instanceof Response) return p;
    if (access !== 'owner' && p.name !== (cur.data as { name?: unknown }).name) return err(403, 'owner_only'); // renaming is the owner's
    if (curMeta.revision !== base) return projectResponse(409, cur.data, curMeta, access);
    const meta = { ...curMeta, revision: base + 1, updatedAt: now(), name: access === 'owner' ? p.name : curMeta.name };
    const r = await store.setJSON(id, p, { metadata: { ...meta }, ...(cur.etag ? { onlyIfMatch: cur.etag } : {}) });
    if (!r.modified) {
      // lost a race with a concurrent writer (or a sharing change): report the winner as a conflict
      const again = await store.getWithMetadata(id, { type: 'json' });
      if (!again) return err(404, 'not_found');
      return projectResponse(409, again.data, metaOf(again.metadata), access);
    }
    return json(200, { revision: meta.revision, updatedAt: meta.updatedAt }, { 'x-revision': String(meta.revision) });
  }
  return err(405, 'method_not_allowed');
}
