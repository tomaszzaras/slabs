import { describe, expect, it } from 'vitest';
import { handle, ID_RE, MAX_BYTES } from './projects-api';
import { memoryStore } from './memory-store';
import { newProject } from '../packages/web/src/state/project';

const call = (store: ReturnType<typeof memoryStore>, method: string, path: string, body?: string, headers: Record<string, string> = {}) =>
  handle(new Request('http://x' + path, { method, body, headers }), store, () => 1000);
const project = (name: string) => { const p = newProject(name); p.updatedAt = 5; return p; };

describe('/api/projects', () => {
  it('creates, reads and saves a project (stored value is the project file format)', async () => {
    const st = memoryStore();
    const c = await call(st, 'POST', '/api/projects', JSON.stringify(project('A')));
    expect(c.status).toBe(201);
    expect(c.headers.get('x-slabs-api')).toBe('1');
    const { id, revision } = await c.json() as { id: string; revision: number };
    expect(id).toMatch(ID_RE);
    expect(id.length).toBeGreaterThanOrEqual(22);
    expect(revision).toBe(1);
    expect((st.data.get(id)!.data as { name: string }).name).toBe('A');

    const g = await call(st, 'GET', `/api/projects/${id}`);
    expect(g.status).toBe(200);
    expect(g.headers.get('x-revision')).toBe('1');
    expect((await g.json() as { name: string; version: number }).version).toBe(1);

    const p = await call(st, 'PUT', `/api/projects/${id}`, JSON.stringify(project('B')), { 'x-base-revision': '1' });
    expect(p.status).toBe(200);
    expect(await p.json()).toEqual({ revision: 2, updatedAt: 1000 });
    const g2 = await call(st, 'GET', `/api/projects/${id}`);
    expect(g2.headers.get('x-revision')).toBe('2');
    expect((await g2.json() as { name: string }).name).toBe('B');
  });

  it('ids are unique and unguessable-looking', async () => {
    const st = memoryStore();
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add(((await (await call(st, 'POST', '/api/projects', JSON.stringify(project('x')))).json()) as { id: string }).id);
    expect(ids.size).toBe(50);
  });

  it('answers 409 with the server copy when the base revision is stale', async () => {
    const st = memoryStore();
    const { id } = await (await call(st, 'POST', '/api/projects', JSON.stringify(project('v1')))).json() as { id: string };
    await call(st, 'PUT', `/api/projects/${id}`, JSON.stringify(project('v2')), { 'x-base-revision': '1' });
    const r = await call(st, 'PUT', `/api/projects/${id}`, JSON.stringify(project('mine')), { 'x-base-revision': '1' });
    expect(r.status).toBe(409);
    expect(r.headers.get('x-revision')).toBe('2');
    expect((await r.json() as { name: string }).name).toBe('v2');
    expect((st.data.get(id)!.data as { name: string }).name).toBe('v2'); // not overwritten
  });

  it('answers 409 when it loses a race with a concurrent writer', async () => {
    const st = memoryStore();
    const { id } = await (await call(st, 'POST', '/api/projects', JSON.stringify(project('v1')))).json() as { id: string };
    let once = true;
    st.beforeWrite = () => {
      if (!once) return;
      once = false;
      const e = st.data.get(id)!;
      st.data.set(id, { data: project('other'), etag: '"other"', metadata: { revision: e.metadata.revision as number + 1, updatedAt: 1 } });
    };
    const r = await call(st, 'PUT', `/api/projects/${id}`, JSON.stringify(project('mine')), { 'x-base-revision': '1' });
    expect(r.status).toBe(409);
    expect((await r.json() as { name: string }).name).toBe('other');
  });

  it('rejects bodies over 2 MB (413), invalid JSON and non-projects (400)', async () => {
    const st = memoryStore();
    const big = JSON.stringify({ ...project('x'), junk: 'a'.repeat(MAX_BYTES) });
    expect((await call(st, 'POST', '/api/projects', big)).status).toBe(413);
    expect((await call(st, 'POST', '/api/projects', big, { 'content-length': String(big.length) })).status).toBe(413);
    expect((await call(st, 'POST', '/api/projects', '{nope')).status).toBe(400);
    expect((await call(st, 'POST', '/api/projects', JSON.stringify({ hello: 1 }))).status).toBe(400);
    const { id } = await (await call(st, 'POST', '/api/projects', JSON.stringify(project('ok')))).json() as { id: string };
    expect((await call(st, 'PUT', `/api/projects/${id}`, big, { 'x-base-revision': '1' })).status).toBe(413);
    expect((await call(st, 'PUT', `/api/projects/${id}`, '{nope', { 'x-base-revision': '1' })).status).toBe(400);
    expect((await call(st, 'PUT', `/api/projects/${id}`, JSON.stringify(project('x')))).status).toBe(400); // no base revision
    expect(st.data.size).toBe(1);
  });

  it('404 for unknown or malformed ids, 405 for other methods', async () => {
    const st = memoryStore();
    expect((await call(st, 'GET', '/api/projects/' + 'a'.repeat(30))).status).toBe(404);
    expect((await call(st, 'GET', '/api/projects/short')).status).toBe(404);
    expect((await call(st, 'PUT', '/api/projects/' + 'a'.repeat(30), JSON.stringify(project('x')), { 'x-base-revision': '1' })).status).toBe(404);
    expect((await call(st, 'DELETE', '/api/projects/' + 'a'.repeat(30))).status).toBe(405);
    expect((await call(st, 'GET', '/api/projects')).status).toBe(405);
    expect((await call(st, 'GET', '/api/other')).status).toBe(404);
  });
});
