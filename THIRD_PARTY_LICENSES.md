# Tredjepartslicenser – desktopCAM

desktopCAM är proprietär programvara (alla rättigheter förbehållna). Den här
filen förtecknar alla komponenter från tredje part, med licens, upphovsrätt
och status enligt licenspolicyn (se `CLAUDE.md` → Licenser och immaterialrätt).

- **Förteckningen nedan genereras** av `node scripts/license-audit.mjs` ur
  pnpm (npm-paket, även indirekta) och cargo (Rust/Wasm-motorn). Kör den efter
  varje ändring av beroenden. `node scripts/license-audit.mjs --check` stoppar
  om något som följer med appen har en licens som inte är godkänd.
- **Licenstexterna** finns i `LICENSE_NOTICES/` och samlas vid bygget i
  `dist/licenses.txt`, som visas i appen under Om desktopCAM → Licenser.
- **SBOM**: `SBOM.json` (CycloneDX 1.5).
- **Status**: APPROVED = kommersiell användning kontrollerad, med licensens
  villkor; REVIEW REQUIRED = behöver granskas/godkännas; REJECTED = får inte
  användas. En automatisk kontroll är en teknisk sållning och ersätter inte
  juridisk granskning.

## Sammanfattning – det som följer med appen

| Licens | Antal | Villkor i korthet |
|---|---|---|
| MIT | 31 | Upphovsrättsnotis och licenstext ska följa med. |
| ISC | 3 | Som MIT. |
| BSD-3-Clause | 1 | Notis ska följa med; upphovsmannens namn får inte användas i marknadsföring. |
| Apache-2.0 | 1 (Roboto Slab) | Licenstext och eventuell NOTICE ska följa med; patentlicens ingår. |
| OFL-1.1 | 6 typsnitt | Får bäddas in och användas kommersiellt; licenstexten ska följa med; typsnitten får inte säljas separat; ändrade typsnitt får inte bära de reserverade namnen. |
| Unlicense | 1 (robust-predicates) | Fri allmän egendom – inga villkor. |
| 0BSD | 1 (tslib) | Inga villkor. |

Inga komponenter med GPL, AGPL, SSPL, LGPL, MPL eller icke-kommersiella
licenser följer med appen. Inga AI-modeller används.

## Komponenter som inte är npm-paket

| Komponent | Ursprung | Licens | Status |
|---|---|---|---|
| `apps/web/src/shims/squares-rng.js` | Kopia av squares-rng 2.0.4 (Floris Steenkamp), avkodningen omskriven | MIT | APPROVED – notis i LICENSE_NOTICES |
| `packages/core/src/polyfills.ts` | Egen kod (Map.getOrInsert enligt TC39-förslaget) | Proprietär | – |
| Typsnittet "desktopCAM Linje" (`strokeFont.ts`) | Egen kod, tecknen ritade för hand | Proprietär | – |
| Ikoner | lucide-react (ISC) + egna SVG-illustrationer | ISC / proprietär | APPROVED |
| Exempelprojekt och -bilder (`public/examples`) | Byggda av appen (`scripts/build-examples.cjs`), landskapsbilden ritas i koden | Proprietär | – |
| Exempelfiler (`public/samples`) | Egengjorda | Proprietär | – |

## Externa tjänster

Se `COMMERCIAL_READINESS.md` (Web3Forms, Cloudflare, PayPal).

<!-- GENERERAT AV scripts/license-audit.mjs – ändra inte för hand nedanför denna rad -->

## Följer med appen (45)

