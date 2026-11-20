// Cloud sync engine. Knows nothing about React or the DOM: all effects are injected, so it is unit tested.
import { sanitizeProject, type Project } from './project';
import type { CloudApi } from './cloudApi';

export type SyncStatus = 'local' | 'saved' | 'saving' | 'offline' | 'error';

/** What is remembered about the locally cached project. dirty = local edits the server does not have yet. */
export interface SyncMeta { id: string | null; revision: number; dirty: boolean }
/** Metadata is kept per local project (the browser can hold several). */
export interface MetaStore { load(localId: string): SyncMeta; save(localId: string, m: SyncMeta): void }

export interface SyncDeps {
  api: CloudApi;
  meta: MetaStore;
  onStatus(s: SyncStatus): void;
  /** The cloud id of the open project changed (created, attached, or none): update the URL and the project list. */
  onId(id: string | null): void;
  /** The server had a newer revision: show the server copy, keep the local one so the user can restore it. */
  onConflict(server: Project, local: Project): void;
  debounceMs?: number;
  retryMs?: number[];
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
}

/** Same content? The local id differs between browsers, so it is ignored. */
const same = (a: Project, b: Project) => JSON.stringify({ ...sanitizeProject(a), id: '' }) === JSON.stringify({ ...sanitizeProject(b), id: '' });

export class Syncer {
  localId = '';
  id: string | null = null;
  revision = 0;
  dirty = false;
  private gen = 0;             // bumped when another local project is bound: results of older requests are ignored
  disabled = false;
  status: SyncStatus = 'saved';
  private latest: Project | null = null;
  private version = 0;         // bumped on every change; tells whether a save covered the latest edit
  private inflight = false;
  private again = false;
  private timer: unknown;
  private retryTimer: unknown;
  private attempt = 0;
  private readonly d: SyncDeps;
  private readonly debounce: number;
  private readonly retry: number[];
  private readonly setT: (fn: () => void, ms: number) => unknown;
  private readonly clearT: (h: unknown) => void;

  constructor(deps: SyncDeps) {
    this.d = deps;
    this.debounce = deps.debounceMs ?? 800;
    this.retry = deps.retryMs ?? [3000, 10000, 30000, 60000];
    this.setT = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearT = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  peek(localId: string): SyncMeta { return this.d.meta.load(localId); }

  /** Switch to another local project (open, switch, new). Loads what is remembered about its cloud copy. */
  bind(localId: string) {
    this.clearTimers(); this.gen++; this.inflight = false; this.again = false; this.attempt = 0; this.latest = null;
    this.localId = localId;
    const m = this.d.meta.load(localId);
    this.id = m.id; this.revision = m.revision; this.dirty = m.dirty;
    this.d.onId(this.id);
  }

  private set(s: SyncStatus) { this.status = s; this.d.onStatus(s); }
  private persist() { if (this.localId) this.d.meta.save(this.localId, { id: this.id, revision: this.revision, dirty: this.dirty }); }

  /** Browser-only mode (API missing). Remembers nothing about a cloud id. */
  disable() { this.disabled = true; this.clearTimers(); this.set('local'); }
  private clearTimers() { this.clearT(this.timer); this.clearT(this.retryTimer); this.timer = undefined; this.retryTimer = undefined; }

  /** The working project is now this cloud project at this revision (after load, or after a conflict). */
  attach(id: string, revision: number, dirty = false) {
    this.id = id; this.revision = revision; this.dirty = dirty; this.attempt = 0;
    this.persist(); this.d.onId(id); this.set(dirty ? 'saving' : 'saved');
  }
  /** The working project is a new, unsaved document (import of a copy, "new project"). */
  detach(project: Project | null = null) {
    this.clearTimers(); this.id = null; this.revision = 0; this.dirty = false; this.latest = project; this.persist(); this.d.onId(null);
  }

  /** Call after every edit with the full project. */
  change(p: Project) {
    if (this.disabled) return;
    this.latest = p; this.version++; this.dirty = true; this.persist();
    this.set('saving');
    this.clearT(this.timer); this.clearT(this.retryTimer);
    this.timer = this.setT(() => { void this.flush(); }, this.debounce);
  }

  /** Push the latest project now (open with unsynced edits, retry button, back online). */
  async flush(project?: Project): Promise<void> {
    if (this.disabled) return;
    if (project) this.latest = project;
    const p = this.latest;
    if (!p || (!this.dirty && this.id)) return;
    if (this.inflight) { this.again = true; return; }
    this.inflight = true; this.clearT(this.timer); this.clearT(this.retryTimer);
    const v = this.version;
    const gen = this.gen;
    this.set('saving');
    const res = this.id ? await this.d.api.put(this.id, p, this.revision) : await this.d.api.create(p);
    if (gen !== this.gen) return; // another project was opened meanwhile
    this.inflight = false;
    switch (res.kind) {
      case 'ok': {
        const val = res.value as { revision: number; id?: string };
        if (val.id) { this.id = val.id; this.d.onId(val.id); }
        this.revision = val.revision; this.attempt = 0;
        this.dirty = this.version !== v;
        this.persist();
        if (this.dirty || this.again) { this.again = false; await this.flush(); } else this.set('saved');
        return;
      }
      case 'conflict': {
        if (same(res.project, p)) { // our own earlier write (e.g. sent on page hide) already landed
          this.revision = res.revision; this.dirty = this.version !== v; this.persist();
          if (this.dirty) await this.flush(); else this.set('saved');
          return;
        }
        this.revision = res.revision; this.dirty = false; this.latest = res.project; this.persist();
        this.set('saved');
        this.d.onConflict(res.project, p);
        return;
      }
      case 'notfound': // deleted on the server: save again as a new project
        this.id = null; this.revision = 0; this.persist(); await this.flush(); return;
      case 'unavailable': this.disable(); return;
      case 'offline': this.set('offline'); this.scheduleRetry(); return;
      case 'error': this.set('error'); if (res.retry) this.scheduleRetry(); return;
    }
  }

  private scheduleRetry() {
    const ms = this.retry[Math.min(this.attempt++, this.retry.length - 1)]!;
    this.clearT(this.retryTimer);
    this.retryTimer = this.setT(() => { void this.flush(); }, ms);
  }

  /** Retry button / browser came back online. */
  async retryNow(): Promise<void> {
    if (this.disabled) return;
    if (this.dirty) { this.attempt = 0; await this.flush(); }
    else if (this.status === 'offline' || this.status === 'error') this.set('saved');
  }

  /** The server could not be reached when opening: keep working from the cache and retry in the background. */
  markOffline(isError = false) {
    this.set(isError ? 'error' : 'offline');
    if (this.dirty) this.scheduleRetry();
  }

  /** Fire-and-forget save for the moment the page is hidden or closed. */
  flushOnHide() {
    if (this.disabled || !this.dirty || !this.id || !this.latest || this.inflight) return;
    void this.d.api.put(this.id, this.latest, this.revision, true);
  }
}
