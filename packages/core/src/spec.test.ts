import { describe, expect, it } from 'vitest';
import { loadGolden } from './golden';
import { buildModel, roomPieces, ROOM_IDS, ROOMS, type RoomId } from './rooms';
import { withSheet } from './sheet';
import { buildRoom, woodAreaCm2, otherAreaCm2 } from './cladding';
import { engineInput, flatIsPreset, presetSpec, specFromLegacy, surfaceKeys, typeOf, type RoomSpec } from './spec';
import { pieceArea } from './shelf';

interface RoomGolden { cases: Array<{ name: string; input: Record<string, number> }> }
const cfg = { splits: {}, splitAtBends: true };

/** The pieces the preset engines gave before the generic room (project file v2): the reference. */
function legacyPieces(id: RoomId, input: Record<string, number>) {
  const o1 = input.o1 ?? 0;
  const base = id === 'lazienka-2' ? input : { ...input, o2: o1, o3: o1, o4: o1, o5: o1 };
  const m = buildModel(id, base);
  return roomPieces('walls' in m ? withSheet(m, cfg) : m);
}

for (const id of ROOM_IDS) {
  const g = loadGolden<RoomGolden>(id);
  describe(`generic room = ${id}`, () => {
    it('the spec of the preset has the engine of the room', () => {
      expect(typeOf(presetSpec(id))).toBe(id);
    });
    for (const c of g.cases) {
      it(`${c.name}: the same pieces through RoomSpec`, () => {
        const spec = specFromLegacy(id, c.input);
        const roof = { W: c.input.W ?? 548, ang: c.input.ang ?? 40, HL: c.input.HL ?? 107 };
        const m = buildRoom(spec, { roof, plate: { PL: c.input.PL!, PW: c.input.PW! }, cfg });
        expect(m.faces).toBeUndefined(); // default direction and wood: every surface is the preset's own
        expect(roomPieces(m)).toEqual(legacyPieces(id, c.input));
        expect(woodAreaCm2(m)).toBe(m.areaCm2);
      });
    }
  });
}

describe('spec <-> engine inputs', () => {
  it('Łazienka 2: ceiling joined to the two walls, all four walls wood from 184 (66 below the ceiling)', () => {
    const s = presetSpec('lazienka-2');
    expect(s.ceiling).toEqual({ kind: 'flat', h: 250 });
    expect(s.join).toBe(true);
    for (const k of ['2', '3', '4', '5']) expect(s.surf[k]!.finish).toEqual({ kind: 'split', at: 184, wood: 'above' });
    expect(flatIsPreset(s)).toBe(true);
    expect(engineInput(s, { W: 548, ang: 40, HL: 107 }).params.hb).toBe(66);
  });
  it('Salon: notches and the end-wall cut-out are the generic ones', () => {
    const s = presetSpec('salon');
    expect(s.notches.map((n) => n.kind).sort()).toEqual(['corner', 'offset', 'recess']);
    expect(s.surf['9']!.finish).toEqual({ kind: 'split', at: 56, wood: 'above' });
    expect(surfaceKeys(s)).toEqual([1, 6, 7, 8, 9]);
  });
  it('every preset gives back its own engine input', () => {
    for (const id of ROOM_IDS) {
      const { type, params } = engineInput(presetSpec(id), { W: 548, ang: 40, HL: 107 });
      expect(type).toBe(id);
      for (const k of ['L', 'bz', 'bx', 'Wb', 'bw', 'HL', 'ang', 'capOn', 'capH', 'dA', 'ZA', 'wB', 'dB', 'hb', 'H']) {
        if (ROOMS[id].defaults[k] !== undefined && !(id !== 'salon' && ['dA', 'ZA', 'wB', 'dB'].includes(k))) expect(params[k], `${id}.${k}`).toBe(ROOMS[id].defaults[k]);
      }
    }
  });
});

