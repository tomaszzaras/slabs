import { useEffect } from 'react';
import { MARK_DEFS } from '@slabs/render';
import { s } from './i18n';
import { RoomScreen } from './components/RoomScreen';
import { SharedPage } from './components/SharedPage';
import { Toast } from './components/Toast';
import { TopBar } from './components/TopBar';
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
    const el = document.documentElement;
    if (theme === 'auto') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
  }, [theme]);
  if (!loaded) return <p className="loading">{s.app.loading}</p>;
  return (
    <div key={lang}>
      {/* pattern and arrow definitions shared by every drawing on the page */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: MARK_DEFS }} />
      <TopBar />
      <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'rozkroj' ? <SharedPage /> : <RoomScreen key={tab} id={tab} />}
      </div>
      <Toast />
    </div>
  );
}
