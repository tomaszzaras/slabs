import { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, authEnabled, useAuthState, useReloadOnSignOut } from './auth';
import { s } from './i18n';
import './index.css';

// The landing page and the editor are separate chunks: a signed-out visitor never downloads the editor (three.js, jsPDF, the
// cutting engine's worker), and a signed-in user never downloads the landing page.
const Landing = lazy(() => import('./landing/Landing'));
const EditorApp = lazy(() => import('./App').then((m) => ({ default: m.App })));

const Splash = () => <p className="p-10 text-muted-foreground" role="status">{s.app.loading}</p>;

/** Signed out: only the landing page. Signed in: the app. Without login configured (local dev, tests, single file): the app as before. */
function Gate() {
  const auth = useAuthState();
  useReloadOnSignOut(auth.status);
  return (
    <Suspense fallback={<Splash />}>
      {auth.status === 'loading' ? <Splash /> : auth.status === 'out' ? <Landing /> : <EditorApp key={auth.status === 'in' ? auth.userId : 'off'} />}
    </Suspense>
  );
}

if (!authEnabled) document.title = s.app.docTitle;
createRoot(document.getElementById('root')!).render(<AuthProvider><Gate /></AuthProvider>);
