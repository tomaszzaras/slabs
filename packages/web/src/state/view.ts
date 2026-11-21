// Which view of the room drawing is shown (flat 2D or the 3D model) and what the 3D model shows. Remembered in the browser.
import { create } from 'zustand';

export type ViewMode = '2d' | '3d';
const KEY = 'slabs-view-v1';

export interface View3DOptions { roof: boolean; grid: boolean; numbers: boolean; refs: boolean }
interface Saved extends View3DOptions { mode: ViewMode }
const DEFAULT: Saved = { mode: '2d', roof: true, grid: true, numbers: true, refs: true };

function load(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null;
    if (v && typeof v === 'object') {
      const b = (x: unknown, d: boolean) => (typeof x === 'boolean' ? x : d);
      return { mode: v.mode === '3d' ? '3d' : '2d', roof: b(v.roof, true), grid: b(v.grid, true), numbers: b(v.numbers, true), refs: b(v.refs, true) };
    }
  } catch { /* storage may be missing or blocked */ }
  return { ...DEFAULT };
}
const save = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } };

interface ViewState extends Saved {
  setMode: (m: ViewMode) => void;
  toggle: (k: keyof View3DOptions) => void;
}
export const useView = create<ViewState>((set, get) => ({
  ...load(),
  setMode: (mode) => { set({ mode }); const { roof, grid, numbers, refs } = get(); save({ mode, roof, grid, numbers, refs }); },
  toggle: (k) => { set((st) => ({ [k]: !st[k] }) as Pick<ViewState, typeof k>); const { mode, roof, grid, numbers, refs } = get(); save({ mode, roof, grid, numbers, refs }); },
}));
