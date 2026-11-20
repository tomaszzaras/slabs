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
export function Pan({ html, className = 'pan' }: { html: string; className?: string }) {
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
  return (
    <>
      <div ref={ref} className={className} tabIndex={over ? 0 : undefined} role={over ? 'region' : undefined} aria-label={over ? s.room.panHint : undefined} dangerouslySetInnerHTML={{ __html: html }} />
      {over && <p className="hint" role="note">{s.room.panHint}</p>}
    </>
  );
}
