// In-memory stand-in for a storage backend (etags + conditional writes). Used by unit tests and the e2e mock server.
import type { ProjectStore } from './projects-api';

export function memoryStore(): ProjectStore & {
  data: Map<string, { data: unknown; etag: string; metadata: Record<string, unknown> }>;
  users: Map<string, Set<string>>;
  beforeWrite?: () => void;
} {
  let n = 0;
  const data = new Map<string, { data: unknown; etag: string; metadata: Record<string, unknown> }>();
  const users = new Map<string, Set<string>>();
  const store: ReturnType<typeof memoryStore> = {
    data,
    users,
    async getWithMetadata(key) {
      const e = data.get(key);
      return e ? { data: structuredClone(e.data), etag: e.etag, metadata: { ...e.metadata } } : null;
    },
    async setJSON(key, value, opts) {
      store.beforeWrite?.();
      const e = data.get(key);
      if (opts.onlyIfNew && e) return { modified: false };
      if (opts.onlyIfMatch !== undefined && (!e || e.etag !== opts.onlyIfMatch)) return { modified: false };
      data.set(key, { data: structuredClone(value), etag: `"e${++n}"`, metadata: { ...opts.metadata } });
      return { modified: true };
    },
    async getMeta(key) { const e = data.get(key); return e ? { ...e.metadata } : null; },
    async delete(key) { data.delete(key); },
    index: {
      async add(owner, id) { (users.get(owner) ?? users.set(owner, new Set()).get(owner)!).add(id); },
      async remove(owner, id) { users.get(owner)?.delete(id); },
      async list(owner) { return [...(users.get(owner) ?? [])]; },
    },
  };
  return store;
}