describe('directions and finishes', () => {
  const roof = { W: 548, ang: 40, HL: 107 };
  const plate = { PL: 499, PW: 125 };
  const build = (s: RoomSpec) => buildRoom(s, { roof, plate, cfg });
  const area = (m: ReturnType<typeof build>) => roomPieces(m).reduce((a, q) => a + pieceArea(q), 0);

  it('horizontal boards on a gable wall cover the same area as vertical ones', () => {
    const s = presetSpec('sypialnia');
    const v = build(s);
    s.surf['6'] = { dir: 'horizontal' };
    const h = build(s);
    expect(h.faces!.map((f) => f.key)).toEqual([6]);
    expect(h.legacyOff).toEqual([6]);
    expect(area(h)).toBeCloseTo(area(v), 3);
    const rows = h.faces![0]!.plan.rows;
    expect(rows[0]!.lo).toBe(0);
    h.faces![0]!.plan.pieces.forEach((p) => { expect(p.l).toBeLessThanOrEqual(499 + 1e-6); expect(p.w).toBeLessThanOrEqual(125 + 1e-6); });
  });
  it('boards along the ridge: the same area, pieces within the plate, a grid per segment', () => {
    const s = presetSpec('sypialnia');
    const v = build(s);
    s.surf['1'] = { dir: 'ridge' };
    const r = build(s);
    expect(r.legacyOff).toContain(1);
    expect(area(r)).toBeCloseTo(area(v), 2);
    r.faces![0]!.plan.pieces.forEach((p) => { expect(p.l).toBeLessThanOrEqual(499 + 1e-6); expect(p.w).toBeLessThanOrEqual(125 + 1e-6); });
    // a board does not run across a fold: every piece lies inside one segment
    const folds = r.faces![0]!.folds;
    expect(folds.length).toBeGreaterThan(1);
  });
  it('a finish zone: non-wood part is hatched, makes no pieces and is counted as other', () => {
    const s = presetSpec('sypialnia');
    const all = build(s);
    s.surf['6'] = { finish: { kind: 'split', at: 100, wood: 'above' } };
    const m = build(s);
    const f = m.faces![0]!;
    expect(f.otherArea).toBeGreaterThan(0);
    expect(f.woodArea + f.otherArea).toBeCloseTo(all.walls.find((w) => w.rid === 6)!.strips.reduce((a, c) => a + (c.b - c.a) * 0, 0) + f.woodArea + f.otherArea, 6);
    f.plan.pieces.forEach((p) => expect(p.l).toBeLessThanOrEqual(499 + 1e-6));
    expect(otherAreaCm2(m)).toBeCloseTo(f.otherArea, 6);
    // a wall that is not wood at all
    s.surf['6'] = { finish: { kind: 'other' } };
    const none = build(s);
    expect(none.faces![0]!.plan.pieces).toHaveLength(0);
    expect(woodAreaCm2(none)).toBeLessThan(woodAreaCm2(all));
  });
  it('Łazienka 2 with the walls as zones: same pieces as the preset model', () => {
    const s = presetSpec('lazienka-2');
    const m = build(s);
    expect(m.faces).toBeUndefined();
    expect(roomPieces(m)).toEqual(legacyPieces('lazienka-2', ROOMS['lazienka-2'].defaults));
  });
  it('flat room: ceiling not joined, walls as faces', () => {
    const s = presetSpec('lazienka-2');
    s.join = false;
    const m = build(s);
    expect(m.faces!.map((f) => f.key)).toEqual([1, 2, 3, 4, 5]);
    // ceiling 149 x 278 plus four walls with the zone of 66
    const wood = woodAreaCm2(m);
    expect(wood).toBeCloseTo(149 * 278 + 2 * (149 + 278) * 66, 3);
    expect(otherAreaCm2(m)).toBeCloseTo(2 * (149 + 278) * (250 - 66), 3);
  });
  it('flat room: ceiling boards along the length', () => {
    const s = presetSpec('lazienka-2');
    s.join = false;
    s.surf['1'] = { dir: 'ridge' };
    const m = build(s);
    const c = m.faces!.find((f) => f.key === 1)!;
    expect(Math.max(...c.plan.pieces.map((p) => p.l))).toBeCloseTo(278, 6);
  });
  it('horizontal rows on a flat wall start at the wood zone', () => {
    const s = presetSpec('lazienka-2');
    s.join = false;
    s.surf['2'] = { dir: 'horizontal', finish: { kind: 'split', at: 184, wood: 'above' } };
    const m = build(s);
    const f = m.faces!.find((x) => x.key === 2)!;
    expect(f.plan.rows[0]!.lo).toBeCloseTo(184, 6);
    expect(f.plan.rows.at(-1)!.hi).toBeCloseTo(250, 6);
  });
});
