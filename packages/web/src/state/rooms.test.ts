import { beforeEach, describe, expect, it } from 'vitest';
import { ROOMS, ROOM_IDS } from '@slabs/core';
import { blankProject, newProject, roomHasData, sanitizeProject } from './project';
import { buildRequest, roomModel } from '../cut/request';
import { OVERVIEW, useStore } from './store';
import { setLang } from '../i18n';

const st = () => useStore.getState();
const reset = (p = blankProject('x')) => useStore.setState({ project: p, past: [], future: [], toast: null, loaded: true, tab: OVERVIEW, cuts: {}, selected: {}, empty: [] });
beforeEach(() => { setLang('pl'); reset(); });

describe('a project holds any number of rooms', () => {
  it('a new project is empty: no rooms, no band, no request rooms', () => {
    expect(st().project.roomOrder).toEqual([]);
    expect(buildRequest(st().project).rooms).toEqual([]);
  });
  it('adds rooms from templates, in order, each with an id of its own; the same template can be used twice', () => {
    const a = st().addRoom('under-roof', 'Poddasze')!, b = st().addRoom('under-roof', 'Poddasze 2')!, c = st().addRoom('sloped', 'Sypialnia', 'right')!, d = st().addRoom('flat', '')!;
    expect(new Set([a, b, c, d]).size).toBe(4);
    expect(st().project.roomOrder).toEqual([a, b, c, d]);
    expect(st().project.rooms[a]).toMatchObject({ type: 'salon', tpl: 'under-roof', on: true });
    expect(st().project.rooms[c]!.type).toBe('lazienka-1'); // "from the right wall"
    expect(st().project.rooms[d]!.type).toBe('lazienka-2');
    expect(st().project.names.rooms[a]).toBe('Poddasze');
    expect(st().project.names.rooms[d]).toBeUndefined(); // empty name = the generic one
    expect(st().tab).toBe(d);
    // the cut request has a room per instance, keyed by its id
    expect(buildRequest(st().project).rooms.map((r) => r.key)).toEqual([a, b, c, d]);
  });
  it('"pod dachem" is the salon model without notches: a plain rectangle under the roof', () => {
    const id = st().addRoom('under-roof', 'Strych')!;
    const r = st().project.rooms[id]!;
    expect(r.params).toMatchObject({ cA: 0, cB: 0, niche: 0, cutOn: 0, winOn: 0, W: 548, ang: 40, HL: 107 });
    const m = roomModel(st().project, id) as import('@slabs/core').AtticModel;
    expect(m.walls.map((w) => w.z)).toEqual([0, m.L]); // front and rear gable only
    expect(m.warn).toEqual([]);
    expect(st().project.openings[id]).toEqual([]);
    expect(buildRequest(st().project).rooms[0]!.pieces.length).toBeGreaterThan(5);
  });
  it('the salon of the house keeps its notches (parity), the template changes only its own room', () => {
    reset(newProject());
    const before = buildRequest(st().project).rooms[0]!.pieces;
    st().addRoom('under-roof', 'Nowy');
    expect(buildRequest(st().project).rooms[0]!.pieces).toEqual(before);
  });
  it('the band template is the band item, one for now', () => {
    expect(st().addBand()).toBeTruthy();
    expect(st().project.bands).toHaveLength(1);
    expect(st().addBand()).toBeNull();
  });
  it('adding is one undo step', () => {
    st().addRoom('flat', 'Łazienka');
    expect(st().project.roomOrder).toHaveLength(1);
    st().undo();
    expect(st().project.roomOrder).toEqual([]);
    expect(Object.keys(st().project.rooms)).toEqual([]);
    st().redo();
    expect(st().project.roomOrder).toHaveLength(1);
  });
});

