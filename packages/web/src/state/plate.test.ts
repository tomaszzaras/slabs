import { describe, expect, it } from 'vitest';
import { DEFAULT_PLATE, ARTIFACT_PLATE, computeCut } from '@slabs/core';
import { ARTIFACT_SETTINGS, newProject, sanitizeProject } from './project';
import { buildRequest, roomInput } from '../cut/request';

describe('plate model in the project', () => {
  it('a new project uses the 500 x 125 plate with a 1 cm tongue on all edges; rooms are planned at 499 x 124', () => {
    const p = newProject();
    expect(p.settings.plate).toEqual(DEFAULT_PLATE);
    expect(roomInput(p, 'salon')).toMatchObject({ PL: 499, PW: 124, pf: 2, trim: 0, trimL: 0 });
    const req = buildRequest(p);
    expect(req.plate).toEqual(DEFAULT_PLATE);
    expect(req.rooms.every((r) => r.PL === 499 && r.PW === 124)).toBe(true);
  });
  it('an old project (rooms 499 x 125, no plate) migrates to 500 x 125 with tongue and groove', () => {
    const old = JSON.parse(JSON.stringify(newProject()));
    delete old.settings.plate;
    const p = sanitizeProject(old)!;
    expect(p.settings.plate).toEqual(DEFAULT_PLATE);
  });
  it('an old project with another plate size keeps it as a plain plate', () => {
    const old = JSON.parse(JSON.stringify(newProject()));
    delete old.settings.plate;
    for (const id of Object.keys(old.rooms)) { old.rooms[id].params.PL = 300; old.rooms[id].params.PW = 120; }
    expect(sanitizeProject(old)!.settings.plate).toEqual({ L: 300, W: 120, tongue: 0, profile: 'none' });
  });
  it('plate settings are kept through a file round trip and bad values are repaired', () => {
    const q = newProject();
    q.settings.plate = { L: 480, W: 120, tongue: 1.5, profile: 'long' };
    expect(sanitizeProject(JSON.parse(JSON.stringify(q)))!.settings.plate).toEqual(q.settings.plate);
    const bad = JSON.parse(JSON.stringify(q));
    bad.settings.plate = { L: 'x', W: -5, tongue: 99, profile: 'weird' };
    const r = sanitizeProject(bad)!.settings.plate;
    expect(r).toEqual({ L: 500, W: 20, tongue: 5, profile: 'all' });
  });
  it('"as in the original" settings give the artifact result: 35 plates, plain 499 x 125', () => {
    const p = newProject();
    p.settings = structuredClone(ARTIFACT_SETTINGS);
    expect(p.settings.plate).toEqual(ARTIFACT_PLATE);
    const req = { ...buildRequest(p), maxIters: 2000 };
    const r = computeCut(req);
    expect(r.tongue).toBeUndefined();
    expect(r.PL).toBe(499);
    expect(r.plates.length).toBe(35);
  });
  it('the default project with tongue and groove cuts without dropping any tongue, and shows the plain-plate comparison', () => {
    const p = newProject();
    const t = computeCut({ ...buildRequest(p), maxIters: 200 }), plain = computeCut({ ...buildRequest(p, undefined, true), maxIters: 200 });
    expect(t.tongue).toBeDefined();
    expect(t.tgDropped).toBe(0);
    expect(plain.tongue).toBeUndefined();
    expect(t.plates.length).toBeGreaterThanOrEqual(plain.plates.length - 3);
  });
});
