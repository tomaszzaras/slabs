import { describe, expect, it } from 'vitest';
import { handle } from './projects-api';
import { MissingCredentialsError, WRITE_SCRIPT, redisFromEnv, upstashCredentials, upstashStore, type RedisLike } from './upstash-store';
import { newProject } from '../packages/web/src/state/project';

/** Mock Redis that runs the Lua script's logic atomically (one synchronous step) and refuses any other script. */
function mockRedis() {
  const hashes = new Map<string, Record<string, string>>();
  let evals = 0;
  const redis: RedisLike & { hashes: typeof hashes; evals: () => number; beforeEval?: () => void } = {
    hashes,
    evals: () => evals,
    async hgetall(key) {
      const h = hashes.get(key);
      // the real client (automaticDeserialization: false) answers with a flat [field, value, ...] array, [] if missing
      return h ? Object.entries(h).flat() : [];
    },
    async eval(script, keys, args) {
      redis.beforeEval?.();
      evals++;
      if (script !== WRITE_SCRIPT) throw new Error('unexpected script');
      const [mode, expected, data, etag, meta] = args as string[];
      const cur = hashes.get(keys[0]!)?.etag;
      if (mode === 'new' && cur !== undefined) return 0;
      if (mode === 'match' && (cur === undefined || cur !== expected)) return 0;
      hashes.set(keys[0]!, { data: data!, etag: etag!, meta: meta! });
      return 1;
    },
  };
  return redis;
}

const call = (store: ReturnType<typeof upstashStore>, method: string, path: string, body?: string, headers: Record<string, string> = {}) =>
  handle(new Request('http://x' + path, { method, body, headers }), store, () => 1000);
const project = (name: string) => { const p = newProject(name); p.updatedAt = 5; return p; };

describe('upstash store', () => {
  it('create only if new, save only if etag matches', async () => {
    const st = upstashStore(mockRedis());
    expect((await st.setJSON('k', { a: 1 }, { metadata: { revision: 1 }, onlyIfNew: true })).modified).toBe(true);
    expect((await st.setJSON('k', { a: 2 }, { metadata: { revision: 1 }, onlyIfNew: true })).modified).toBe(false);
    const cur = (await st.getWithMetadata('k', { type: 'json' }))!;
    expect(cur.data).toEqual({ a: 1 });
    expect(cur.metadata).toEqual({ revision: 1 });
    expect((await st.setJSON('k', { a: 3 }, { metadata: { revision: 2 }, onlyIfMatch: 'stale' })).modified).toBe(false);
    expect((await st.setJSON('missing', { a: 3 }, { metadata: {}, onlyIfMatch: cur.etag })).modified).toBe(false);
    expect((await st.setJSON('k', { a: 3 }, { metadata: { revision: 2 }, onlyIfMatch: cur.etag })).modified).toBe(true);
    const next = (await st.getWithMetadata('k', { type: 'json' }))!;
    expect(next.data).toEqual({ a: 3 });
    expect(next.etag).not.toBe(cur.etag);
    expect(await st.getWithMetadata('nope', { type: 'json' })).toBeNull();
  });

  it('also accepts HGETALL as an object', async () => {
    const st = upstashStore({
      hgetall: async () => ({ data: '{"a":1}', etag: 'e', meta: '{"revision":4}' }),
      eval: async () => 1,
    });
    expect(await st.getWithMetadata('k', { type: 'json' })).toEqual({ data: { a: 1 }, etag: 'e', metadata: { revision: 4 } });
  });

  it('works through the API handler: create, get, put, conflict, race', async () => {
    const redis = mockRedis();
    const st = upstashStore(redis);
    const c = await call(st, 'POST', '/api/projects', JSON.stringify(project('A')));
    expect(c.status).toBe(201);
    const { id } = await c.json() as { id: string };
    expect((await call(st, 'GET', `/api/projects/${id}`)).status).toBe(200);
    expect((await call(st, 'PUT', `/api/projects/${id}`, JSON.stringify(project('B')), { 'x-base-revision': '1' })).status).toBe(200);
    const stale = await call(st, 'PUT', `/api/projects/${id}`, JSON.stringify(project('C')), { 'x-base-revision': '1' });
    expect(stale.status).toBe(409);
    expect((await stale.json() as { name: string }).name).toBe('B');
    // a concurrent writer slips in between the handler's read and its write: exactly one wins, the loser gets 409
    redis.beforeEval = () => {
      redis.beforeEval = undefined;
      const h = redis.hashes.get('slabs:project:' + id)!;
      h.etag = 'other'; h.meta = JSON.stringify({ revision: 3, updatedAt: 9 });
    };
    const lost = await call(st, 'PUT', `/api/projects/${id}`, JSON.stringify(project('D')), { 'x-base-revision': '2' });
    expect(lost.status).toBe(409);
    expect(lost.headers.get('x-revision')).toBe('3');
  });

  it('size limit and invalid input behave as with the other store', async () => {
    const st = upstashStore(mockRedis());
    expect((await call(st, 'POST', '/api/projects', 'x'.repeat(2 * 1024 * 1024 + 1))).status).toBe(413);
    expect((await call(st, 'POST', '/api/projects', '{')).status).toBe(400);
  });
});

describe('upstash credentials', () => {
  it('reads KV_* or UPSTASH_* variables, KV first', () => {
    expect(upstashCredentials({ KV_REST_API_URL: 'u1', KV_REST_API_TOKEN: 't1' })).toEqual({ url: 'u1', token: 't1' });
    expect(upstashCredentials({ UPSTASH_REDIS_REST_URL: 'u2', UPSTASH_REDIS_REST_TOKEN: 't2' })).toEqual({ url: 'u2', token: 't2' });
    expect(upstashCredentials({ KV_REST_API_URL: 'u1', KV_REST_API_TOKEN: 't1', UPSTASH_REDIS_REST_URL: 'u2', UPSTASH_REDIS_REST_TOKEN: 't2' }).url).toBe('u1');
  });
  it('fails with a clear error when missing', () => {
    expect(() => upstashCredentials({})).toThrow(MissingCredentialsError);
    expect(() => redisFromEnv({ KV_REST_API_URL: 'u' })).toThrow(/KV_REST_API_TOKEN/);
  });
});
