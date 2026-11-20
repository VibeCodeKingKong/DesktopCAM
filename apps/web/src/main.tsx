import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Utvecklingsläge: verktyg för skriptet som bygger exempelprojekten (scripts/build-examples.cjs).
if (import.meta.env.DEV) void import('./devHooks');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
