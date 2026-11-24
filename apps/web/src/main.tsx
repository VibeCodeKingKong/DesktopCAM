import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { loadAllDicts } from './i18n/dicts';
import { ErrorBoundary } from './errors/ErrorBoundary';
import { installErrorReporting } from './errors/reports';

installErrorReporting();

// En ny version har publicerats och den här sidans filer (t.ex. ett fönster som
// laddas först när det öppnas) finns inte längre på servern: ladda om en gång
// i stället för att krascha. Spärren hindrar en omladdningsslinga.
window.addEventListener('vite:preloadError', (e) => {
  try {
    const last = Number(sessionStorage.getItem('desktopcam.preloadReload') ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem('desktopcam.preloadReload', String(Date.now()));
  } catch {
    return;
  }
  e.preventDefault();
  location.reload();
});

// Utvecklingsläge: verktyg för skriptet som bygger exempelprojekten (scripts/build-examples.cjs).
if (import.meta.env.DEV) void import('./devHooks');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// Det valda språket laddas före start (i18n/dicts.ts); övriga i bakgrunden,
// så att namn på andra språk känns igen och språkbyte går direkt.
const idle = (cb: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 5000 }) : setTimeout(cb, 2000));
idle(() => void loadAllDicts());
