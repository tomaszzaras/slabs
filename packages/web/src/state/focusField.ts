// Jumping to a field of the room page ("show where to type this"): opens the Kształt section, scrolls to the field and focuses it.
import type { RoomRef } from './project';

/** The Kształt field that edits an input of the preset engine (the drawings and the cut name inputs by the engine's keys). */
export function fieldIdFor(room: RoomRef, key: string): string {
  const map: Record<string, string> = { L: 'l', bz: 'l', Wb: 'w', bw: 'w', bx: 'w', H: 'h', niche: 'n_offset_a', dA: 'n_recess_a', ZA: 'n_recess_b', wB: 'n_corner_a', dB: 'n_corner_b', hb: 'h' };
  const m = /^o(\d)$/.exec(key);
  if (m) return `c_${room}_${m[1]}_start`;
  return `p_${room}_${map[key] ?? key}`;
}

/** rooms whose page is not mounted yet but should open Kształt in edit mode (consumed by the page) */
export const wantsEdit = new Set<string>();

export function jumpToField(room: RoomRef, key: string): void {
  if (typeof window === 'undefined') return;
  wantsEdit.add(room);
  window.dispatchEvent(new CustomEvent('slabs:open-shape'));
  const id = fieldIdFor(room, key);
  let tries = 0;
  const go = () => {
    const el = document.getElementById(id) ?? document.querySelector<HTMLElement>(`[data-change-roof="${key}"]`);
    if (el) { wantsEdit.delete(room); el.scrollIntoView({ block: 'center' }); (el as HTMLElement).focus({ preventScroll: true }); return; }
    if (++tries < 12) setTimeout(go, 80); else wantsEdit.delete(room);
  };
  setTimeout(go, 60);
}
