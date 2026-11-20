import { useEffect } from 'react';
import { s } from './i18n';
import { Header } from './components/Header';
import { RoomPage } from './components/RoomPage';
import { SettingsPanel } from './components/SettingsPanel';
import { SharedPage } from './components/SharedPage';
import { useStore } from './state/store';

export function App() {
  const loaded = useStore((st) => st.loaded);
  const tab = useStore((st) => st.tab);
  const theme = useStore((st) => st.theme);
  useEffect(() => { void useStore.getState().init(); }, []);
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'auto') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
  }, [theme]);
  if (!loaded) return <p className="loading">{s.app.loading}</p>;
  return (
    <>
      <Header />
      <div className="page" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        <div className="wrap"><SettingsPanel /></div>
        {tab === 'rozkroj' ? <SharedPage /> : <RoomPage key={tab} id={tab} />}
      </div>
    </>
  );
}
