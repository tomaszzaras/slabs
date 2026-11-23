import { ROOM_IDS, type AtticModel } from '@slabs/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { exampleProject, newProject, sanitizeProject } from './project';
import { asV1 } from './legacyFile';
import { emptyNames, houseNames, roomPrefixes, sanitizeNames } from './names';
import { genericRoomName, roomName, roomPrefix, setLang, setNames, surfaceNameOf } from '../i18n';
import { genericSurfaceName, roomModel } from '../cut/request';
import { useStore } from './store';
import { pl } from '../i18n/pl';
import { en } from '../i18n/en';

const st = () => useStore.getState();
beforeEach(() => { setLang('pl'); useStore.setState({ project: newProject(), past: [], future: [], toast: null, loaded: true }); });

describe('names: generic fallback and custom names', () => {
  it('a new project is generic: Pomieszczenie 1..4, prefixes P1..P4', () => {
    setNames(newProject().names, ROOM_IDS);
    expect(roomName('salon')).toBe('Pomieszczenie 1');
    expect(roomName('lazienka-2')).toBe('Pomieszczenie 4');
    expect(roomPrefix('salon')).toBe('P1');
    expect(roomPrefix('lazienka-2')).toBe('P4');
  });
  it('the example project keeps the owner\'s names and the old piece prefixes S, Sy, Ł1, Ł2', () => {
    const p = exampleProject('Przykład: dom z poddaszem');
    setNames(p.names, p.roomOrder);
    expect(roomName('salon')).toBe('Salon');
    expect(roomName('lazienka-1')).toBe('Łazienka 1');
    expect(ROOM_IDS.map(roomPrefix)).toEqual(['S', 'Sy', 'Ł1', 'Ł2']);
  });
  it('an older project without names is the owner\'s house; a project with empty names stays generic', () => {
    const old = asV1(newProject());
    delete old.names;
    expect(sanitizeProject(old)!.names).toEqual(houseNames());
    expect(sanitizeProject(JSON.parse(JSON.stringify(newProject())))!.names).toEqual(emptyNames());
  });
  it('renaming a room, a surface, a feature and an opening is stored in the project; an empty name restores the generic one', () => {
    st().renameRoom('salon', '  Pokój dzienny ');
    expect(st().project.names.rooms.salon).toBe('Pokój dzienny');
    expect(roomName('salon')).toBe('Pokój dzienny');
    st().renameSurface('salon', 1, 'Dach od ulicy');
    expect(surfaceNameOf('salon', 1, 'x')).toBe('Dach od ulicy');
    expect(roomModel(st().project, 'salon').surfs.find((q) => q.key === 1)!.label).toBe('Dach od ulicy');
    expect(genericSurfaceName(st().project, 'salon', 1)).toBe('Dach');
    st().renameFeature('salon', 'recess', 'Skrzynka');
    const m = roomModel(st().project, 'salon');
    expect(m.surfs.find((q) => q.key === 2)!.label).toBe('Połać prawa (Skrzynka)');
    const o = st().project.openings.salon[0]!;
    st().renameOpening('salon', o.id, 'Okno tarasowe');
    expect(st().project.openings.salon[0]!.name).toBe('Okno tarasowe');
    expect(sanitizeProject(JSON.parse(JSON.stringify(st().project)))!.openings.salon[0]!.name).toBe('Okno tarasowe');
    st().renameRoom('salon', '');
    expect(roomName('salon')).toBe(genericRoomName('salon'));
    st().undo();
    expect(roomName('salon')).toBe('Pokój dzienny');
  });
  it('generic names by position, the refs table uses them too', () => {
    const m = roomModel(newProject(), 'salon') as AtticModel;
    // the roof is one sheet, "Dach"; the per-segment surfaces under it keep their position names
    expect(m.surfs.map((q) => q.label)).toEqual(['Dach', 'Połać prawa (Wnęka)', 'Połać prawa', 'Połać prawa (Wycięcie narożne)', 'Ściana: Wycięcie narożne']);
    expect(m.walls.map((w) => w.label)).toEqual(['Szczyt przedni', 'Szczyt (Wnęka)', 'Szczyt (Wycięcie narożne)', 'Szczyt tylny']);
    expect(m.refs.map((r) => r.name)).toEqual(['Dach', ...m.walls.map((w) => w.label)]);
    expect(m.refs.map((r) => r.id)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5']);
  });
  it('sanitizeNames drops junk and long names', () => {
    const n = sanitizeNames({ rooms: { salon: 'x'.repeat(100), bogus: 'a', sypialnia: 5 }, surfaces: { salon: { '1': 'A', 'zz': 'B' } }, features: { salon: { recess: 'W', other: 'q' } } }, ROOM_IDS)!;
    expect(n.rooms.salon).toHaveLength(60);
    expect(n.rooms.sypialnia).toBeUndefined();
    expect(n.surfaces.salon).toEqual({ '1': 'A' });
    expect(n.features.salon).toEqual({ recess: 'W' });
    expect(sanitizeNames('x', ROOM_IDS)).toBeNull();
  });
  it('prefixes of custom names do not collide', () => {
    const p = roomPrefixes({ rooms: { salon: 'Salon', sypialnia: 'Sypialnia', 'lazienka-1': 'Sauna' }, surfaces: {}, features: {} }, ROOM_IDS, (id) => id);
    expect(new Set(Object.values(p)).size).toBe(4);
  });
});

describe('"wpust" only means the groove', () => {
  const texts = (o: unknown): string[] => (typeof o === 'string' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(texts) : []);
  it('no UI string calls the recess feature a wpust (PL), nor a groove "recess" (EN)', () => {
    for (const t of texts(pl)) if (/wpust/i.test(t)) expect(t).toMatch(/pióro|piórem|Pióro|piórze|wpustem|wpust\b/i);
    expect(texts(pl).filter((t) => /(wpust: szerokość|wpustu|przy wpuście|\(wpust\))/i.test(t))).toEqual([]);
    expect(texts(pl).some((t) => t.includes('Wnęka') || t.includes('wnęki'))).toBe(true);
    expect(texts(en).filter((t) => /wpust/i.test(t))).toEqual([]);
  });
});
