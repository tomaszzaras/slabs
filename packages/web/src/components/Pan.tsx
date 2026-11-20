import { useEffect, useRef, useState } from 'react';
import { s } from '../i18n';

/** Width of an element, kept up to date (the drawing scale follows it). */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** A drawing that can be larger than the screen: scrolls inside its frame and says so, so it never looks cut off. */
export function Pan({ html, className = 'pan', children, size, onPinch }: { html: string; className?: string; children?: React.ReactNode; size?: { w: number; h: number }; onPinch?: (factor: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOver(el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [html]);
  // two-finger pinch zooms the drawing (one finger still scrolls it)
  const pinch = useRef(onPinch);
  pinch.current = onPinch;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let d0 = 0;
    const dist = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
    const move = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinch.current) { d0 = 0; return; }
      e.preventDefault();
      const d = dist(e.touches);
      if (!d0) { d0 = d; return; }
      if (Math.abs(d / d0 - 1) > 0.06) { pinch.current(d / d0); d0 = d; }
    };
    const end = () => { d0 = 0; };
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => { el.removeEventListener('touchmove', move); el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end); };
  }, []);
  return (
    <>
      <div ref={ref} className={className} tabIndex={over ? 0 : undefined} role={over ? 'region' : undefined} aria-label={over ? s.room.panHint : undefined}>
        <div className="pan-in" style={size ? { width: size.w, height: size.h } : undefined}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
          {children}
        </div>
      </div>
      {over && <p className="hint" role="note">{s.room.panHint}</p>}
    </>
  );
}
