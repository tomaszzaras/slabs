import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ROOM_IDS, computeCut } from '@slabs/core';
import { FILE_VERSION, blankProject, newProject, roomDefaults, sanitizeProject, type Project } from './project';
import { buildRequest, roomModel } from '../cut/request';

const dir = new URL('../../../../fixtures/projects/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.slabs.json'));
const expected = JSON.parse(readFileSync(new URL('expected.json', dir), 'utf8')) as Record<string, {
  rooms: Array<{ name: string; on: boolean; PL: number; PW: number; n: number; hash: string }>; band: unknown; plates: number; utilisation: number; blocking: number;
}>;
const load = (f: string) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as Record<string, unknown>;
const signature = (p: Project) => {
  const req = buildRequest(p);
  const rooms = req.rooms.map((r) => ({ name: r.name, on: r.on, PL: r.PL, PW: r.PW, n: r.pieces.length, hash: createHash('sha1').update(JSON.stringify(r.pieces.map((q) => ({ ...q, room: undefined })))).digest('hex') }));
  const R = computeCut({ ...req, maxIters: 120 });
  return { rooms, band: req.band, plates: R.plates.length, utilisation: Math.round(R.stats.utilisation * 1e6) / 1e6, blocking: R.blocking.length };
};

describe('project file versions: every older file loads into the room list with the same results', () => {
  it('has a fixture for every kind of version-1 file, and an expected result for each', () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const f of files) expect(expected[f.replace('.slabs.json', '')], f).toBeDefined();
  });
  for (const f of files) {
    const key = f.replace('.slabs.json', '');
    describe(key, () => {
      const raw = load(f);
      it('is a version-1 file (four rooms under fixed keys) and loads as version ' + FILE_VERSION, () => {
        expect(raw.version).toBe(1);
        const p = sanitizeProject(raw)!;
        expect(p).not.toBeNull();
        expect(p.version).toBe(FILE_VERSION);
        expect(p.roomOrder).toEqual(ROOM_IDS);
        expect(ROOM_IDS.map((id) => p.rooms[id]!.type)).toEqual(ROOM_IDS);
      });
      it('same rooms, pieces, band and plates as before the room list existed', () => {
        expect(signature(sanitizeProject(raw)!)).toEqual(expected[key]);
      });
      it('saved again (version 2) it loads to the same project, and a second load changes nothing', () => {
        const p = sanitizeProject(raw)!;
        const again = sanitizeProject(JSON.parse(JSON.stringify(p)))!;
        expect(again).toEqual(p);
        expect(signature(again)).toEqual(expected[key]);
      });
    });
  }

  it('the house roof is taken from the first room under the roof; a room with another value overrides it', () => {
    const raw = load('v1-house-custom.slabs.json');
    const p = sanitizeProject(raw)!;
    expect(p.roof).toEqual({ W: 560, ang: 40, HL: 107 });
    expect(p.rooms.salon!.over).toBeUndefined();
    expect(p.rooms.sypialnia!.over).toEqual(['W']);
    expect(p.rooms.sypialnia!.params.W).toBe(548); // its own value is kept
    expect(p.rooms['lazienka-2']!.over).toBeUndefined();
  });

  it('names, switched-off rooms, openings and settings of a version-1 file survive', () => {
    const p = sanitizeProject(load('v1-house-custom.slabs.json'))!;
    expect(p.names.rooms.salon).toBe('Pokój dzienny');
    expect(p.names.surfaces.salon).toEqual({ '1': 'Dach' });
    expect(p.rooms['lazienka-1']!.on).toBe(false);
    expect(p.openings.sypialnia).toHaveLength(1);
    expect(p.settings.kerfMm).toBe(3);
    expect(p.bands[0]!.len).toBe(1200);
  });

  it('files from a newer or unknown version, and files that are not projects, are refused', () => {
    expect(sanitizeProject({ ...load('v1-default.slabs.json'), version: 3 })).toBeNull();
    expect(sanitizeProject({ ...load('v1-default.slabs.json'), version: undefined })).toBeNull();
    expect(sanitizeProject({ version: 2 })).toBeNull();
    expect(sanitizeProject(null)).toBeNull();
    expect(sanitizeProject('x')).toBeNull();
  });
});

describe('version 2 files: the room list', () => {
  const house = () => JSON.parse(JSON.stringify(newProject()));
  it('keeps the user order, several rooms of one type, and drops rooms with a bad type or id', () => {
    const f = house();
    f.rooms.r1 = { type: 'salon', on: true, params: roomDefaults('salon', { cA: 0, cB: 0, niche: 0 }) };
    f.rooms.r2 = { type: 'nonsense', on: true, params: {} };
    f.rooms['band-x'] = { type: 'salon', on: true, params: {} };
    f.roomOrder = ['r1', 'lazienka-2', 'r2', 'band-x', 'salon', 'salon', 'sypialnia', 'lazienka-1', 'ghost'];
    const p = sanitizeProject(f)!;
    expect(p.roomOrder).toEqual(['r1', 'lazienka-2', 'salon', 'sypialnia', 'lazienka-1']);
    expect(p.rooms.r1!.params.cA).toBe(0);
    expect(p.openings.r1).toEqual([]);
    expect(p.splits.r1).toEqual({});
  });
  it('rooms missing from the order are appended; an empty project is fine', () => {
    const f = house(); delete f.roomOrder;
    expect(sanitizeProject(f)!.roomOrder).toEqual(ROOM_IDS);
    const e = sanitizeProject(JSON.parse(JSON.stringify(blankProject('x'))))!;
    expect(e.roomOrder).toEqual([]);
    expect(e.bands).toEqual([]);
    expect(buildRequest(e).rooms).toEqual([]);
  });
  it('a room under the roof follows the house roof unless it overrides a field; stored values of followers are replaced', () => {
    const f = house();
    f.roof = { W: 600, ang: 35, HL: 90 };
    f.rooms.sypialnia.over = ['ang'];
    f.rooms.sypialnia.params.ang = 30;
    const p = sanitizeProject(f)!;
    expect(p.rooms.salon!.params).toMatchObject({ W: 600, ang: 35, HL: 90 });
    expect(p.rooms.sypialnia!.params).toMatchObject({ W: 600, ang: 30, HL: 90 });
    expect(roomModel(p, 'salon').p.W).toBe(600);
    expect(p.rooms['lazienka-2']!.params.bx).toBe(149); // a flat-ceiling room has no roof
    expect(p.rooms['lazienka-2']!.over).toBeUndefined();
  });
  it('limits the number of rooms', () => {
    const f = blankProject('x') as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    for (let i = 1; i <= 60; i++) { f.rooms['r' + i] = { type: 'lazienka-2', on: true, params: {} }; f.roomOrder.push('r' + i); }
    expect(sanitizeProject(f)!.roomOrder).toHaveLength(40);
  });
});
