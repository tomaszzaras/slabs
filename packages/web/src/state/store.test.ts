import { beforeEach, describe, expect, it } from 'vitest';
import { ROOMS } from '@slabs/core';
import { newProject } from './project';
import { useStore } from './store';

const st = () => useStore.getState();
const W = () => st().project.rooms.salon.params.W;

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
    expect(st().project.rooms.salon.params.L).toBe(ROOMS.salon.defaults.L);
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
    expect(st().project.rooms.sypialnia.params.L).toBe(400);
  });

  it('room reset only touches that room, and can be undone', () => {
    st().setParam('salon', 'W', 600);
    st().setParam('sypialnia', 'L', 400);
    st().resetRoom('salon');
    expect(W()).toBe(ROOMS.salon.defaults.W);
    expect(st().project.rooms.sypialnia.params.L).toBe(400);
    st().undo();
    expect(W()).toBe(600);
  });

  it('"Zeruj" (all start points of a room) is a single undo step', () => {
    st().setParams('salon', { o1: 5, o2: 10, o3: -5 });
    st().setParams('salon', { o1: 0, o2: 0, o3: 0, o4: 0, o5: 0, o6: 0, o7: 0, o8: 0, o9: 0 });
    st().undo();
    expect(st().project.rooms.salon.params).toMatchObject({ o1: 5, o2: 10, o3: -5 });
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
    st().setParam('salon', 'W', st().project.rooms.salon.params.W!);
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
