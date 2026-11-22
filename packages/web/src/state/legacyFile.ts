// Test helper: a project as an older file looked. Version 2 had a `type` and per-type `params` (and `over` for the roof fields) in every room;
// version 1 had four rooms under fixed keys and no list or house roof. Used to build the old files the migration tests feed to `sanitizeProject`.
import { typeOf } from '@slabs/core';
import { roofOverrides, roomEngine, type Project } from './project';

type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function asV2(p: Project): Obj {
  const f = JSON.parse(JSON.stringify(p)) as Obj;
  f.version = 2;
  for (const id of p.roomOrder) {
    const r = p.rooms[id]!;
    const own = roofOverrides(r);
    f.rooms[id] = { type: typeOf(r.spec), on: r.on, ...(r.tpl ? { tpl: r.tpl === 'bath' ? 'flat' : r.tpl } : {}), params: roomEngine(p, id).params, ...(own.length ? { over: own } : {}) };
  }
  return f;
}

export function asV1(p: Project): Obj {
  const f = asV2(p);
  f.version = 1;
  delete f.roof;
  delete f.roomOrder;
  for (const k of Object.keys(f.rooms)) { delete f.rooms[k].type; delete f.rooms[k].tpl; delete f.rooms[k].over; }
  return f;
}