| Paket | Version | Licens | Upphovsrätt | Källa | Status |
|---|---|---|---|---|---|
| @dnd-kit/accessibility | 3.1.1 | MIT | Claudéric Demers | <https://github.com/clauderic/dnd-kit> | APPROVED |
| @dnd-kit/core | 6.3.1 | MIT | Claudéric Demers | <https://github.com/clauderic/dnd-kit> | APPROVED |
| @dnd-kit/sortable | 10.0.0 | MIT | Claudéric Demers | <https://github.com/clauderic/dnd-kit> | APPROVED |
| @dnd-kit/utilities | 3.2.2 | MIT | Claudéric Demers | <https://github.com/clauderic/dnd-kit> | APPROVED |
| @fontsource/bebas-neue | 5.3.0 | OFL-1.1 | Google Inc. | <https://github.com/fontsource/font-files> | APPROVED |
| @fontsource/cinzel | 5.3.0 | OFL-1.1 | Google Inc. | <https://github.com/fontsource/font-files> | APPROVED |
| @fontsource/montserrat | 5.3.0 | OFL-1.1 | Google Inc. | <https://github.com/fontsource/font-files> | APPROVED |
| @fontsource/oswald | 5.3.0 | OFL-1.1 | Google Inc. | <https://github.com/fontsource/font-files> | APPROVED |
| @fontsource/pacifico | 5.3.0 | OFL-1.1 | Google Inc. | <https://github.com/fontsource/font-files> | APPROVED |
| @fontsource/playfair-display | 5.3.0 | OFL-1.1 | Google Inc. | <https://github.com/fontsource/font-files> | APPROVED |
| @fontsource/roboto-slab | 5.3.0 | Apache-2.0 | Google Inc. | <https://github.com/fontsource/font-files> | APPROVED |
| big-float-ts | 4.0.5 | MIT | Floris Steenkamp | <https://github.com/FlorisSteenkamp/big-float> | APPROVED |
| bignumber.js | 9.3.1 | MIT | Michael Mclaughlin | <https://github.com/MikeMcl/bignumber.js> | APPROVED |
| cropperjs | 1.7.0 | MIT | Chen Fengyuan | <https://github.com/fengyuanchen/cropperjs> | APPROVED |
| csstype | 3.2.3 | MIT | Fredrik Nicol | <https://github.com/frenic/csstype> | APPROVED |
| d3-delaunay | 6.0.4 | ISC | Mike Bostock | <https://github.com/d3/d3-delaunay> | APPROVED |
| delaunator | 5.1.0 | ISC | Vladimir Agafonkin | <https://github.com/mapbox/delaunator> | APPROVED |
| double-double | 4.0.0 | MIT | Floris Steenkamp | <https://github.com/FlorisSteenkamp/double-double> | APPROVED |
| driver.js | 1.11.0 | MIT | Kamran Ahmed | <https://github.com/nilbuild/driver.js> | APPROVED |
| flo-bezier3 | 10.0.1 | MIT | Floris Steenkamp | <https://github.com/FlorisSteenkamp/FloBezier> | APPROVED |
| flo-boolean | 6.0.5 | MIT | Floris Steenkamp | <https://github.com/FlorisSteenkamp/FloBoolean> | APPROVED |
| flo-draw | 2.0.5 | MIT | Floris Steenkamp | <https://github.com/FlorisSteenkamp/FloDraw> | APPROVED |
| flo-gauss-quadrature | 2.1.4 | MIT | Floris Steenkamp | <https://github.com/FlorisSteenkamp/FloGaussQuadrature> | APPROVED |
| flo-graham-scan | 4.0.2 | MIT | Floris Steenkamp | <https://github.com/FlorisSteenkamp/FloGrahamScan> | APPROVED |
| flo-ll-rb-tree | 1.0.4 | MIT | Floris Steenkamp | <https://github.com/FlorisSteenkamp/FloLlRbTree> | APPROVED |
| flo-mat | 5.0.7 | MIT | Floris Steenkamp | <https://github.com/FlorisSteenkamp/mat> | APPROVED |
| flo-memoize | 2.0.1 | MIT | Floris Steenkamp | <https://github.com/FlorisSteenkamp/FloMemoize> | APPROVED |
| flo-poly | 9.0.2 | MIT | Floris Steenkamp | <https://github.com/FlorisSteenkamp/FloPoly> | APPROVED |
| flo-vector2d | 4.0.6 | MIT | Floris Steenkamp | <https://github.com/FlorisSteenkamp/FloVector2d> | APPROVED |
| idb-keyval | 6.3.0 | Apache-2.0 | Jake Archibald | <https://github.com/jakearchibald/idb-keyval> | APPROVED |
| js-tokens | 4.0.0 | MIT | Simon Lydell | <lydell/js-tokens> | APPROVED |
| loose-envify | 1.4.0 | MIT | Andres Suarez | <git://github.com/zertosh/loose-envify> | APPROVED |
| lucide-react | 0.441.0 | ISC | Eric Fennis | <https://github.com/lucide-icons/lucide> | APPROVED |
| opentype.js | 2.0.0 | MIT | Frederik De Bleser | <git://github.com/opentypejs/opentype.js> | APPROVED |
| polyclip-ts | 0.16.8 | MIT | Luiz Felipe Machado Barboza | <https://github.com/luizbarboza/polyclip-ts> | APPROVED |
| react | 18.3.1 | MIT | – | <https://github.com/facebook/react> | APPROVED |
| react-dom | 18.3.1 | MIT | – | <https://github.com/facebook/react> | APPROVED |
| robust-predicates | 3.0.3 | Unlicense | Vladimir Agafonkin | <https://github.com/mourner/robust-predicates> | APPROVED |
| scheduler | 0.23.2 | MIT | – | <https://github.com/facebook/react> | APPROVED |
| splaytree-ts | 1.0.2 | BSD-3-Clause (metadata: BDS-3-Clause) | Luiz Felipe Machado Barboza | <https://github.com/SBanksX/splaytree-ts> | APPROVED |
| squares-rng | 2.0.4 | MIT | Floris Steenkamp | <https://github.com/FlorisSteenkamp/squares-rng> | APPROVED – ersatt av egen kopia |
| three | 0.169.0 | MIT | mrdoob | <https://github.com/mrdoob/three.js> | APPROVED |
| tslib | 2.9.1 | 0BSD | Microsoft Corp. | <https://github.com/Microsoft/tslib> | APPROVED |
| use-sync-external-store | 1.2.2 | MIT | – | <https://github.com/facebook/react> | APPROVED |
| zustand | 4.5.5 | MIT | Paul Henschel | <https://github.com/pmndrs/zustand> | APPROVED |

