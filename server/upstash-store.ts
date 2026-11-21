// ProjectStore over Upstash Redis (REST API). Same semantics as the Netlify Blobs store:
//   onlyIfNew   -> write only if the key does not exist
//   onlyIfMatch -> write only if the stored etag equals the given one
// Both checks and the write happen atomically in one Lua script (EVAL), so two concurrent saves cannot both win.
// A project is a Redis hash: data (the project JSON text), etag, meta (JSON text of {revision, updatedAt}).
import { Redis } from '@upstash/redis';
import type { ProjectStore } from './projects-api';

export const KEY_PREFIX = 'slabs:project:';

// ARGV: 1 mode ('new' | 'match' | 'any'), 2 expected etag, 3 data, 4 new etag, 5 meta. Returns 1 if written, 0 if not.
export const WRITE_SCRIPT = `
local cur = redis.call('HGET', KEYS[1], 'etag')
if ARGV[1] == 'new' then
  if cur then return 0 end
elseif ARGV[1] == 'match' then
  if (not cur) or cur ~= ARGV[2] then return 0 end
end
redis.call('HSET', KEYS[1], 'data', ARGV[3], 'etag', ARGV[4], 'meta', ARGV[5])
return 1`;

/** The two Redis calls the store needs; satisfied by @upstash/redis and by test mocks. */
export interface RedisLike {
  hgetall(key: string): Promise<Record<string, unknown> | unknown[] | null>;
  eval(script: string, keys: string[], args: unknown[]): Promise<unknown>;
}

export class MissingCredentialsError extends Error {
  constructor() {
    super('Upstash Redis credentials missing: set KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN). In Vercel: Storage > Upstash Redis > connect to the project, then redeploy.');
    this.name = 'MissingCredentialsError';
  }
}

export function upstashCredentials(env: Record<string, string | undefined>): { url: string; token: string } {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new MissingCredentialsError();
  return { url, token };
}

export function redisFromEnv(env: Record<string, string | undefined>): RedisLike {
  const { url, token } = upstashCredentials(env);
  // raw strings in and out: we store JSON text ourselves
  return new Redis({ url, token, automaticDeserialization: false }) as unknown as RedisLike;
}

// With automaticDeserialization off, @upstash/redis returns HGETALL as a flat [field, value, ...] array
// (with it on, an object); an empty / missing hash is null or []. Accept both.
function hashFields(r: Record<string, unknown> | unknown[] | null): Record<string, unknown> {
  if (!r) return {};
  if (!Array.isArray(r)) return r;
  const o: Record<string, unknown> = {};
  for (let i = 0; i + 1 < r.length; i += 2) o[String(r[i])] = r[i + 1];
  return o;
}

const newEtag = () => {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
};

export function upstashStore(redis: RedisLike): ProjectStore {
  return {
    async getWithMetadata(key) {
      const h = hashFields(await redis.hgetall(KEY_PREFIX + key));
      if ( typeof h.data !== 'string' || typeof h.etag !== 'string') return null;
      return { data: JSON.parse(h.data), etag: h.etag, metadata: typeof h.meta === 'string' ? JSON.parse(h.meta) : {} };
    },
    async setJSON(key, data, opts) {
      const mode = opts.onlyIfNew ? 'new' : opts.onlyIfMatch !== undefined ? 'match' : 'any';
      const r = await redis.eval(
        WRITE_SCRIPT,
        [KEY_PREFIX + key],
        [mode, opts.onlyIfMatch ?? '', JSON.stringify(data), newEtag(), JSON.stringify(opts.metadata)],
      );
      return { modified: Number(r) === 1 };
    },
  };
}
