import { describe, expect, it } from 'vitest';
import { paginate, type RoomImages } from './roomPages';

const W = 297, H = 210, M = 10, TOP = 26, BOTTOM = 12, CAP = 6;
const img = (label: string, wPx: number, hPx: number) => ({ label, png: '', w: wPx, h: hPx });
const room = (id: string, no: number, ...surfaces: ReturnType<typeof img>[]): RoomImages => ({ id, no, surfaces });
const pages = (rooms: RoomImages[]) => paginate(rooms, W, H, M, TOP, BOTTOM, CAP);

describe('room pages of the PDF', () => {
  it('starts every room on a page of its own, in the given order, numbered', () => {
    const p = pages([room('a', 1, img('roof', 300, 200)), room('b', 2, img('wall', 300, 200))]);
    expect(p.map((x) => [x.room.id, x.room.no, x.first])).toEqual([['a', 1, true], ['b', 2, true]]);
  });

  it('puts small drawings side by side in one row and wraps to a new row when the row is full', () => {
    // 250 px = 66 mm: three plus their gaps (210 mm) fit in the 277 mm row, a fourth (292 mm) does not
    const small = (l: string) => img(l, 250, 250);
    const [pg] = pages([room('a', 1, ...['1', '2', '3', '4'].map(small))]);
    const ys = pg!.items.map((i) => i.y);
    expect(pg!.items.length).toBe(4);
    expect(new Set(ys.slice(0, 3)).size).toBe(1);
    expect(ys[3]!).toBeGreaterThan(ys[0]!);
    expect(pg!.items[3]!.x).toBe(M);
    expect(pg!.items[1]!.x).toBeGreaterThan(pg!.items[0]!.x + pg!.items[0]!.w);
  });

  it('never lets a drawing leave the page, and scales a too tall one down keeping its proportions', () => {
    const tall = img('tall', 400, 4000);
    const all = pages([room('a', 1, tall, img('wide', 5000, 300), img('mid', 800, 600))]);
    for (const pg of all) for (const it of pg.items) {
      expect(it.x).toBeGreaterThanOrEqual(M);
      expect(it.x + it.w).toBeLessThanOrEqual(W - M + 1e-9);
      expect(it.y + it.h).toBeLessThanOrEqual(H - BOTTOM + 1e-9);
      expect(it.y - CAP).toBeGreaterThanOrEqual(TOP - 1e-9);
      expect(it.w / it.h).toBeCloseTo(it.s.w / it.s.h, 6);
    }
  });

  it('continues a room on further pages, marked as continuation, without losing or reordering a drawing', () => {
    const many = ['1', '2', '3', '4', '5', '6'].map((l) => img(l, 1000, 700)); // one per row, about 2 rows per page
    const all = pages([room('a', 1, ...many), room('b', 2, img('b1', 300, 300))]);
    const ofA = all.filter((x) => x.room.id === 'a');
    expect(ofA.length).toBeGreaterThan(1);
    expect(ofA.map((x) => x.first)).toEqual(ofA.map((_, i) => i === 0));
    expect(ofA.flatMap((x) => x.items.map((i) => i.s.label))).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(all[all.length - 1]!.room.id).toBe('b');
    expect(all[all.length - 1]!.first).toBe(true);
  });

  it('a room without drawings still gets its page (its title), and nothing is produced for no rooms', () => {
    expect(pages([room('a', 1)]).length).toBe(1);
    expect(pages([])).toEqual([]);
  });
});
