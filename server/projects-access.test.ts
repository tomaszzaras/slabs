// Ownership, sharing links, claiming of old link-only projects, per-user index, record migration.
import { describe, expect, it } from 'vitest';
import { handle, ID_RE } from './projects-api';
import { stubAuthenticator } from './auth';
import { memoryStore } from './memory-store';
import { newProject } from '../packages/web/src/state/project';

type St = ReturnType<typeof memoryStore>;
const as = (user: string | null, store: St) => (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  handle(new Request('http://x' + path, {
    method, body: method === 'GET' || body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    headers: { ...(user ? { authorization: `Bearer test:${user}` } : {}), ...headers },
  }), store, stubAuthenticator, () => 1000);
const proj = (name: string) => { const p = newProject(name); p.updatedAt = 5; return p; };
const create = async (call: ReturnType<typeof as>, name = 'A') => (await (await call('POST', '/api/projects', proj(name))).json() as { id: string }).id;
const share = async (call: ReturnType<typeof as>, id: string, body: object) => (await (await call('PUT', `/api/projects/${id}/sharing`, body)).json()) as { viewToken: string | null; editToken: string | null };

describe('every call needs a signed-in user', () => {
  it('answers 401 (with the API header) without a valid token, for every endpoint', async () => {
    const st = memoryStore();
    const id = await create(as('alice', st));
    const anon = as(null, st);
    const bad = as('x', st);
    for (const [m, path] of [['GET', '/api/projects'], ['POST', '/api/projects'], ['GET', `/api/projects/${id}`], ['PUT', `/api/projects/${id}`], ['DELETE', `/api/projects/${id}`],
      ['POST', `/api/projects/${id}/claim`], ['GET', `/api/projects/${id}/sharing`], ['PUT', `/api/projects/${id}/sharing`]] as const) {
      const r = await anon(m, path, proj('x'));
      expect(r.status, `${m} ${path}`).toBe(401);
      expect(r.headers.get('x-slabs-api')).toBe('1');
    }
    const r = await handle(new Request(`http://x/api/projects/${id}`, { headers: { authorization: 'Bearer garbage' } }), st, stubAuthenticator);
    expect(r.status).toBe(401);
    expect(bad).toBeTypeOf('function');
  });
});

describe('ownership', () => {
  it('a new project belongs to its creator; others get 403 without a link', async () => {
    const st = memoryStore();
    const alice = as('alice', st), bob = as('bob', st);
    const id = await create(alice);
    expect(id).toMatch(ID_RE);
    expect(st.data.get(id)!.metadata).toMatchObject({ owner: 'alice', name: 'A', viewToken: null, editToken: null });
    const g = await alice('GET', `/api/projects/${id}`);
    expect(g.status).toBe(200);
    expect(g.headers.get('x-access')).toBe('owner');
    expect((await bob('GET', `/api/projects/${id}`)).status).toBe(403);
    expect((await bob('PUT', `/api/projects/${id}`, proj('hack'), { 'x-base-revision': '1' })).status).toBe(403);
    expect((await bob('DELETE', `/api/projects/${id}`)).status).toBe(403);
    expect((await bob('GET', `/api/projects/${id}/sharing`)).status).toBe(403);
    expect((await bob('GET', `/api/projects/${id}?k=${id}`)).status).toBe(403); // the id is not a key for an owned project
    expect((st.data.get(id)!.data as { name: string }).name).toBe('A');
  });

  it('lists only my projects, newest first, from the per-user index', async () => {
    const st = memoryStore();
    const alice = as('alice', st), bob = as('bob', st);
    const a1 = await create(alice, 'one');
    const a2 = await create(alice, 'two');
    await create(bob, 'bobs');
    st.data.get(a1)!.metadata.updatedAt = 10; st.data.get(a2)!.metadata.updatedAt = 20;
    const list = await (await alice('GET', '/api/projects')).json() as Array<{ id: string; name: string }>;
    expect(list.map((x) => x.name)).toEqual(['two', 'one']);
    expect((await (await bob('GET', '/api/projects')).json() as unknown[]).length).toBe(1);
    expect(await (await as('carol', st)('GET', '/api/projects')).json()).toEqual([]);
  });

  it('delete is owner only and removes the record and the index entry; a stale index entry is dropped from the list', async () => {
    const st = memoryStore();
    const alice = as('alice', st);
    const id = await create(alice);
    const id2 = await create(alice, 'B');
    expect((await alice('DELETE', `/api/projects/${id}`)).status).toBe(200);
    expect(st.data.has(id)).toBe(false);
    expect((await alice('GET', `/api/projects/${id}`)).status).toBe(404);
    st.data.delete(id2); st.users.get('alice')!.add(id2); // index entry without record
    expect(await (await alice('GET', '/api/projects')).json()).toEqual([]);
    expect(st.users.get('alice')!.size).toBe(0);
  });

  it('keeps the atomic revision rule for the owner (409 with the server copy on a stale base)', async () => {
    const st = memoryStore();
    const alice = as('alice', st);
    const id = await create(alice, 'v1');
    expect((await alice('PUT', `/api/projects/${id}`, proj('v2'), { 'x-base-revision': '1' })).status).toBe(200);
    const r = await alice('PUT', `/api/projects/${id}`, proj('mine'), { 'x-base-revision': '1' });
    expect(r.status).toBe(409);
    expect((await r.json() as { name: string }).name).toBe('v2');
    expect(st.data.get(id)!.metadata).toMatchObject({ revision: 2, name: 'v2', owner: 'alice' }); // the owner and links survive a save
  });
});

describe('sharing links', () => {
  it('are off at first; the owner creates, turns off and regenerates the view and edit links separately', async () => {
    const st = memoryStore();
    const alice = as('alice', st);
    const id = await create(alice);
    expect(await (await alice('GET', `/api/projects/${id}/sharing`)).json()).toEqual({ viewToken: null, editToken: null });
    const a = await share(alice, id, { view: 'create' });
    expect(a.viewToken).toMatch(ID_RE);
    expect(a.editToken).toBeNull();
    expect((await share(alice, id, { view: 'create' })).viewToken).toBe(a.viewToken); // create keeps an existing link
    const b = await share(alice, id, { edit: 'create' });
    expect(b.viewToken).toBe(a.viewToken);
    expect(b.editToken).toMatch(ID_RE);
    expect(b.editToken).not.toBe(b.viewToken);
    const c = await share(alice, id, { view: 'regenerate' });
    expect(c.viewToken).not.toBe(a.viewToken);
    expect(c.editToken).toBe(b.editToken);
    const d = await share(alice, id, { edit: 'off' });
    expect(d).toEqual({ viewToken: c.viewToken, editToken: null });
    expect((await alice('PUT', `/api/projects/${id}/sharing`, { view: 'bogus' })).status).toBe(400);
    expect((await alice('PUT', `/api/projects/${id}/sharing`, '{')).status).toBe(400);
    expect(st.data.get(id)!.metadata.revision).toBe(1); // sharing does not change the project revision
  });

  it('view link: a signed-in user reads, cannot write, cannot see sharing, cannot delete', async () => {
    const st = memoryStore();
    const alice = as('alice', st), bob = as('bob', st);
    const id = await create(alice);
    const { viewToken } = await share(alice, id, { view: 'create' });
    const g = await bob('GET', `/api/projects/${id}?k=${viewToken}`);
    expect(g.status).toBe(200);
    expect(g.headers.get('x-access')).toBe('view');
    expect((await bob('PUT', `/api/projects/${id}?k=${viewToken}`, proj('x'), { 'x-base-revision': '1' })).status).toBe(403);
    expect((await bob('DELETE', `/api/projects/${id}?k=${viewToken}`)).status).toBe(403);
    expect((await bob('GET', `/api/projects/${id}/sharing?k=${viewToken}`)).status).toBe(403);
    expect((await bob('PUT', `/api/projects/${id}/sharing?k=${viewToken}`, { edit: 'create' })).status).toBe(403);
    expect((await bob('POST', `/api/projects/${id}/claim?k=${viewToken}`)).status).toBe(403);
    expect((await as(null, st)('GET', `/api/projects/${id}?k=${viewToken}`)).status).toBe(401); // the recipient must sign in
    expect(await (await bob('GET', '/api/projects')).json()).toEqual([]); // not in bob's list
  });

  it('edit link: a signed-in user reads and saves, but cannot rename, delete or change sharing', async () => {
    const st = memoryStore();
    const alice = as('alice', st), bob = as('bob', st);
    const id = await create(alice, 'A');
    const { editToken } = await share(alice, id, { edit: 'create' });
    const g = await bob('GET', `/api/projects/${id}?k=${editToken}`);
    expect(g.headers.get('x-access')).toBe('edit');
    const edited = proj('A'); edited.settings = { ...edited.settings, kerf: 7 } as typeof edited.settings;
    const ok = await bob('PUT', `/api/projects/${id}?k=${editToken}`, edited, { 'x-base-revision': '1' });
    expect(ok.status).toBe(200);
    expect(st.data.get(id)!.metadata).toMatchObject({ owner: 'alice', name: 'A', revision: 2 });
    expect((await bob('PUT', `/api/projects/${id}?k=${editToken}`, proj('Renamed'), { 'x-base-revision': '2' })).status).toBe(403);
    expect((await bob('DELETE', `/api/projects/${id}?k=${editToken}`)).status).toBe(403);
    expect((await bob('PUT', `/api/projects/${id}/sharing?k=${editToken}`, { edit: 'off' })).status).toBe(403);
    expect((await bob('PUT', `/api/projects/${id}`, edited, { 'x-base-revision': '2' })).status).toBe(403); // without the token: nothing
  });

  it('turning a link off or regenerating it stops the old link at once', async () => {
    const st = memoryStore();
    const alice = as('alice', st), bob = as('bob', st);
    const id = await create(alice);
    const v1 = (await share(alice, id, { view: 'create', edit: 'create' }));
    expect((await bob('GET', `/api/projects/${id}?k=${v1.viewToken}`)).status).toBe(200);
    const v2 = await share(alice, id, { view: 'regenerate' });
    expect((await bob('GET', `/api/projects/${id}?k=${v1.viewToken}`)).status).toBe(403);
    expect((await bob('GET', `/api/projects/${id}?k=${v2.viewToken}`)).status).toBe(200);
    await share(alice, id, { edit: 'off' });
    expect((await bob('PUT', `/api/projects/${id}?k=${v1.editToken}`, proj('A'), { 'x-base-revision': '1' })).status).toBe(403);
    await share(alice, id, { view: 'off' });
    expect((await bob('GET', `/api/projects/${id}?k=${v2.viewToken}`)).status).toBe(403);
    expect((await alice('GET', `/api/projects/${id}`)).status).toBe(200);
  });

  it('a save that races a sharing change gets 409 and loses nothing', async () => {
    const st = memoryStore();
    const alice = as('alice', st);
    const id = await create(alice, 'v1');
    let once = true;
    st.beforeWrite = () => {
      if (!once) return; once = false;
      const e = st.data.get(id)!;
      st.data.set(id, { ...e, etag: '"sharing"', metadata: { ...e.metadata, viewToken: 'T'.repeat(32) } });
    };
    const r = await alice('PUT', `/api/projects/${id}`, proj('mine'), { 'x-base-revision': '1' });
    expect(r.status).toBe(409);
    expect(st.data.get(id)!.metadata.viewToken).toBe('T'.repeat(32)); // the link change is intact
  });
});

describe('old link-only records (migration) and claiming', () => {
  const legacy = (st: St, name = 'Stary') => {
    const id = 'L'.repeat(32);
    st.data.set(id, { data: proj(name), etag: '"old"', metadata: { revision: 3, updatedAt: 77 } }); // no owner: as written before login existed
    return id;
  };

  it('an unclaimed record is only reachable with its old id as the key, and the first signed-in user can claim it', async () => {
    const st = memoryStore();
    const id = legacy(st);
    const alice = as('alice', st), bob = as('bob', st);
    expect((await alice('GET', `/api/projects/${id}`)).status).toBe(404); // not revealed without the link
    expect((await alice('GET', '/api/projects')).status).toBe(200);
    expect(await (await alice('GET', '/api/projects')).json()).toEqual([]);
    const g = await alice('GET', `/api/projects/${id}?k=${id}`);
    expect(g.status).toBe(200);
    expect(g.headers.get('x-access')).toBe('claim');
    expect(g.headers.get('x-revision')).toBe('3');
    // not writable before it is claimed
    expect((await alice('PUT', `/api/projects/${id}?k=${id}`, proj('x'), { 'x-base-revision': '3' })).status).toBe(403);
    const c = await alice('POST', `/api/projects/${id}/claim?k=${id}`);
    expect(c.status).toBe(200);
    expect(await c.json()).toEqual({ id, revision: 3, updatedAt: 77 });
    expect(st.data.get(id)!.metadata).toMatchObject({ owner: 'alice', name: 'Stary', revision: 3, viewToken: null, editToken: null });
    expect(await (await alice('GET', '/api/projects')).json()).toEqual([{ id, name: 'Stary', updatedAt: 77, revision: 3 }]);
    // now private: the old link no longer opens it for anyone else
    expect((await bob('GET', `/api/projects/${id}?k=${id}`)).status).toBe(403);
    expect((await bob('POST', `/api/projects/${id}/claim?k=${id}`)).status).toBe(403);
    // claiming again as the owner is harmless
    expect((await alice('POST', `/api/projects/${id}/claim?k=${id}`)).status).toBe(200);
    // and the owner saves normally
    expect((await alice('PUT', `/api/projects/${id}`, proj('Nowy'), { 'x-base-revision': '3' })).status).toBe(200);
  });

  it('claiming needs the old link: without the key or with a wrong one nothing happens', async () => {
    const st = memoryStore();
    const id = legacy(st);
    const alice = as('alice', st);
    expect((await alice('POST', `/api/projects/${id}/claim`)).status).toBe(404);
    expect((await alice('POST', `/api/projects/${id}/claim?k=${'x'.repeat(32)}`)).status).toBe(404);
    expect(st.data.get(id)!.metadata.owner).toBeUndefined();
  });

  it('two users claiming at once: exactly one gets it', async () => {
    const st = memoryStore();
    const id = legacy(st);
    const alice = as('alice', st), bob = as('bob', st);
    const [a, b] = await Promise.all([alice('POST', `/api/projects/${id}/claim?k=${id}`), bob('POST', `/api/projects/${id}/claim?k=${id}`)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(['alice', 'bob']).toContain(st.data.get(id)!.metadata.owner);
  });

  it('a record without a name in its metadata still lists after the claim (name taken from the project)', async () => {
    const st = memoryStore();
    const id = legacy(st, 'Dom');
    const alice = as('alice', st);
    await alice('POST', `/api/projects/${id}/claim?k=${id}`);
    expect((await (await alice('GET', '/api/projects')).json() as Array<{ name: string }>)[0]!.name).toBe('Dom');
  });
});
