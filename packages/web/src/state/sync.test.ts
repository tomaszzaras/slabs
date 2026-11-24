import { describe, expect, it } from 'vitest';
import { handle } from '../../../../server/projects-api';
import { stubAuthenticator } from '../../../../server/auth';
import { memoryStore } from '../../../../server/memory-store';
import { createApi, type CloudApi } from './cloudApi';
import { openProject } from './open';
import { newProject, type Project } from './project';
import { Syncer, type SyncMeta, type SyncStatus } from './sync';
import { pl } from '../i18n/pl';

/** fetch() that talks to the real request handler with an in-memory store, optionally "offline". */
function server() {
  const store = memoryStore();
  const state = { offline: false, calls: 0 };
  const fetchFn = (async (url: string, init?: RequestInit) => {
    state.calls++;
    if (state.offline) throw new TypeError('Failed to fetch');
    return handle(new Request(new URL(url, 'http://x'), init), store, stubAuthenticator);
  }) as unknown as typeof fetch;
  return { store, state, api: createApi(fetchFn, '/api/projects', async () => 'test:user1') };
}

const L = 'local1';
/** meta = what the browser remembers about the cloud copy of local project "local1". */
function harness(api: CloudApi, meta: SyncMeta = { id: null, revision: 0, dirty: false }) {
  const timers: Array<{ fn: () => void; ms: number; live: boolean }> = [];
  const log = { status: [] as SyncStatus[], ids: [] as Array<string | null>, conflicts: [] as Array<{ server: Project; local: Project }>, meta: { ...meta } };
  const syncer = new Syncer({
    api,
    meta: { load: () => ({ ...log.meta }), save: (_id, m) => { log.meta = { ...m }; } },
    onStatus: (s) => log.status.push(s),
    onId: (id) => { if (id) log.ids.push(id); },
    onConflict: (server, local) => log.conflicts.push({ server, local }),
    setTimer: (fn, ms) => { const t = { fn, ms, live: true }; timers.push(t); return t; },
    clearTimer: (h) => { if (h) (h as { live: boolean }).live = false; },
  });
  syncer.bind(L);
  log.ids.length = 0;
  const fire = async () => { const t = [...timers].reverse().find((x) => x.live); if (!t) throw new Error('no timer'); t.live = false; t.fn(); await tick(); };
  return { syncer, log, timers, fire };
}
const tick = () => new Promise((r) => setTimeout(r, 5));
const named = (n: string, id = L) => { const p = newProject(n); p.id = id; p.updatedAt = 1; return p; };
const open = (syncer: Syncer, api: CloudApi, o: { newest?: Project | null; linkId?: string | null; byCloud?: Project | null; taken?: string[] }) =>
  openProject(syncer, api, {
    linkId: o.linkId ?? null, newest: o.newest ?? null, byCloudId: async () => o.byCloud ?? null,
    taken: new Set(o.taken ?? []), fresh: () => named('fresh', 'fresh1'), freshId: () => 'new-local-id',
  });

