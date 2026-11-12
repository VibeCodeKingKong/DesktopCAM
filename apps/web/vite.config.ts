import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import license from 'rollup-plugin-license';

// Versionen finns bara i package.json och byggs in i appen.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string; dependencies: Record<string, string> };
const { version } = pkg;

/**
 * Typsnitten läses in som filer (inte som JS-moduler) och kommer därför inte
 * med i licensinsamlingen automatiskt – deras licenser läggs till här.
 * Roboto Slabs Apache-licens saknar upphovsrättsrad i paketet.
 */
const FONT_COPYRIGHT: Record<string, string> = {
  '@fontsource/roboto-slab': 'Copyright 2018 The Roboto Slab Project Authors (https://github.com/googlefonts/robotoslab)',
};
const fontLicenses = () =>
  Object.keys(pkg.dependencies)
    .filter((n) => n.startsWith('@fontsource/'))
    .map((n) => {
      const meta = JSON.parse(readFileSync(new URL(`./node_modules/${n}/package.json`, import.meta.url), 'utf8')) as { version: string; license: string };
      const text = readFileSync(new URL(`./node_modules/${n}/LICENSE`, import.meta.url), 'utf8').trim();
      return `${n} ${meta.version} - ${meta.license}\n${FONT_COPYRIGHT[n] ? FONT_COPYRIGHT[n] + '\n\n' : ''}${text}`;
    });

const SEP = '\n\n' + '-'.repeat(72) + '\n\n';

// COOP/COEP gör sidan "cross-origin isolated" så att SharedArrayBuffer och
// Wasm-trådar (rayon + wasm-bindgen-rayon) kan aktiveras senare.
// Samma headers sätts i public/_headers för Cloudflare Pages.
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [
    react(),
    // Licenser för allt från tredje part som följer med i appen → dist/licenses.txt (rollup-plugin-license, MIT).
    license({
      thirdParty: {
        includePrivate: false,
        output: {
          file: new URL('./dist/licenses.txt', import.meta.url).pathname,
          template: (deps) =>
            [
              `desktopCAM ${version} - licenses for third-party software and fonts included in the app.`,
              ...deps
                .filter((d) => !d.name?.startsWith('@fontsource/'))
                .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
                .map((d) => `${d.name} ${d.version} - ${d.license}\n${d.author?.text() ? 'Author: ' + d.author.text() + '\n' : ''}\n${(d.licenseText ?? d.noticeText ?? '').trim()}`),
              ...fontLicenses(),
            ].join(SEP) + '\n',
        },
      },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(version) },
  worker: { format: 'es' },
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
  build: { target: 'es2022', sourcemap: true },
});