describe('room menu actions', () => {
  it('renames (empty name = generic), duplicates next to the original, moves left and right', () => {
    const a = st().addRoom('flat', 'A')!, b = st().addRoom('flat', 'B')!, c = st().addRoom('flat', 'C')!;
    st().setParam(a, 'bx', 222);
    const copy = st().duplicateRoom(a)!;
    expect(st().project.roomOrder).toEqual([a, copy, b, c]);
    expect(st().project.rooms[copy]!.params.bx).toBe(222);
    expect(st().project.names.rooms[copy]).toBe('A (kopia)');
    st().setParam(copy, 'bx', 111); // independent of the original
    expect(st().project.rooms[a]!.params.bx).toBe(222);
    st().moveRoom(c, -1);
    expect(st().project.roomOrder).toEqual([a, copy, c, b]);
    st().moveRoom(a, -1); // already first
    expect(st().project.roomOrder[0]).toBe(a);
    st().moveRoom(a, 1);
    expect(st().project.roomOrder).toEqual([copy, a, c, b]);
    st().renameRoom(a, '  Gabinet ');
    expect(st().project.names.rooms[a]).toBe('Gabinet');
    st().renameRoom(a, '');
    expect(st().project.names.rooms[a]).toBeUndefined();
  });
  it('switching a room off keeps it in the list but out of the calculation', () => {
    const a = st().addRoom('flat', 'A')!;
    st().setRoomOn(a, false);
    expect(st().project.roomOrder).toEqual([a]);
    expect(buildRequest(st().project).rooms[0]!.on).toBe(false);
  });
  it('removing shows an undo toast; undo brings back the room with its data, names and place', () => {
    const a = st().addRoom('flat', 'A')!, b = st().addRoom('sloped', 'B', 'left')!, c = st().addRoom('flat', 'C')!;
    st().setParam(b, 'L', 999);
    st().renameSurface(b, 1, 'Dach B');
    st().removeRoom(b);
    expect(st().project.roomOrder).toEqual([a, c]);
    expect(st().project.rooms[b]).toBeUndefined();
    expect(st().project.openings[b]).toBeUndefined();
    expect(st().project.names.surfaces[b]).toBeUndefined();
    expect(st().toast).toMatchObject({ undo: true });
    st().undo();
    expect(st().project.roomOrder).toEqual([a, b, c]);
    expect(st().project.rooms[b]!.params.L).toBe(999);
    expect(st().project.names.surfaces[b]).toEqual({ '1': 'Dach B' });
  });
  it('removing the open room opens its neighbour; removing the last room leaves an empty project', () => {
    const a = st().addRoom('flat', 'A')!, b = st().addRoom('flat', 'B')!;
    expect(st().tab).toBe(b);
    st().removeRoom(b);
    expect(st().tab).toBe(a);
    st().removeRoom(a);
    expect(st().tab).toBe(OVERVIEW);
    expect(st().project.roomOrder).toEqual([]);
  });
  it('asks before deleting only when the room holds data the user entered', () => {
    const a = st().addRoom('sloped', 'A', 'left')!;
    expect(roomHasData(st().project, a)).toBe(false);
    st().setParam(a, 'L', 301);
    expect(roomHasData(st().project, a)).toBe(true);
    st().setParam(a, 'L', ROOMS.sypialnia.defaults.L!);
    expect(roomHasData(st().project, a)).toBe(false);
    st().renameSurface(a, 1, 'x');
    expect(roomHasData(st().project, a)).toBe(true);
    reset(newProject());
    expect(ROOM_IDS.some((id) => roomHasData(st().project, id))).toBe(false); // the house untouched: its default window is not "entered"
    st().removeOpening('salon', 'window');
    expect(roomHasData(st().project, 'salon')).toBe(true);
  });
  it('a room that was removed is not shown any more (the open page falls back to the overview)', () => {
    const a = st().addRoom('flat', 'A')!;
    st().removeRoom(a);
    st().setTab(a);
    expect(st().project.rooms[a]).toBeUndefined();
  });
});

describe('Dach domu: the project roof and the rooms under it', () => {
  it('rooms under the roof take the project roof; changing it changes their pieces', () => {
    const a = st().addRoom('under-roof', 'A')!, b = st().addRoom('sloped', 'B', 'left')!, f = st().addRoom('flat', 'F')!;
    const before = buildRequest(st().project).rooms[0]!.pieces;
    st().setRoof({ W: 600, ang: 35, HL: 90 });
    expect(st().project.roof).toEqual({ W: 600, ang: 35, HL: 90 });
    for (const id of [a, b]) expect(st().project.rooms[id]!.params).toMatchObject({ W: 600, ang: 35, HL: 90 });
    expect(st().project.rooms[f]!.params.W).toBeUndefined();
    expect(buildRequest(st().project).rooms[0]!.pieces).not.toEqual(before);
    expect(roomModel(st().project, b).p.W).toBe(600);
  });
  it('a room overrides single values; its own value stays when the project roof changes; reset follows the project again', () => {
    const a = st().addRoom('under-roof', 'A')!, b = st().addRoom('under-roof', 'B')!;
    st().setParam(b, 'ang', 30);
    expect(st().project.rooms[b]!.over).toEqual(['ang']);
    expect(st().project.rooms[a]!.over).toBeUndefined();
    st().setRoof({ ang: 45, W: 500 });
    expect(st().project.rooms[a]!.params).toMatchObject({ ang: 45, W: 500 });
    expect(st().project.rooms[b]!.params).toMatchObject({ ang: 30, W: 500 });
    st().resetRoomRoof(b, 'ang');
    expect(st().project.rooms[b]!.over).toBeUndefined();
    expect(st().project.rooms[b]!.params.ang).toBe(45);
  });
  it('typing the project value in a room is not an override; setting the project roof to a room\'s own value ends it', () => {
    const a = st().addRoom('sloped', 'A', 'left')!;
    st().setParam(a, 'HL', 120);
    expect(st().project.rooms[a]!.over).toEqual(['HL']);
    st().setParam(a, 'HL', st().project.roof.HL);
    expect(st().project.rooms[a]!.over).toBeUndefined();
    st().setParam(a, 'HL', 120);
    st().setRoof({ HL: 120 });
    expect(st().project.rooms[a]!.over).toBeUndefined();
  });
  it('overrides and the roof survive saving and loading; undo restores them', () => {
    const a = st().addRoom('under-roof', 'A')!;
    st().setParam(a, 'W', 700);
    st().setRoof({ ang: 33 });
    const back = sanitizeProject(JSON.parse(JSON.stringify(st().project)))!;
    expect(back).toEqual(st().project);
    st().undo();
    expect(st().project.roof.ang).toBe(40);
    expect(st().project.rooms[a]!.over).toEqual(['W']);
  });
  it('the roof is limited to what the models accept', () => {
    st().setRoof({ W: 5, ang: 200, HL: -4 });
    expect(st().project.roof).toEqual({ W: 200, ang: 70, HL: 0 });
  });
  it('resetting a room (or all) brings back its template values, the project roof, and clears overrides', () => {
    const a = st().addRoom('under-roof', 'A')!;
    st().setParam(a, 'W', 700); st().setParam(a, 'L', 123);
    st().resetRoom(a);
    expect(st().project.rooms[a]!.params).toMatchObject({ W: 548, L: 400, cA: 0, cB: 0 });
    expect(st().project.rooms[a]!.over).toBeUndefined();
    expect(st().project.rooms[a]!.tpl).toBe('under-roof');
  });
});
