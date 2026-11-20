import { useEffect } from 'react';
import { MARK_DEFS } from '@slabs/render';
import { s } from './i18n';
import { RoomScreen } from './components/RoomScreen';
import { SharedPage } from './components/SharedPage';
import { TopBar } from './components/TopBar';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { useStore } from './state/store';

export function App() {
  const loaded = useStore((st) => st.loaded);
  const tab = useStore((st) => st.tab);
  const theme = useStore((st) => st.theme);
  const lang = useStore((st) => st.lang);
  useEffect(() => { void useStore.getState().init(); }, []);
  useEffect(() => { document.documentElement.lang = lang; document.title = s.app.docTitle; }, [lang]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); useStore.getState().undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); useStore.getState().redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'auto' && mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  if (!loaded) return <p className="p-10 text-muted-foreground">{s.app.loading}</p>;
  return (
    <TooltipProvider delayDuration={300}>
      <div key={lang}>
        {/* pattern and arrow definitions shared by every drawing on the page */}
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: MARK_DEFS }} />
        <TopBar />
        <div role="tabpanel" aria-labelledby={`tab-${tab}`} className="pb-24 md:pb-6">
          {tab === 'rozkroj' ? <SharedPage /> : <RoomScreen key={tab} id={tab} />}
        </div>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
