import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// COOP/COEP gör sidan "cross-origin isolated" så att SharedArrayBuffer och
// Wasm-trådar (rayon + wasm-bindgen-rayon) kan aktiveras senare.
// Samma headers sätts i public/_headers för Cloudflare Pages.
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
  build: { target: 'es2022', sourcemap: true },
});
