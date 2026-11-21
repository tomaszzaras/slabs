import { beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'slabs-view-v1';
function fakeStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } });
  return m;
}
const fresh = async () => { vi.resetModules(); return (await import('./view')).useView; };

describe('view choice (2D | 3D) is remembered', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  it('starts in 2D with every option on', async () => {
    fakeStorage();
    const v = (await fresh()).getState();
    expect([v.mode, v.roof, v.grid, v.numbers, v.refs]).toEqual(['2d', true, true, true, true]);
  });
  it('saves the choice and the options and restores them on the next load', async () => {
    const store = fakeStorage();
    const use = await fresh();
    use.getState().setMode('3d');
    use.getState().toggle('roof');
    expect(JSON.parse(store.get(KEY)!)).toMatchObject({ mode: '3d', roof: false, grid: true });
    const again = (await fresh()).getState();
    expect([again.mode, again.roof]).toEqual(['3d', false]);
    again.setMode('2d');
    expect(JSON.parse(store.get(KEY)!).mode).toBe('2d');
  });
  it('ignores junk in storage and works when storage throws', async () => {
    fakeStorage({ [KEY]: '{"mode":"4d","roof":"yes"}' });
    expect((await fresh()).getState()).toMatchObject({ mode: '2d', roof: true });
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    const use = await fresh();
    use.getState().setMode('3d');
    expect(use.getState().mode).toBe('3d');
  });
});