describe('cloud API client', () => {
  it('treats a static host (200 HTML / 404 without x-slabs-api) as "API missing"', async () => {
    const html = createApi((async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch);
    expect((await html.create(named('a'))).kind).toBe('unavailable');
    const nf = createApi((async () => new Response('nope', { status: 404 })) as typeof fetch);
    expect((await nf.get('x'.repeat(30))).kind).toBe('unavailable');
  });
  it('a network failure is offline, not "missing"', async () => {
    const api = createApi((async () => { throw new TypeError('x'); }) as typeof fetch);
    expect((await api.create(named('a'))).kind).toBe('offline');
  });
});

describe('Syncer', () => {
  it('migration: first open with a local project and no cloud id uploads it', async () => {
    const { api, store, state } = server();
    const { syncer, log } = harness(api);
    const local = named('Mój lokalny');
    const r = await open(syncer, api, { newest: local });
    expect(r.project).toBe(local);
    await tick();
    expect(log.ids).toHaveLength(1);
    expect(syncer.status).toBe('saved');
    expect(store.data.size).toBe(1);
    expect((store.data.get(log.ids[0]!)!.data as Project).name).toBe('Mój lokalny');
    expect(log.meta).toEqual({ id: log.ids[0], revision: 1, dirty: false });
    expect(state.calls).toBe(1);
  });

  it('a fresh visitor (no local project) creates nothing until the first edit', async () => {
    const { api, store } = server();
    const { syncer, fire, timers } = harness(api);
    await open(syncer, api, {});
    expect(store.data.size).toBe(0);
    syncer.change(named('first edit'));
    expect(timers.at(-1)!.ms).toBe(800);
    await fire();
    expect(store.data.size).toBe(1);
    expect(syncer.status).toBe('saved');
  });

  it('autosave debounces: several edits become one request', async () => {
    const { api, state } = server();
    const { syncer, fire, log } = harness(api);
    await open(syncer, api, {});
    for (let i = 0; i < 5; i++) syncer.change(named('e' + i));
    expect(log.status.at(-1)).toBe('saving');
    await fire();
    expect(state.calls).toBe(1);
    syncer.change(named('later'));
    await fire();
    expect(state.calls).toBe(2);
    expect(log.meta.revision).toBe(2);
  });

  it('?p= link loads the server copy; the cached copy of the same project is not used when the server answers', async () => {
    const { api, store } = server();
    const created = await api.create(named('na serwerze', 'creator-local-id'));
    if (created.kind !== 'ok') throw new Error();
    const { syncer, log } = harness(api, { id: created.value.id, revision: 0, dirty: false });
    const cache = named('stary cache');
    const r = await open(syncer, api, { newest: cache, linkId: created.value.id, byCloud: cache });
    expect(r.project.name).toBe('na serwerze');
    expect(r.project.id).toBe(L); // it stays the same local project
    expect(syncer.id).toBe(created.value.id);
    expect(log.meta).toEqual({ id: created.value.id, revision: 1, dirty: false });
    expect(store.data.size).toBe(1);
  });

  it('?p= link of a project this browser does not have gets a local id that is not taken', async () => {
    const { api } = server();
    const created = await api.create(named('cudzy', 'taken1'));
    if (created.kind !== 'ok') throw new Error();
    const { syncer } = harness(api);
    const r = await open(syncer, api, { newest: named('other', 'taken1'), linkId: created.value.id, taken: ['taken1'] });
    expect(r.project.name).toBe('cudzy');
    expect(r.project.id).toBe('new-local-id');
    expect(syncer.localId).toBe('new-local-id');
  });

  it('every local project keeps its own cloud id and revision', async () => {
    const { api } = server();
    const map: Record<string, SyncMeta> = {};
    const syncer = new Syncer({
      api, meta: { load: (id) => map[id] ?? { id: null, revision: 0, dirty: false }, save: (id, m) => { map[id] = { ...m }; } },
      onStatus: () => undefined, onId: () => undefined, onConflict: () => undefined,
    });
    syncer.bind('a'); await syncer.flush(named('A', 'a')); const idA = syncer.id;
    syncer.bind('b'); expect(syncer.id).toBeNull();
    await syncer.flush(named('B', 'b')); const idB = syncer.id;
    expect(idA && idB && idA !== idB).toBe(true);
    syncer.bind('a'); expect(syncer.id).toBe(idA);
    expect(map['a']!.revision).toBe(1);
  });

  it('?p= to an unknown id keeps the local project, tells the user and uploads it as a new project', async () => {
    const { api, store } = server();
    const { syncer, log } = harness(api);
    const r = await open(syncer, api, { newest: named('lokalny'), linkId: 'q'.repeat(30) });
    expect(r.notice).toBe('notfound');
    await tick();
    expect(store.data.size).toBe(1);
    expect(log.ids[0]).not.toBe('q'.repeat(30));
  });

  it('offline on open: works from the cache, queues edits, retries with back-off and saves when back', async () => {
    const { api, store, state } = server();
    const created = await api.create(named('v1'));
    if (created.kind !== 'ok') throw new Error();
    const id = created.value.id;
    state.offline = true;
    const { syncer, log, fire, timers } = harness(api, { id, revision: 1, dirty: false });
    const r = await open(syncer, api, { newest: named('v1') });
    expect(r.notice).toBeNull();
    expect(syncer.status).toBe('offline');
    syncer.change(named('edited offline'));
    await fire();                                   // debounce fires, network down
    expect(syncer.status).toBe('offline');
    expect(log.meta.dirty).toBe(true);
    const retry1 = timers.at(-1)!;
    expect(retry1.live && retry1.ms).toBe(3000);
    await fire();                                   // retry 1 fails
    expect(timers.at(-1)!.ms).toBe(10000);
    state.offline = false;
    await fire();                                   // retry 2 succeeds
    expect(syncer.status).toBe('saved');
    expect((store.data.get(id)!.data as Project).name).toBe('edited offline');
    expect(log.meta).toEqual({ id, revision: 2, dirty: false });
  });

  it('dirty local edits left from an earlier session are pushed on open', async () => {
    const { api, store } = server();
    const created = await api.create(named('v1'));
    if (created.kind !== 'ok') throw new Error();
    const id = created.value.id;
    const { syncer } = harness(api, { id, revision: 1, dirty: true });
    const r = await open(syncer, api, { newest: named('unsaved edit') });
    expect(r.project.name).toBe('unsaved edit');
    await tick();
    expect((store.data.get(id)!.data as Project).name).toBe('unsaved edit');
    expect(syncer.status).toBe('saved');
  });

  it('conflict: the server copy is loaded and the local one is handed back, nothing is lost', async () => {
    const { api, store } = server();
    const created = await api.create(named('v1'));
    if (created.kind !== 'ok') throw new Error();
    const id = created.value.id;
    const { syncer, log, fire } = harness(api, { id, revision: 1, dirty: false });
    await api.put(id, named('from the other device'), 1); // someone else saves revision 2
    syncer.attach(id, 1);
    syncer.change(named('from this device'));
    await fire();
    expect(log.conflicts).toHaveLength(1);
    expect(log.conflicts[0]!.server.name).toBe('from the other device');
    expect(log.conflicts[0]!.local.name).toBe('from this device');
    expect((store.data.get(id)!.data as Project).name).toBe('from the other device');
    expect(log.meta).toEqual({ id, revision: 2, dirty: false });
    // the user restores the local copy: it is an ordinary edit on top of revision 2
    syncer.change(log.conflicts[0]!.local);
    await fire();
    expect((store.data.get(id)!.data as Project).name).toBe('from this device');
    expect(log.meta.revision).toBe(3);
  });

  it('a save that already landed (sent on page hide) is not reported as a conflict', async () => {
    const { api } = server();
    const created = await api.create(named('v1'));
    if (created.kind !== 'ok') throw new Error();
    const id = created.value.id;
    const { syncer, log } = harness(api, { id, revision: 1, dirty: false });
    syncer.attach(id, 1);
    const edit = named('edit');
    syncer.change(edit);
    syncer.flushOnHide();
    await tick();
    await syncer.flush();
    expect(log.conflicts).toHaveLength(0);
    expect(syncer.status).toBe('saved');
    expect(log.meta).toEqual({ id, revision: 2, dirty: false });
  });

  it('API missing: falls back to browser-only saving, quietly and for good', async () => {
    const calls: string[] = [];
    const api = createApi((async (u: string) => { calls.push(u); return new Response('<html>', { status: 200 }); }) as unknown as typeof fetch);
    const { syncer, log } = harness(api);
    const r = await open(syncer, api, { newest: named('lokalny') });
    await tick();
    expect(r.project.name).toBe('lokalny');
    expect(syncer.status).toBe('local');
    expect(syncer.disabled).toBe(true);
    const n = calls.length;
    syncer.change(named('more'));
    syncer.flushOnHide();
    await syncer.retryNow();
    expect(calls.length).toBe(n);
    expect(log.status.at(-1)).toBe('local');
  });

  it('server errors show the error state and can be retried', async () => {
    let fail = true;
    const api = createApi((async () => fail
      ? new Response('{}', { status: 500, headers: { 'x-slabs-api': '1' } })
      : new Response('{"id":"abcdefghijklmnopqrstuv","revision":1}', { status: 201, headers: { 'x-slabs-api': '1' } })) as unknown as typeof fetch);
    const { syncer, fire } = harness(api);
    syncer.change(named('x'));
    await fire();
    expect(syncer.status).toBe('error');
    fail = false;
    await syncer.retryNow();
    expect(syncer.status).toBe('saved');
  });
});

describe('catalogues', () => {
  it('the five status texts of the top bar', () => {
    expect(pl.cloud.saved).toBe('Zapisano ✓');
    expect(pl.cloud.saving).toBe('Zapisuję…');
    expect(pl.cloud.offline).toBe('Offline – zapiszę później');
    expect(pl.cloud.error).toBe('Błąd zapisu – spróbuj ponownie');
    expect(pl.cloud.local).toBe('Zapis tylko w tej przeglądarce');
  });
});
