import { beforeEach, describe, expect, it } from 'vitest';
import { ROOMS } from '@slabs/core';
import { newProject, roomEngine } from './project';
import { asV1 } from './legacyFile';
import { useStore } from './store';

const st = () => useStore.getState();
const eng = (id: string) => roomEngine(st().project, id).params;
const W = () => eng('salon').W;

beforeEach(() => {
  useStore.setState({ project: newProject(), past: [], future: [], toast: null, loaded: true });
});

describe('undo / redo', () => {
  it('undoes and redoes a dimension change, back to the exact previous project', () => {
    const before = st().project;
    st().setParam('salon', 'W', 600);
    expect(W()).toBe(600);
    st().undo();
    expect(st().project).toBe(before);
    expect(st().future).toHaveLength(1);
    st().redo();
    expect(W()).toBe(600);
  });

  it('typing in one field is one undo step, a different field is another', () => {
    st().setParam('salon', 'W', 5);
    st().setParam('salon', 'W', 56);
    st().setParam('salon', 'W', 560);
    st().setParam('salon', 'L', 900);
    expect(st().past).toHaveLength(2);
    st().undo();
    expect(eng('salon').L).toBe(ROOMS.salon.defaults.L);
    expect(W()).toBe(560);
    st().undo();
    expect(W()).toBe(ROOMS.salon.defaults.W);
  });

  it('a new change after an undo clears the redo steps', () => {
    st().setParam('salon', 'W', 600);
    st().undo();
    st().setParam('salon', 'L', 700);
    expect(st().future).toHaveLength(0);
  });

  it('"Przywróć wymiary domyślne" is undoable and shows an undo toast', () => {
    st().setParam('salon', 'W', 600);
    st().setParam('sypialnia', 'L', 400);
    st().resetAll();
    expect(W()).toBe(ROOMS.salon.defaults.W);
    expect(st().toast?.undo).toBe(true);
    st().undo();
    expect(W()).toBe(600);
    expect(eng('sypialnia').L).toBe(400);
  });

  it('room reset only touches that room, and can be undone', () => {
    st().setParam('salon', 'W', 600);
    st().setParam('sypialnia', 'L', 400);
    st().resetRoom('salon');
    expect(W()).toBe(ROOMS.salon.defaults.W);
    expect(eng('sypialnia').L).toBe(400);
    st().undo();
    expect(W()).toBe(600);
  });

  it('"Zeruj" (all start points of a room) is a single undo step', () => {
    st().setParams('salon', { o1: 5, o2: 10, o3: -5 });
    st().setParams('salon', { o1: 0, o2: 0, o3: 0, o4: 0, o5: 0, o6: 0, o7: 0, o8: 0, o9: 0 });
    st().undo();
    expect(eng('salon')).toMatchObject({ o1: 5, o2: 10, o3: -5 });
  });

  it('undo with nothing to undo does nothing', () => {
    const p = st().project;
    st().undo();
    st().redo();
    expect(st().project).toBe(p);
  });
});

describe('empty and invalid input', () => {
  it('setting the value a field already has adds no undo step', () => {
    st().setParam('salon', 'W', eng('salon').W!);
    expect(st().past).toHaveLength(0);
  });
  it('emptying a field flags it missing without touching the project or the undo history', () => {
    const before = st().project;
    st().setEmpty('salon.W', true);
    expect(st().empty).toEqual(['salon.W']);
    expect(st().project).toBe(before);
    expect(st().past).toHaveLength(0);
    st().setEmpty('salon.W', false);
    expect(st().empty).toEqual([]);
  });
  it('undo and project switches clear the missing flags', () => {
    st().setParam('salon', 'W', 600);
    st().setEmpty('salon.L', true);
    st().undo();
    expect(st().empty).toEqual([]);
  });
});

describe('openings', () => {
  it('the salon starts with its window as an opening; add, move, remove are undoable', () => {
    expect(st().project.openings.salon).toHaveLength(1);
    st().addOpening('salon', { id: 't1', kind: 'door', surface: 6, pts: [[0, 0], [90, 0], [90, 200], [0, 200]] });
    expect(st().project.openings.salon).toHaveLength(2);
    st().setOpening('salon', 't1', [[10, 0], [100, 0], [100, 200], [10, 200]]);
    st().removeOpening('salon', 't1');
    expect(st().project.openings.salon).toHaveLength(1);
    st().undo();
    expect(st().project.openings.salon).toHaveLength(2);
  });
  it('quick drags of one opening are one undo step', () => {
    st().addOpening('salon', { id: 't2', kind: 'window', surface: 6, pts: [[0, 0], [90, 0], [90, 100], [0, 100]] });
    const before = st().past.length;
    for (let i = 1; i < 6; i++) st().setOpening('salon', 't2', [[i, 0], [90 + i, 0], [90 + i, 100], [i, 100]]);
    expect(st().past.length).toBe(before + 1);
  });
  it('an opening cut into a room changes its pieces and net area, nothing else', async () => {
    const { roomModel, buildRequest } = await import('../cut/request');
    const p0 = st().project;
    const a0 = roomModel(p0, 'salon').areaCm2;
    st().addOpening('salon', { id: 't3', kind: 'cutout', surface: 1, pts: [[100, 450], [140, 450], [140, 480], [100, 480]] }); // on the roof sheet: u from the ridge (right slope), z
    const p1 = st().project;
    expect(a0 - roomModel(p1, 'salon').areaCm2).toBeCloseTo(1200, 3);
    expect(buildRequest(p0)).not.toEqual(buildRequest(p1));
  });
  it('an old project file without openings gets the salon window it used to have', async () => {
    const { sanitizeProject } = await import('./project');
    const raw = asV1(st().project);
    delete raw.openings;
    expect(sanitizeProject(raw)!.openings.salon).toHaveLength(1);
    raw.rooms.salon.params.winOn = 0;
    expect(sanitizeProject(raw)!.openings.salon).toHaveLength(0);
  });
});