## Bara byggverktyg, typer och utveckling – följer inte med appen (168)

| Paket | Version | Licens | Upphovsrätt | Källa | Status |
|---|---|---|---|---|---|
| bumpalo | 3.20.4 | MIT OR Apache-2.0 | Nick Fitzgerald | <https://github.com/fitzgen/bumpalo> | APPROVED |
| cfg-if | 1.0.5 | MIT OR Apache-2.0 | Alex Crichton | <https://github.com/rust-lang/cfg-if> | APPROVED |
| itoa | 1.0.19 | MIT OR Apache-2.0 | David Tolnay | <https://github.com/dtolnay/itoa> | APPROVED |
| memchr | 2.8.3 | Unlicense OR MIT | Andrew Gallant, bluss | <https://github.com/BurntSushi/memchr> | APPROVED |
| proc-macro2 | 1.0.107 | MIT OR Apache-2.0 | David Tolnay, Alex Crichton | <https://github.com/dtolnay/proc-macro2> | APPROVED |
| quote | 1.0.47 | MIT OR Apache-2.0 | David Tolnay | <https://github.com/dtolnay/quote> | APPROVED |
| rustversion | 1.0.23 | MIT OR Apache-2.0 | David Tolnay | <https://github.com/dtolnay/rustversion> | APPROVED |
| serde | 1.0.229 | MIT OR Apache-2.0 | Erick Tryzelaar, David Tolnay | <https://github.com/serde-rs/serde> | APPROVED |
| serde_core | 1.0.229 | MIT OR Apache-2.0 | Erick Tryzelaar, David Tolnay | <https://github.com/serde-rs/serde> | APPROVED |
| serde_derive | 1.0.229 | MIT OR Apache-2.0 | Erick Tryzelaar, David Tolnay | <https://github.com/serde-rs/serde> | APPROVED |
| serde_json | 1.0.154 | MIT OR Apache-2.0 | – | <https://github.com/serde-rs/json> | APPROVED |
| syn | 3.0.10 | MIT OR Apache-2.0 | David Tolnay | <https://github.com/dtolnay/syn> | APPROVED |
| unicode-ident | 1.0.27 | (MIT OR Apache-2.0) AND Unicode-3.0 | David Tolnay | <https://github.com/dtolnay/unicode-ident> | APPROVED |
| wasm-bindgen | 0.2.130 | MIT OR Apache-2.0 | The wasm-bindgen Developers | <https://github.com/wasm-bindgen/wasm-bindgen> | APPROVED |
| wasm-bindgen-macro | 0.2.130 | MIT OR Apache-2.0 | The wasm-bindgen Developers | <https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/macro> | APPROVED |
| wasm-bindgen-macro-support | 0.2.130 | MIT OR Apache-2.0 | The wasm-bindgen Developers | <https://github.com/wasm-bindgen/wasm-bindgen/tree/main/crates/macro-support> | APPROVED |
| wasm-bindgen-shared | 0.2.130 | MIT OR Apache-2.0 | The wasm-bindgen Developers | <https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/shared> | APPROVED |
| zmij | 1.0.23 | MIT | David Tolnay | <https://github.com/dtolnay/zmij> | APPROVED |
| @alloc/quick-lru | 5.3.0 | MIT | Sindre Sorhus | <https://github.com/aleclarson/quick-lru> | APPROVED |
| @babel/code-frame | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/compat-data | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/core | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/generator | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-compilation-targets | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-globals | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-module-imports | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-module-transforms | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-plugin-utils | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-string-parser | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-validator-identifier | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-validator-option | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helpers | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/parser | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-react-jsx-self | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-react-jsx-source | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/template | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/traverse | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/types | 7.29.11 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @esbuild/linux-x64 | 0.21.5 | MIT | – | <https://github.com/evanw/esbuild> | APPROVED |
| @jridgewell/gen-mapping | 0.3.13 | MIT | Justin Ridgewell | <https://github.com/jridgewell/sourcemaps> | APPROVED |
| @jridgewell/remapping | 2.3.5 | MIT | Justin Ridgewell | <https://github.com/jridgewell/sourcemaps> | APPROVED |
| @jridgewell/resolve-uri | 3.1.2 | MIT | Justin Ridgewell | <https://github.com/jridgewell/resolve-uri> | APPROVED |
| @jridgewell/sourcemap-codec | 1.6.0 | MIT | Justin Ridgewell | <https://github.com/jridgewell/sourcemaps> | APPROVED |
| @jridgewell/trace-mapping | 0.3.31 | MIT | Justin Ridgewell | <https://github.com/jridgewell/sourcemaps> | APPROVED |
| @nodelib/fs.scandir | 2.1.5 | MIT | – | <https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.scandir> | APPROVED |
| @nodelib/fs.stat | 2.0.5 | MIT | – | <https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.stat> | APPROVED |
| @nodelib/fs.walk | 1.2.8 | MIT | – | <https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.walk> | APPROVED |
| @rollup/rollup-linux-x64-gnu | 4.68.2 | MIT | Lukas Taegert-Atkinson | <https://github.com/rollup/rollup> | APPROVED |
| @rollup/rollup-linux-x64-musl | 4.68.2 | MIT | Lukas Taegert-Atkinson | <https://github.com/rollup/rollup> | APPROVED |
| @tweenjs/tween.js | 23.1.3 | MIT | tween.js contributors | <https://github.com/tweenjs/tween.js> | APPROVED |
| @types/babel__core | 7.20.5 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @types/babel__generator | 7.27.0 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @types/babel__template | 7.4.4 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @types/babel__traverse | 7.28.0 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @types/d3-delaunay | 6.0.4 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @types/estree | 1.0.10 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @types/prop-types | 15.7.15 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @types/react | 18.3.11 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @types/react-dom | 18.3.0 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @types/stats.js | 0.17.4 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @types/three | 0.169.0 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @types/webxr | 0.5.24 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @vitejs/plugin-react | 4.3.2 | MIT | Evan You | <https://github.com/vitejs/vite-plugin-react> | APPROVED |
| @webgpu/types | 0.1.74 | BSD-3-Clause | – | <https://github.com/gpuweb/types> | APPROVED |
| any-promise | 1.3.0 | MIT | Kevin Beaty | <https://github.com/kevinbeaty/any-promise> | APPROVED |
| anymatch | 3.1.3 | ISC | Elan Shanker | <https://github.com/micromatch/anymatch> | APPROVED |
| arg | 5.0.2 | MIT | Josh Junon | <vercel/arg> | APPROVED |
| array-find-index | 1.0.2 | MIT | Sindre Sorhus | <sindresorhus/array-find-index> | APPROVED |
| autoprefixer | 10.4.20 | MIT | Andrey Sitnik | <postcss/autoprefixer> | APPROVED |
| baseline-browser-mapping | 2.11.35 | Apache-2.0 | – | <https://github.com/web-platform-dx/baseline-browser-mapping> | APPROVED |
| binary-extensions | 2.3.0 | MIT | Sindre Sorhus | <sindresorhus/binary-extensions> | APPROVED |
| braces | 3.0.3 | MIT | Jon Schlinkert | <micromatch/braces> | APPROVED |
| browserslist | 4.29.5 | MIT | Andrey Sitnik | <browserslist/browserslist> | APPROVED |
| camelcase-css | 2.0.1 | MIT | Steven Vachon | <stevenvachon/camelcase-css> | APPROVED |
| caniuse-lite | 1.0.30001823 | CC-BY-4.0 | Ben Briggs | <browserslist/caniuse-lite> | REVIEW REQUIRED |
| chokidar | 3.6.0 | MIT | Paul Miller | <https://github.com/paulmillr/chokidar> | APPROVED |
| commander | 4.1.1 | MIT | TJ Holowaychuk | <https://github.com/tj/commander.js> | APPROVED |
| commenting | 1.1.0 | MIT | Arnout Kazemier | <https://github.com/3rd-Eden/commenting> | APPROVED |
| convert-source-map | 2.0.0 | MIT | Thorsten Lorenz | <git://github.com/thlorenz/convert-source-map> | APPROVED |
| debug | 4.4.3 | MIT | Josh Junon | <git://github.com/debug-js/debug> | APPROVED |
| didyoumean | 1.2.2 | Apache-2.0 | Dave Porter | <https://github.com/dcporter/didyoumean.js> | APPROVED |
| dlv | 1.1.3 | MIT | Jason Miller | <developit/dlv> | APPROVED |
| electron-to-chromium | 1.5.479 | ISC | Kilian Valkhof | <https://github.com/Kilian/electron-to-chromium> | APPROVED |
| es-errors | 1.3.0 | MIT | Jordan Harband | <https://github.com/ljharb/es-errors> | APPROVED |
| esbuild | 0.21.5 | MIT | – | <https://github.com/evanw/esbuild> | APPROVED |
| escalade | 3.2.0 | MIT | Luke Edwards | <lukeed/escalade> | APPROVED |
| fast-glob | 3.3.3 | MIT | Denis Malinochkin | <mrmlnc/fast-glob> | APPROVED |
| fastq | 1.20.3 | ISC | Matteo Collina | <https://github.com/mcollina/fastq> | APPROVED |
| fdir | 6.5.0 | MIT | thecodrr | <https://github.com/thecodrr/fdir> | APPROVED |
| fflate | 0.8.3 | MIT | Arjun Barrett | <https://github.com/101arrowz/fflate> | APPROVED |
| fill-range | 7.1.1 | MIT | Jon Schlinkert | <jonschlinkert/fill-range> | APPROVED |
| fraction.js | 4.3.7 | MIT | Robert Eisele | <git://github.com/rawify/Fraction.js> | APPROVED |
| function-bind | 1.1.2 | MIT | Raynos | <https://github.com/Raynos/function-bind> | APPROVED |
| gensync | 1.0.0-beta.2 | MIT | Logan Smyth | <https://github.com/loganfsmyth/gensync> | APPROVED |
| glob-parent | 5.1.2 | ISC | Gulp Team | <gulpjs/glob-parent> | APPROVED |
| glob-parent | 6.0.2 | ISC | Gulp Team | <gulpjs/glob-parent> | APPROVED |
| hasown | 2.0.4 | MIT | Jordan Harband | <https://github.com/inspect-js/hasOwn> | APPROVED |
| is-binary-path | 2.1.0 | MIT | Sindre Sorhus | <sindresorhus/is-binary-path> | APPROVED |
| is-core-module | 2.18.0 | MIT | Jordan Harband | <https://github.com/inspect-js/is-core-module> | APPROVED |
| is-extglob | 2.1.1 | MIT | Jon Schlinkert | <jonschlinkert/is-extglob> | APPROVED |
| is-glob | 4.0.3 | MIT | Jon Schlinkert | <micromatch/is-glob> | APPROVED |
| is-number | 7.0.0 | MIT | Jon Schlinkert | <jonschlinkert/is-number> | APPROVED |
| jiti | 1.21.7 | MIT | – | <unjs/jiti> | APPROVED |
| jsesc | 3.1.0 | MIT | Mathias Bynens | <https://github.com/mathiasbynens/jsesc> | APPROVED |
| json5 | 2.2.3 | MIT | Aseem Kishore | <https://github.com/json5/json5> | APPROVED |
| lilconfig | 2.1.0 | MIT | antonk52 | <https://github.com/antonk52/lilconfig> | APPROVED |
| lilconfig | 3.1.5 | MIT | antonk52 | <https://github.com/antonk52/lilconfig> | APPROVED |
| lines-and-columns | 1.2.4 | MIT | Brian Donovan | <https://github.com/eventualbuddha/lines-and-columns> | APPROVED |
| lodash | 4.18.1 | MIT | John-David Dalton | <lodash/lodash> | APPROVED |
| lru-cache | 5.1.1 | ISC | Isaac Z. Schlueter | <git://github.com/isaacs/node-lru-cache> | APPROVED |
| magic-string | 0.30.21 | MIT | Rich Harris | <https://github.com/Rich-Harris/magic-string> | APPROVED |
| merge2 | 1.4.1 | MIT | – | <git@github.com:teambition/merge2> | APPROVED |
| meshoptimizer | 0.18.1 | MIT | Arseny Kapoulkine | <https://github.com/zeux/meshoptimizer> | APPROVED |
| micromatch | 4.0.8 | MIT | Jon Schlinkert | <micromatch/micromatch> | APPROVED |
| moment | 2.31.0 | MIT | – | <https://github.com/moment/moment> | APPROVED |
| ms | 2.1.3 | MIT | – | <vercel/ms> | APPROVED |
| mz | 2.7.0 | MIT | Jonathan Ong | <normalize/mz> | APPROVED |
| nanoid | 3.3.20 | MIT | Andrey Sitnik | <ai/nanoid> | APPROVED |
| node-releases | 2.0.63 | MIT | Sergey Rubanov | <https://github.com/chicoxyzzy/node-releases> | APPROVED |
| normalize-path | 3.0.0 | MIT | Jon Schlinkert | <jonschlinkert/normalize-path> | APPROVED |
| normalize-range | 0.1.2 | MIT | James Talmage | <jamestalmage/normalize-range> | APPROVED |
| object-assign | 4.1.1 | MIT | Sindre Sorhus | <sindresorhus/object-assign> | APPROVED |
| object-hash | 3.0.0 | MIT | Scott Puleo | <https://github.com/puleos/object-hash> | APPROVED |
| package-name-regex | 2.0.6 | MIT | Sebastian Landwehr | <dword-design/package-name-regex> | APPROVED |
| path-parse | 1.0.7 | MIT | Javier Blanco | <https://github.com/jbgutierrez/path-parse> | APPROVED |
| picocolors | 1.1.1 | ISC | Alexey Raspopov | <alexeyraspopov/picocolors> | APPROVED |
| picomatch | 2.3.2 | MIT | Jon Schlinkert | <micromatch/picomatch> | APPROVED |
| picomatch | 4.0.7 | MIT | Jon Schlinkert | <micromatch/picomatch> | APPROVED |
| pirates | 4.0.7 | MIT | Ari Porad | <https://github.com/danez/pirates> | APPROVED |
| postcss | 8.4.47 | MIT | Andrey Sitnik | <postcss/postcss> | APPROVED |
| postcss-import | 15.1.0 | MIT | Maxime Thirouin | <https://github.com/postcss/postcss-import> | APPROVED |
| postcss-js | 4.1.0 | MIT | Andrey Sitnik | <postcss/postcss-js> | APPROVED |
| postcss-load-config | 4.0.2 | MIT | Michael Ciniawky | <postcss/postcss-load-config> | APPROVED |
| postcss-nested | 6.2.0 | MIT | Andrey Sitnik | <postcss/postcss-nested> | APPROVED |
| postcss-selector-parser | 6.1.6 | MIT | – | <https://github.com/postcss/postcss-selector-parser> | APPROVED |
| postcss-value-parser | 4.2.0 | MIT | Bogdan Chadkin | <https://github.com/TrySound/postcss-value-parser> | APPROVED |
| queue-microtask | 1.2.3 | MIT | Feross Aboukhadijeh | <git://github.com/feross/queue-microtask> | APPROVED |
| react-refresh | 0.14.2 | MIT | – | <https://github.com/facebook/react> | APPROVED |
| read-cache | 1.0.2 | MIT | Bogdan Chadkin | <https://github.com/TrySound/read-cache> | APPROVED |
| readdirp | 3.6.0 | MIT | Thorsten Lorenz | <git://github.com/paulmillr/readdirp> | APPROVED |
| resolve | 1.22.14 | MIT | James Halliday | <ssh://github.com/browserify/resolve> | APPROVED |
| reusify | 1.1.0 | MIT | Matteo Collina | <https://github.com/mcollina/reusify> | APPROVED |
| rollup | 4.68.2 | MIT | Rich Harris | <https://github.com/rollup/rollup> | APPROVED |
| rollup-plugin-license | 3.7.2 | MIT | Mickael Jeanroy | <https://github.com/mjeanroy/rollup-plugin-license> | APPROVED |
| run-parallel | 1.2.0 | MIT | Feross Aboukhadijeh | <git://github.com/feross/run-parallel> | APPROVED |
| semver | 6.3.2 | ISC | GitHub Inc. | <https://github.com/npm/node-semver> | APPROVED |
| source-map-js | 1.2.2 | BSD-3-Clause | Valentin 7rulnik Semirulnik | <7rulnik/source-map-js> | APPROVED |
| spdx-compare | 1.0.0 | MIT | Kyle E. Mitchell | <kemitchell/spdx-compare.js> | APPROVED |
| spdx-exceptions | 2.5.0 | CC-BY-3.0 | The Linux Foundation | <kemitchell/spdx-exceptions.json> | REVIEW REQUIRED |
| spdx-expression-parse | 3.0.1 | MIT | Kyle E. Mitchell | <jslicense/spdx-expression-parse.js> | APPROVED |
| spdx-expression-validate | 2.0.0 | (MIT AND CC-BY-3.0) | Kyle E. Mitchell | <kemitchell/spdx-expression-validate.js> | REVIEW REQUIRED |
| spdx-license-ids | 3.0.24 | CC0-1.0 | Shinnosuke Watanabe | <jslicense/spdx-license-ids> | APPROVED |
| spdx-ranges | 2.1.1 | (MIT AND CC-BY-3.0) | The Linux Foundation | <kemitchell/spdx-ranges.js> | REVIEW REQUIRED |
| spdx-satisfies | 5.0.1 | MIT | Kyle E. Mitchell | <kemitchell/spdx-satisfies.js> | APPROVED |
| sucrase | 3.35.1 | MIT | Alan Pierce | <https://github.com/alangpierce/sucrase> | APPROVED |
| supports-preserve-symlinks-flag | 1.0.0 | MIT | Jordan Harband | <https://github.com/inspect-js/node-supports-preserve-symlinks-flag> | APPROVED |
| tailwindcss | 3.4.13 | MIT | – | <https://github.com/tailwindlabs/tailwindcss> | APPROVED |
| thenify | 3.3.1 | MIT | Jonathan Ong | <thenables/thenify> | APPROVED |
| thenify-all | 1.6.0 | MIT | Jonathan Ong | <thenables/thenify-all> | APPROVED |
| tinyglobby | 0.2.17 | MIT | Superchupu | <https://github.com/SuperchupuDev/tinyglobby> | APPROVED |
| to-regex-range | 5.0.1 | MIT | Jon Schlinkert | <micromatch/to-regex-range> | APPROVED |
| ts-interface-checker | 0.1.13 | Apache-2.0 | Dmitry S, Grist Labs | <https://github.com/gristlabs/ts-interface-checker> | APPROVED |
| typescript | 5.6.2 | Apache-2.0 | Microsoft Corp. | <https://github.com/microsoft/TypeScript> | APPROVED |
| update-browserslist-db | 1.3.4 | MIT | Andrey Sitnik | <browserslist/update-db> | APPROVED |
| util-deprecate | 1.0.2 | MIT | Nathan Rajlich | <git://github.com/TooTallNate/util-deprecate> | APPROVED |
| vite | 5.4.8 | MIT | Evan You | <https://github.com/vitejs/vite> | APPROVED |
| yallist | 3.1.1 | ISC | Isaac Z. Schlueter | <https://github.com/isaacs/yallist> | APPROVED |
| yaml | 2.9.1 | ISC | Eemeli Aro | <https://github.com/eemeli/yaml> | APPROVED |
