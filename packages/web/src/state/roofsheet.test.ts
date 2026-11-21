import { beforeEach, describe, expect, it } from 'vitest';
import { ROOMS, setStripSplit, type AtticModel } from '@slabs/core';
import { buildRequest, roomInput, roomModel } from '../cut/request';
import { newProject, sanitizeProject } from './project';
import { useStore } from './store';

const st = () => useStore.getState();
beforeEach(() => { useStore.setState({ project: newProject(), past: [], future: [], toast: null, loaded: true }); });

describe('roof sheet in the project', () => {
  it('a new project has an empty split set per room, and it survives a file round trip', () => {
    const p = newProject();
    expect(Object.keys(p.splits).sort()).toEqual(Object.keys(ROOMS).sort());
    const sp = setStripSplit({}, 2, 'ridge', false, true);
    const back = sanitizeProject(JSON.parse(JSON.stringify({ ...p, splits: { ...p.splits, sypialnia: sp } })))!;
    expect(back.splits.sypialnia).toEqual(sp);
    expect(back.migration).toBeUndefined();
  });

  it('splits are undoable, quick cross-cut moves are one undo step', () => {
    const before = st().project;
    st().setSplits('salon', setStripSplit({}, 1, 'eaveL', false, true));
    expect(st().project.splits.salon.strips?.['1']?.s?.eaveL).toBe(false);
    st().undo();
    expect(st().project).toBe(before);
    st().setSplits('sypialnia', { strips: { '0': { c: [-100] } } }, 'cut.0');
    const n = st().past.length;
    st().setSplits('sypialnia', { strips: { '0': { c: [-99] } } }, 'cut.0');
    st().setSplits('sypialnia', { strips: { '0': { c: [-98] } } }, 'cut.0');
    expect(st().past.length).toBe(n);
  });

  it('the model and the cut request use the sheet: a split changes the pieces', () => {
    const p0 = st().project;
    const m = roomModel(p0, 'salon') as AtticModel;
    expect(m.sheet).toBeDefined();
    expect(m.refs.map((r) => r.id)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5']);
    const k = m.sheet!.strips[1]!.k;
    st().setSplits('salon', setStripSplit({}, k, 'eaveR', false, true));
    const a = buildRequest(p0).rooms.find((r) => r.key === 'S')!.pieces.length;
    const b = buildRequest(st().project).rooms.find((r) => r.key === 'S')!.pieces.length;
    expect(b).toBeLessThan(a);
  });

  it('start offsets of the legacy segments follow the roof sheet start (o1)', () => {
    const p = newProject();
    p.rooms.salon.params.o1 = 25; p.rooms.salon.params.o3 = 90;
    const r = roomInput(p, 'salon');
    expect([r.o2, r.o3, r.o4, r.o5]).toEqual([25, 25, 25, 25]);
    expect((roomModel(p, 'salon') as AtticModel).sheet!.anchor).toBe(415 + 25);
  });
});

describe('older projects move to the roof sheet', () => {
  const old = () => {
    const p = JSON.parse(JSON.stringify(newProject()));
    delete p.splits;
    return p;
  };
  it('keeps o1, drops the other roof offsets and lists them once; names of old roof parts are dropped', () => {
    const p = old();
    p.rooms.salon.params = { ...p.rooms.salon.params, o1: 12, o2: 5, o3: -30, o4: 0, o5: 8, o6: 7 };
    p.names = { rooms: {}, surfaces: { salon: { '1': 'Lewa', '3': 'Prawa', '6': 'Front' } }, features: {} };
    const q = sanitizeProject(p)!;
    expect(q.rooms.salon.params.o1).toBe(12);
    expect([2, 3, 4, 5].map((i) => q.rooms.salon.params['o' + i])).toEqual([0, 0, 0, 0]);
    expect(q.rooms.salon.params.o6).toBe(7);
    expect(q.migration!.dropped.map((d) => d.cm)).toEqual([5, -30, 8]);
    expect(q.migration!.dropped.every((d) => d.room === 'salon')).toBe(true);
    expect(q.migration!.renamed).toBe(2);
    expect(q.names.surfaces.salon).toEqual({ '6': 'Front' });
    // once sanitised again the note stays until dismissed, and nothing is dropped twice
    expect(sanitizeProject(JSON.parse(JSON.stringify(q)))!.migration).toEqual(q.migration);
  });
  it('a project without extra offsets gets no note', () => {
    expect(sanitizeProject(old())!.migration).toBeUndefined();
  });
  it('openings on the old roof segments move onto the sheet (left slope mirrored, right slope as it is)', () => {
    const p = old();
    p.openings.salon = [
      { id: 'a', kind: 'cutout', surface: 1, pts: [[10, 5], [30, 5], [30, 20], [10, 20]] },
      { id: 'b', kind: 'cutout', surface: 3, pts: [[10, 450], [30, 450], [30, 470], [10, 470]] },
      { id: 'w', kind: 'window', surface: 6, pts: [[0, 0], [50, 0], [50, 50], [0, 50]] },
    ];
    const q = sanitizeProject(p)!;
    const o = q.openings.salon;
    expect(o.map((x) => x.surface)).toEqual([1, 1, 6]);
    expect(o[0]!.pts[0]).toEqual([-10, 5]);
    expect(o[1]!.pts[0]).toEqual([10, 450]);
    expect(o[2]!.pts[0]).toEqual([0, 0]);
  });
  it('the migrated project has the same joints as before when no offsets differed', () => {
    const p = old();
    const q = sanitizeProject(p)!;
    const m = roomModel(q, 'salon') as AtticModel;
    const legacyZs = new Set<number>();
    m.surfs.forEach((s) => s.cols.forEach((c) => { legacyZs.add(Math.round(c.a * 1e3)); legacyZs.add(Math.round(c.b * 1e3)); }));
    m.sheet!.strips.forEach((s) => { expect(legacyZs.has(Math.round(s.a * 1e3))).toBe(true); expect(legacyZs.has(Math.round(s.b * 1e3))).toBe(true); });
  });
  it('dismissing the note is an edit that can be undone', () => {
    const p = old();
    p.rooms.salon.params.o2 = 9;
    useStore.setState({ project: sanitizeProject(p)! });
    expect(st().project.migration).toBeDefined();
    st().dismissMigration();
    expect(st().project.migration).toBeUndefined();
    st().undo();
    expect(st().project.migration).toBeDefined();
  });
});
