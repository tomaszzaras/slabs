// Request handling for /api/projects. Pure (Request -> Response) so it can be unit tested with an in-memory store.
// The stored blob is exactly the project file format (.slabs.json); revision + updatedAt live in the blob metadata.
import { sanitizeProject, type Project } from '../../packages/web/src/state/project';

export const MAX_BYTES = 2 * 1024 * 1024;
export const ID_RE = /^[A-Za-z0-9_-]{22,64}$/;

export interface BlobMeta { revision: number; updatedAt: number }
export interface ProjectStore {
  getWithMetadata(key: string, opts: { type: 'json' }): Promise<{ data: unknown; etag?: string; metadata: Record<string, unknown> } | null>;
  setJSON(key: string, data: unknown, opts: { metadata: Record<string, unknown>; onlyIfNew?: boolean; onlyIfMatch?: string }): Promise<{ modified: boolean }>;
}

const HEADERS = { 'cache-control': 'no-store', 'x-slabs-api': '1' };
const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...HEADERS, 'content-type': 'application/json; charset=utf-8', ...extra } });
const err = (status: number, error: string) => json(status, { error });
const projectResponse = (status: number, project: unknown, m: BlobMeta) =>
  json(status, project, { 'x-revision': String(m.revision), 'x-updated-at': String(m.updatedAt) });

export function newId(): string {
  const b = new Uint8Array(24); // 192 bits
  crypto.getRandomValues(b);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // 32 URL-safe chars
}

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

const metaOf = (m: Record<string, unknown>): BlobMeta => ({ revision: Number(m.revision) || 1, updatedAt: Number(m.updatedAt) || 0 });

export async function handle(req: Request, store: ProjectStore, now: () => number = Date.now): Promise<Response> {
  const path = new URL(req.url).pathname.replace(/\/+$/, '');
  const m = /^\/api\/projects(?:\/([^/]+))?$/.exec(path);
  if (!m) return err(404, 'not_found');
  const id = m[1];

  if (!id) {
    if (req.method !== 'POST') return err(405, 'method_not_allowed');
    const p = await readProject(req);
    if (p instanceof Response) return p;
    const newKey = newId();
    const meta = { revision: 1, updatedAt: now() };
    const r = await store.setJSON(newKey, p, { metadata: { ...meta }, onlyIfNew: true });
    if (!r.modified) return err(500, 'id_collision');
    return json(201, { id: newKey, ...meta }, { 'x-revision': '1' });
  }

  if (!ID_RE.test(id)) return err(404, 'not_found');
  if (req.method === 'GET') {
    const cur = await store.getWithMetadata(id, { type: 'json' });
    if (!cur) return err(404, 'not_found');
    return projectResponse(200, cur.data, metaOf(cur.metadata));
  }
  if (req.method === 'PUT') {
    const base = Number(req.headers.get('x-base-revision'));
    if (!Number.isInteger(base) || base < 1) return err(400, 'missing_base_revision');
    const p = await readProject(req);
    if (p instanceof Response) return p;
    const cur = await store.getWithMetadata(id, { type: 'json' });
    if (!cur) return err(404, 'not_found');
    const curMeta = metaOf(cur.metadata);
    if (curMeta.revision !== base) return projectResponse(409, cur.data, curMeta);
    const meta = { revision: base + 1, updatedAt: now() };
    const r = await store.setJSON(id, p, { metadata: { ...meta }, ...(cur.etag ? { onlyIfMatch: cur.etag } : {}) });
    if (!r.modified) {
      // lost a race with a concurrent writer: report the winner as a conflict
      const again = await store.getWithMetadata(id, { type: 'json' });
      if (!again) return err(404, 'not_found');
      return projectResponse(409, again.data, metaOf(again.metadata));
    }
    return json(200, meta, { 'x-revision': String(meta.revision) });
  }
  return err(405, 'method_not_allowed');
}
