import { beforeEach, describe, expect, it } from 'vitest';
import { newProject, sanitizeProject, DEFAULT_BAND } from './project';
import { buildRequest, bandSpec } from '../cut/request';
import { OVERVIEW, bandTab, isRoomTab, tabBandId, useStore } from './store';

/** A project file as it was stored before the overview and the band item: band, price and split in `shared`, nothing in `bands`. */
function oldFile(shared: unknown = { band: { len: 900, h: 60, min: 50, max: 110, use: 0 }, price: 99, split: false }) {
  const f = JSON.parse(JSON.stringify(newProject())) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  delete f.bands;
  delete f.settings.platePrice;
  delete f.settings.splitAtBends;
  f.shared = shared;
  return f;
}

describe('migration: shared.band / price / split -> band item and project settings', () => {
  it('the band becomes the first band item, on, with the same measures', () => {
    const p = sanitizeProject(oldFile())!;
    expect(p.bands).toHaveLength(1);
    expect(p.bands[0]).toMatchObject({ on: true, len: 900, h: 60, min: 50, max: 110, use: 0 });
    expect(typeof p.bands[0]!.id).toBe('string');
    expect((p as unknown as Record<string, unknown>).shared).toBeUndefined();
  });
  it('price and split at bends move to the project settings', () => {
    const p = sanitizeProject(oldFile())!;
    expect(p.settings.platePrice).toBe(99);
    expect(p.settings.splitAtBends).toBe(false);
  });
  it('the cut request of the migrated project is what the old project asked for (calculations do not change)', () => {
    const req = buildRequest(sanitizeProject(oldFile())!);
    expect(req.band).toEqual({ len: 900, h: 60, min: 50, max: 110, use: 0 });
    expect(req.price).toBe(99);
    expect(req.splitAtBends).toBe(false);
  });
  it('a file without any shared block gets the default band and settings', () => {
    const f = oldFile(); delete f.shared;
    const p = sanitizeProject(f)!;
    expect(p.bands).toEqual([{ id: 'b1', ...DEFAULT_BAND }]);
    expect(p.settings.platePrice).toBe(147.6);
    expect(p.settings.splitAtBends).toBe(true);
  });
  it('a damaged old band is repaired, defaults fill the gaps', () => {
    const p = sanitizeProject(oldFile({ band: { len: 'x', use: 1 }, price: 'free' }))!;
    expect(p.bands[0]).toMatchObject({ len: 0, h: 65, min: 124, max: 124, use: 1, on: true });
    expect(p.settings.platePrice).toBe(147.6);
  });
  it('a new-format file round-trips: bands (with names and off), price and split', () => {
    const q = newProject();
    q.bands = [{ id: 'x1', name: 'Opaska dolna', on: false, len: 500, h: 30, min: 40, max: 80, use: 0 }];
    q.settings.platePrice = 120; q.settings.splitAtBends = false;
    const back = sanitizeProject(JSON.parse(JSON.stringify(q)))!;
    expect(back.bands).toEqual(q.bands);
    expect(back.settings.platePrice).toBe(120);
    expect(back.settings.splitAtBends).toBe(false);
  });
  it('a project without bands stays without (the band was removed), and the cut has no band', () => {
    const q = newProject(); q.bands = [];
    const back = sanitizeProject(JSON.parse(JSON.stringify(q)))!;
    expect(back.bands).toEqual([]);
    expect(buildRequest(back).band.len).toBe(0);
  });
  it('a band that is off, and a single room cut, leave the band out of the request', () => {
    const q = newProject();
    q.bands[0]!.on = false;
    expect(bandSpec(q).len).toBe(0);
    const r = newProject();
    expect(bandSpec(r).len).toBe(1648);
    expect(buildRequest(r, 'salon').band.len).toBe(0);
  });
  it('the default project asks for the same band, price and split as before', () => {
    const req = buildRequest(newProject());
    expect(req.band).toEqual({ len: 1648, h: 65, min: 124, max: 124, use: 1 });
    expect(req.price).toBe(147.6);
    expect(req.splitAtBends).toBe(true);
  });
});

describe('migration: per-room plate -> project plate', () => {
  it('rooms that held the plate size give the project plate; the settings carry price and split', () => {
    const f = oldFile();
    delete f.settings.plate;
    for (const id of Object.keys(f.rooms)) { f.rooms[id].params.PL = 300; f.rooms[id].params.PW = 120; }
    const p = sanitizeProject(f)!;
    expect(p.settings.plate).toEqual({ L: 300, W: 120, tongue: 0, profile: 'none' });
    expect(buildRequest(p).plate).toEqual(p.settings.plate);
  });
});

describe('navigation: overview first, rooms, band', () => {
  const st = () => useStore.getState();
  beforeEach(() => { useStore.setState({ project: newProject(), past: [], future: [], toast: null, loaded: true, tab: OVERVIEW }); });
  it('the overview is the default page and is not a room or a band', () => {
    expect(OVERVIEW).toBe('przeglad');
    expect(isRoomTab(OVERVIEW)).toBe(false);
    expect(tabBandId(OVERVIEW)).toBeNull();
    expect(isRoomTab('salon')).toBe(true);
    expect(isRoomTab(bandTab('b1'))).toBe(false);
    expect(tabBandId(bandTab('b1'))).toBe('b1');
  });
  it('a band can be switched, renamed and removed (undoable); removing returns to the overview', () => {
    const id = st().project.bands[0]!.id;
    st().setTab(bandTab(id));
    st().setBand(id, { len: 800 });
    expect(st().project.bands[0]!.len).toBe(800);
    st().renameBand(id, '  Opaska górna ');
    expect(st().project.bands[0]!.name).toBe('Opaska górna');
    st().renameBand(id, '');
    expect(st().project.bands[0]!.name).toBeUndefined();
    st().removeBand(id);
    expect(st().project.bands).toHaveLength(0);
    expect(st().tab).toBe(OVERVIEW);
    st().undo();
    expect(st().project.bands).toHaveLength(1);
  });
  it('one band for now: adding a second is refused, adding after removal opens the new band', () => {
    expect(st().addBand()).toBeNull();
    const id = st().project.bands[0]!.id;
    st().removeBand(id);
    const added = st().addBand();
    expect(added).not.toBeNull();
    expect(st().tab).toBe(bandTab(added!));
    expect(st().project.bands).toHaveLength(1);
  });
  it('plate price and split at bends are project settings with undo', () => {
    st().setSettings({ platePrice: 130 });
    st().setSettings({ splitAtBends: false });
    expect(st().project.settings).toMatchObject({ platePrice: 130, splitAtBends: false });
  });
});
