import { useEffect, useRef, type ReactNode } from 'react';
import { Crosshair, DoorOpen, Layers, Pin, PinOff, Ruler, X } from 'lucide-react';
import { s } from '../i18n';
import { SECTIONS, usePanel, type PanelSection } from '../state/panel';
import { useStore } from '../state/store';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { RoomId } from '@slabs/core';

const ICON: Record<PanelSection, typeof Ruler> = { dims: Ruler, starts: Crosshair, openings: DoorOpen, plates: Layers };
const labelOf = (k: PanelSection) => s.panel[k];

/** `M` toggles the panel (not while typing in a field, not with a modifier key). */
export function usePanelShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        // Esc closes the overlay (a pinned panel stays) and returns the focus to where it was opened from
        const p = usePanel.getState();
        const pinnedNow = p.pinned && window.matchMedia?.('(min-width: 1440px)').matches;
        if ((p.open && !pinnedNow) || p.sheet) { p.close(); const t = p.returnTo; if (t && document.contains(t)) t.focus(); }
        return;
      }
      if (e.key.toLowerCase() !== 'm' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.getAttribute('role') === 'combobox')) return;
      e.preventDefault();
      usePanel.getState().toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** How many measurements of this room are missing (an emptied field): shown on the rail. */
export function useMissing(room: RoomId): number {
  return useStore((st) => st.empty.filter((x) => x.startsWith(room + '.')).length);
}

/** One rail / strip button: icon with its label underneath. */
function RailButton({ k, room, horizontal }: { k: PanelSection; room: RoomId; horizontal?: boolean }) {
  const open = usePanel((p) => (horizontal ? p.sheet : p.open));
  const section = usePanel((p) => p.section);
  const missing = useMissing(room);
  const Icon = ICON[k];
  const active = open && section === k;
  const name = labelOf(k);
  return (
    <button
      type="button" data-rail={k}
      className={cn('relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-center text-xs leading-tight font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50', active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground', horizontal && 'flex-1')}
      aria-pressed={active} aria-controls="measure-panel" aria-keyshortcuts="M"
      aria-label={active ? s.panel.hide(name) : s.panel.show(name)}
      title={s.panel.shortcutHint}
      onClick={(e) => {
        const p = usePanel.getState();
        if (active) { p.close(); p.returnTo?.focus?.(); return; }
        p.openAt(k, undefined, e.currentTarget);
      }}
    >
      <Icon className="size-5" aria-hidden="true" />
      <span aria-hidden="true">{name}</span>
      {k === 'dims' && missing > 0 && <span className="absolute top-1 right-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[11px] leading-4 font-semibold text-white" aria-label={s.panel.missingShort}>{missing}</span>}
    </button>
  );
}

/** Vertical rail on the right (≥ 768 px): ~56 px, four labelled icons. */
export function PanelRail({ room }: { room: RoomId }) {
  return (
    <nav aria-label={s.panel.rail} className="flex w-14 shrink-0 flex-col gap-1 border-l bg-card p-1 max-md:hidden md:sticky md:top-[var(--barh,112px)] md:h-[calc(100vh-var(--barh,112px))] md:self-start" data-panel-rail>
      {SECTIONS.map((k) => <RailButton key={k} k={k} room={room} />)}
    </nav>
  );
}

/** The same four buttons as a row for the phone; they open the bottom sheet. */
export function PanelStrip({ room }: { room: RoomId }) {
  return (
    <nav aria-label={s.panel.rail} className="flex gap-1 rounded-lg border bg-card p-1 md:hidden" data-panel-strip>
      {SECTIONS.map((k) => <RailButton key={k} k={k} room={room} horizontal />)}
    </nav>
  );
}

/**
 * The panel: ~380 px, over the drawing (it does not push it); on screens of 1440 px and wider it can be pinned and then sits beside
 * the drawing. Esc closes it and returns the focus to where it was opened from. On the phone the same content is a bottom sheet.
 */
export function MeasurePanel({ children }: { children: (section: PanelSection) => ReactNode }) {
  const open = usePanel((p) => p.open);
  const pinned = usePanel((p) => p.pinned);
  const section = usePanel((p) => p.section);
  const sheet = usePanel((p) => p.sheet);
  const { close, setPinned, setSection, setSheet } = usePanel.getState();
  const ref = useRef<HTMLElement>(null);
  const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1440px)').matches;
  const isPinned = pinned && wide;
  const back = () => { const t = usePanel.getState().returnTo; if (t && document.contains(t)) t.focus(); };
  // the panel takes the focus when it opens, so the keyboard continues in it
  useEffect(() => { if (open && !isPinned && usePanel.getState().grab) setTimeout(() => ref.current?.focus({ preventScroll: true }), 0); }, [open, section]);
  const header = (
    <div className="flex items-center gap-1 border-b px-3 py-1.5">
      <h2 className="flex-1 text-base font-semibold" id="measure-panel-h">{labelOf(section)}</h2>
      {wide && <Button variant="ghost" size="icon" aria-pressed={pinned} aria-label={pinned ? s.panel.unpin : s.panel.pin} title={pinned ? s.panel.unpin : s.panel.pin} onClick={() => setPinned(!pinned)}>{pinned ? <PinOff /> : <Pin />}</Button>}
      <Button variant="ghost" size="icon" aria-label={s.panel.close} title={s.panel.close} onClick={() => { close(); back(); }}><X /></Button>
    </div>
  );
  return (
    <>
      <aside
        ref={ref} id="measure-panel" tabIndex={-1} role="complementary" aria-labelledby="measure-panel-h"
        data-panel-state={!open ? 'closed' : isPinned ? 'pinned' : 'overlay'}
        onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented && !isPinned) { e.stopPropagation(); close(); back(); } }}
        className={cn(
          open ? 'flex' : 'hidden',
          'w-[380px] flex-col bg-card text-card-foreground outline-none max-md:hidden',
          isPinned ? 'sticky top-[var(--barh,112px)] h-[calc(100vh-var(--barh,112px))] shrink-0 self-start border-l' : 'fixed top-[var(--barh,112px)] right-14 bottom-0 z-30 border-l shadow-2xl',
        )}
      >
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{open && children(section)}</div>
      </aside>
      <Sheet open={sheet} onOpenChange={(o) => { setSheet(o); if (!o) back(); }}>
        <SheetContent side="bottom" closeLabel={s.panel.close} className="md:hidden" aria-describedby="sheet-desc" onCloseAutoFocus={(e) => { e.preventDefault(); back(); }}>
          <SheetTitle className="px-3 pt-3 text-base font-semibold" id="sheet-h">{labelOf(section)}</SheetTitle>
          <SheetDescription id="sheet-desc" className="sr-only">{s.panel.title}</SheetDescription>
          <div className="flex gap-1 px-3" role="tablist" aria-label={s.panel.rail}>
            {SECTIONS.map((k) => (
              <button key={k} role="tab" type="button" aria-selected={section === k} data-sheet-tab={k} onClick={() => setSection(k)}
                className={cn('flex min-h-11 flex-1 items-center justify-center rounded-md px-1 text-xs font-medium', section === k ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}>{labelOf(k)}</button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">{sheet && children(section)}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

