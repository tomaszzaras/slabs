// Test helper: a project as a version-1 file looked (four rooms under fixed keys, no list, no house roof). Used to build the old files
// the migration tests feed to `sanitizeProject`.
import type { Project } from './project';

type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function asV1(p: Project): Obj {
  const f = JSON.parse(JSON.stringify(p)) as Obj;
  f.version = 1;
  delete f.roof;
  delete f.roomOrder;
  for (const k of Object.keys(f.rooms)) { delete f.rooms[k].type; delete f.rooms[k].tpl; delete f.rooms[k].over; }
  return f;
}
