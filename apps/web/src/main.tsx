import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { loadAllDicts } from './i18n/dicts';

// Utvecklingsläge: verktyg för skriptet som bygger exempelprojekten (scripts/build-examples.cjs).
if (import.meta.env.DEV) void import('./devHooks');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Det valda språket laddas före start (i18n/dicts.ts); övriga i bakgrunden,
// så att namn på andra språk känns igen och språkbyte går direkt.
const idle = (cb: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 5000 }) : setTimeout(cb, 2000));
idle(() => void loadAllDicts());
