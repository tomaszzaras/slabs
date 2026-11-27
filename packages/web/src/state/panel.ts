// State of the measurement panel (rail on the right, overlay panel, pin on wide screens). Open/pinned/section are remembered.
import { create } from 'zustand';
import type { RoomRef } from './project';

export type PanelSection = 'starts' | 'openings' | 'plates';
export const SECTIONS: PanelSection[] = ['starts', 'openings', 'plates'];
const KEY = 'slabs-panel-v1';

interface Saved { open: boolean; pinned: boolean; section: PanelSection }
function load(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null;
    if (v && typeof v === 'object') return { open: v.open === true, pinned: v.pinned === true, section: SECTIONS.includes(v.section as PanelSection) ? (v.section as PanelSection) : 'starts' };
  } catch { /* storage may be missing or blocked */ }
  return { open: false, pinned: false, section: 'starts' };
}
const save = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } };

/** A field the panel should show highlighted (a measurement, an opening or a start point), with a counter so the same field can be asked for twice. */
export interface PanelFocus { kind: 'opening' | 'start'; room: RoomRef; key: string; nonce: number }

interface PanelState extends Saved {
  /** the phone's bottom sheet is open (not remembered) */
  sheet: boolean;
  focus: PanelFocus | null;
  /** the element that had the focus when the panel opened: Esc returns it there */
  returnTo: HTMLElement | null;
  toggle: (returnTo?: HTMLElement | null) => void;
  /** `grab` false: opened by something on the drawing (a drag in progress): the focus stays where it is */
  openAt: (section: PanelSection, focus?: Omit<PanelFocus, 'nonce'>, returnTo?: HTMLElement | null, grab?: boolean) => void;
  grab: boolean;
  setSection: (s: PanelSection) => void;
  close: () => void;
  setPinned: (p: boolean) => void;
  setSheet: (o: boolean) => void;
}
let nonce = 0;
const phone = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(max-width: 767px)').matches;

export const usePanel = create<PanelState>((set, get) => {
  const init = load();
  const persist = () => { const { open, pinned, section } = get(); save({ open, pinned, section }); };
  return {
    ...init, sheet: false, focus: null, returnTo: null, grab: true,
    toggle: (returnTo) => {
      if (phone()) { set((s) => ({ sheet: !s.sheet, returnTo: s.sheet ? s.returnTo : returnTo ?? (document.activeElement as HTMLElement | null) })); return; }
      set((s) => ({ open: !s.open, returnTo: s.open ? s.returnTo : returnTo ?? (document.activeElement as HTMLElement | null) }));
      persist();
    },
    openAt: (section, focus, returnTo, grab = true) => {
      const ret = (was: boolean, cur: HTMLElement | null) => returnTo ?? (was ? cur : (document.activeElement as HTMLElement | null));
      if (phone()) { set((s) => ({ grab, sheet: true, section, focus: focus ? { ...focus, nonce: ++nonce } : s.focus, returnTo: ret(s.sheet, s.returnTo) })); persist(); return; }
      set((s) => ({ grab, open: true, section, focus: focus ? { ...focus, nonce: ++nonce } : s.focus, returnTo: ret(s.open, s.returnTo) }));
      persist();
    },
    setSection: (section) => { set({ section }); persist(); },
    close: () => { set({ open: false, sheet: false, focus: null }); persist(); },
    setPinned: (pinned) => { set({ pinned, open: pinned ? true : get().open }); persist(); },
    setSheet: (sheet) => set({ sheet, ...(sheet ? {} : { focus: null }) }),
  };
});
