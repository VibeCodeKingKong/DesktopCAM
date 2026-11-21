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

## Följer med appen (52)

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
| idb | 7.1.1 | ISC | Jake Archibald | <git://github.com/jakearchibald/idb> | APPROVED |
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
| workbox-core | 7.4.1 | MIT | Google's Web DevRel Team and Google's Aurora Team | <https://github.com/googlechrome/workbox> | APPROVED |
| workbox-expiration | 7.4.1 | MIT | Google's Web DevRel Team and Google's Aurora Team | <https://github.com/googlechrome/workbox> | APPROVED |
| workbox-precaching | 7.4.1 | MIT | Google's Web DevRel Team and Google's Aurora Team | <https://github.com/googlechrome/workbox> | APPROVED |
| workbox-routing | 7.4.1 | MIT | Google's Web DevRel Team and Google's Aurora Team | <https://github.com/googlechrome/workbox> | APPROVED |
| workbox-strategies | 7.4.1 | MIT | Google's Web DevRel Team and Google's Aurora Team | <https://github.com/googlechrome/workbox> | APPROVED |
| workbox-window | 7.4.1 | MIT | Google's Web DevRel Team and Google's Aurora Team | <https://github.com/googlechrome/workbox> | APPROVED |
| zustand | 4.5.5 | MIT | Paul Henschel | <https://github.com/pmndrs/zustand> | APPROVED |

## Bara byggverktyg, typer och utveckling – följer inte med appen (471)

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
| @apideck/better-ajv-errors | 0.3.7 | MIT | Apideck | <https://github.com/apideck-libraries/better-ajv-errors> | APPROVED |
| @babel/code-frame | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/compat-data | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/core | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/generator | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/generator | 7.29.15 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-annotate-as-pure | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-compilation-targets | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-create-class-features-plugin | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-create-regexp-features-plugin | 7.29.14 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-define-polyfill-provider | 0.6.8 | MIT | – | <https://github.com/babel/babel-polyfills> | APPROVED |
| @babel/helper-globals | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-member-expression-to-functions | 7.29.14 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-module-imports | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-module-transforms | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-module-transforms | 7.29.14 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-optimise-call-expression | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-plugin-utils | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-remap-async-to-generator | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-replace-supers | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-skip-transparent-expression-wrappers | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-string-parser | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-string-parser | 7.29.15 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-validator-identifier | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-validator-option | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helper-wrap-function | 7.29.15 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/helpers | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/parser | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/parser | 7.29.15 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-bugfix-firefox-class-in-computed-class-key | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-bugfix-safari-class-field-initializer-scope | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-bugfix-safari-id-destructuring-collision-in-function-expression | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-bugfix-safari-rest-destructuring-rhs-array | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-bugfix-v8-static-class-fields-redefine-readonly | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-proposal-private-property-in-object | 7.21.0-placeholder-for-preset-env.2 | MIT | The Babel Team | <https://github.com/babel/babel-plugin-proposal-private-property-in-object> | APPROVED |
| @babel/plugin-syntax-import-assertions | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-syntax-import-attributes | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-syntax-unicode-sets-regex | 7.18.6 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-arrow-functions | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-async-generator-functions | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-async-to-generator | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-block-scoped-functions | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-block-scoping | 7.29.15 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-class-properties | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-class-static-block | 7.29.14 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-classes | 7.29.11 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-computed-properties | 7.29.15 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-destructuring | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-dotall-regex | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-duplicate-keys | 7.29.15 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-duplicate-named-capturing-groups-regex | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-dynamic-import | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-explicit-resource-management | 7.29.15 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-exponentiation-operator | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-export-namespace-from | 7.29.15 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-for-of | 7.29.15 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-function-name | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-json-strings | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-literals | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-logical-assignment-operators | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-member-expression-literals | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-modules-amd | 7.29.14 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-modules-commonjs | 7.29.14 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-modules-systemjs | 7.29.15 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-modules-umd | 7.29.14 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-named-capturing-groups-regex | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-new-target | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-nullish-coalescing-operator | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-numeric-separator | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-object-rest-spread | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-object-super | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-optional-catch-binding | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-optional-chaining | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-parameters | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-private-methods | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-private-property-in-object | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-property-literals | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-react-jsx-self | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-react-jsx-source | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-regenerator | 7.29.15 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-regexp-modifiers | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-reserved-words | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-shorthand-properties | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-spread | 7.29.15 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-sticky-regex | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-template-literals | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-typeof-symbol | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-unicode-escapes | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-unicode-property-regex | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-unicode-regex | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/plugin-transform-unicode-sets-regex | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/preset-env | 7.29.14 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/preset-modules | 0.1.6-no-external-plugins | MIT | – | <https://github.com/babel/preset-modules> | APPROVED |
| @babel/runtime | 7.29.15 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/template | 7.29.7 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/traverse | 7.29.13 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/traverse | 7.29.15 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/types | 7.29.11 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @babel/types | 7.29.15 | MIT | The Babel Team | <https://github.com/babel/babel> | APPROVED |
| @esbuild/linux-x64 | 0.21.5 | MIT | – | <https://github.com/evanw/esbuild> | APPROVED |
| @isaacs/cliui | 9.0.0 | BlueOak-1.0.0 | – | <ssh://git@github.com:isaacs/cliui> | REVIEW REQUIRED |
| @jridgewell/gen-mapping | 0.3.13 | MIT | Justin Ridgewell | <https://github.com/jridgewell/sourcemaps> | APPROVED |
| @jridgewell/remapping | 2.3.5 | MIT | Justin Ridgewell | <https://github.com/jridgewell/sourcemaps> | APPROVED |
| @jridgewell/resolve-uri | 3.1.2 | MIT | Justin Ridgewell | <https://github.com/jridgewell/resolve-uri> | APPROVED |
| @jridgewell/source-map | 0.3.11 | MIT | Justin Ridgewell | <https://github.com/jridgewell/sourcemaps> | APPROVED |
| @jridgewell/sourcemap-codec | 1.6.0 | MIT | Justin Ridgewell | <https://github.com/jridgewell/sourcemaps> | APPROVED |
| @jridgewell/trace-mapping | 0.3.31 | MIT | Justin Ridgewell | <https://github.com/jridgewell/sourcemaps> | APPROVED |
| @nodelib/fs.scandir | 2.1.5 | MIT | – | <https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.scandir> | APPROVED |
| @nodelib/fs.stat | 2.0.5 | MIT | – | <https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.stat> | APPROVED |
| @nodelib/fs.walk | 1.2.8 | MIT | – | <https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.walk> | APPROVED |
| @playwright/test | 1.63.0 | Apache-2.0 | Microsoft Corporation | <https://github.com/microsoft/playwright> | APPROVED |
| @rollup/plugin-babel | 6.1.0 | MIT | Rich Harris | <rollup/plugins> | APPROVED |
| @rollup/plugin-node-resolve | 16.0.3 | MIT | Rich Harris | <rollup/plugins> | APPROVED |
| @rollup/plugin-replace | 6.0.3 | MIT | Rich Harris | <rollup/plugins> | APPROVED |
| @rollup/plugin-terser | 1.0.2 | MIT | Peter Placzek | <rollup/plugins> | APPROVED |
| @rollup/pluginutils | 5.5.1 | MIT | Rich Harris | <rollup/plugins> | APPROVED |
| @rollup/rollup-linux-x64-gnu | 4.68.2 | MIT | Lukas Taegert-Atkinson | <https://github.com/rollup/rollup> | APPROVED |
| @rollup/rollup-linux-x64-musl | 4.68.2 | MIT | Lukas Taegert-Atkinson | <https://github.com/rollup/rollup> | APPROVED |
| @trickfilm400/rollup-plugin-off-main-thread | 3.0.0-pre1 | Apache-2.0 | Surma | <https://github.com/Trickfilm400/rollup-plugin-off-main-thread> | APPROVED |
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
| @types/resolve | 1.20.2 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @types/stats.js | 0.17.4 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @types/three | 0.169.0 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @types/trusted-types | 2.0.7 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @types/webxr | 0.5.24 | MIT | – | <https://github.com/DefinitelyTyped/DefinitelyTyped> | APPROVED |
| @vitejs/plugin-react | 4.3.2 | MIT | Evan You | <https://github.com/vitejs/vite-plugin-react> | APPROVED |
| @vitest/expect | 2.1.9 | MIT | – | <https://github.com/vitest-dev/vitest> | APPROVED |
| @vitest/mocker | 2.1.9 | MIT | – | <https://github.com/vitest-dev/vitest> | APPROVED |
| @vitest/pretty-format | 2.1.9 | MIT | – | <https://github.com/vitest-dev/vitest> | APPROVED |
| @vitest/runner | 2.1.9 | MIT | – | <https://github.com/vitest-dev/vitest> | APPROVED |
| @vitest/snapshot | 2.1.9 | MIT | – | <https://github.com/vitest-dev/vitest> | APPROVED |
| @vitest/spy | 2.1.9 | MIT | – | <https://github.com/vitest-dev/vitest> | APPROVED |
| @vitest/utils | 2.1.9 | MIT | – | <https://github.com/vitest-dev/vitest> | APPROVED |
| @webgpu/types | 0.1.74 | BSD-3-Clause | – | <https://github.com/gpuweb/types> | APPROVED |
| acorn | 8.19.0 | MIT | – | <https://github.com/acornjs/acorn> | APPROVED |
| ajv | 8.20.0 | MIT | Evgeny Poberezkin | <ajv-validator/ajv> | APPROVED |
| any-promise | 1.3.0 | MIT | Kevin Beaty | <https://github.com/kevinbeaty/any-promise> | APPROVED |
| anymatch | 3.1.3 | ISC | Elan Shanker | <https://github.com/micromatch/anymatch> | APPROVED |
| arg | 5.0.2 | MIT | Josh Junon | <vercel/arg> | APPROVED |
| array-buffer-byte-length | 1.0.2 | MIT | Jordan Harband | <https://github.com/inspect-js/array-buffer-byte-length> | APPROVED |
| array-find-index | 1.0.2 | MIT | Sindre Sorhus | <sindresorhus/array-find-index> | APPROVED |
| arraybuffer.prototype.slice | 1.0.4 | MIT | Jordan Harband | <https://github.com/es-shims/ArrayBuffer.prototype.slice> | APPROVED |
| assertion-error | 2.0.1 | MIT | Jake Luer | <git@github.com:chaijs/assertion-error> | APPROVED |
| async | 3.2.6 | MIT | Caolan McMahon | <https://github.com/caolan/async> | APPROVED |
| async-function | 1.0.0 | MIT | Jordan Harbamd | <https://github.com/ljharb/async-function> | APPROVED |
| at-least-node | 1.0.0 | ISC | Ryan Zimmerman | <https://github.com/RyanZim/at-least-node> | APPROVED |
| autoprefixer | 10.4.20 | MIT | Andrey Sitnik | <postcss/autoprefixer> | APPROVED |
| available-typed-arrays | 1.0.7 | MIT | Jordan Harband | <https://github.com/inspect-js/available-typed-arrays> | APPROVED |
| babel-plugin-polyfill-corejs2 | 0.4.17 | MIT | – | <https://github.com/babel/babel-polyfills> | APPROVED |
| babel-plugin-polyfill-corejs3 | 0.14.2 | MIT | – | <https://github.com/babel/babel-polyfills> | APPROVED |
| babel-plugin-polyfill-regenerator | 0.6.8 | MIT | – | <https://github.com/babel/babel-polyfills> | APPROVED |
| balanced-match | 1.0.2 | MIT | Julian Gruber | <git://github.com/juliangruber/balanced-match> | APPROVED |
| balanced-match | 4.0.4 | MIT | – | <git://github.com/juliangruber/balanced-match> | APPROVED |
| baseline-browser-mapping | 2.11.35 | Apache-2.0 | – | <https://github.com/web-platform-dx/baseline-browser-mapping> | APPROVED |
| binary-extensions | 2.3.0 | MIT | Sindre Sorhus | <sindresorhus/binary-extensions> | APPROVED |
| brace-expansion | 2.1.8 | MIT | Julian Gruber | <git://github.com/juliangruber/brace-expansion> | APPROVED |
| brace-expansion | 5.0.13 | MIT | – | <https://github.com/juliangruber/brace-expansion> | APPROVED |
| braces | 3.0.3 | MIT | Jon Schlinkert | <micromatch/braces> | APPROVED |
| browserslist | 4.29.5 | MIT | Andrey Sitnik | <browserslist/browserslist> | APPROVED |
| buffer-from | 1.1.2 | MIT | – | <LinusU/buffer-from> | APPROVED |
| cac | 6.7.14 | MIT | egoist | <egoist/cac> | APPROVED |
| call-bind | 1.0.9 | MIT | Jordan Harband | <https://github.com/ljharb/call-bind> | APPROVED |
| call-bind-apply-helpers | 1.0.2 | MIT | Jordan Harband | <https://github.com/ljharb/call-bind-apply-helpers> | APPROVED |
| call-bound | 1.0.4 | MIT | Jordan Harband | <https://github.com/ljharb/call-bound> | APPROVED |
| camelcase-css | 2.0.1 | MIT | Steven Vachon | <stevenvachon/camelcase-css> | APPROVED |
| caniuse-lite | 1.0.30001823 | CC-BY-4.0 | Ben Briggs | <browserslist/caniuse-lite> | REVIEW REQUIRED |
| chai | 5.3.3 | MIT | Jake Luer | <https://github.com/chaijs/chai> | APPROVED |
| check-error | 2.1.3 | MIT | Jake Luer | <ssh://git@github.com/chaijs/check-error> | APPROVED |
| chokidar | 3.6.0 | MIT | Paul Miller | <https://github.com/paulmillr/chokidar> | APPROVED |
| commander | 2.20.3 | MIT | TJ Holowaychuk | <https://github.com/tj/commander.js> | APPROVED |
| commander | 4.1.1 | MIT | TJ Holowaychuk | <https://github.com/tj/commander.js> | APPROVED |
| commenting | 1.1.0 | MIT | Arnout Kazemier | <https://github.com/3rd-Eden/commenting> | APPROVED |
| common-tags | 1.8.2 | MIT | Declan de Wet | <https://github.com/zspecza/common-tags> | APPROVED |
| convert-source-map | 2.0.0 | MIT | Thorsten Lorenz | <git://github.com/thlorenz/convert-source-map> | APPROVED |
| core-js-compat | 3.51.0 | MIT | Denis Pushkarev | <https://github.com/zloirock/core-js> | APPROVED |
| cross-spawn | 7.0.6 | MIT | André Cruz | <git@github.com:moxystudio/node-cross-spawn> | APPROVED |
| crypto-random-string | 2.0.0 | MIT | Sindre Sorhus | <sindresorhus/crypto-random-string> | APPROVED |
| data-view-buffer | 1.0.2 | MIT | Jordan Harband | <https://github.com/inspect-js/data-view-buffer> | APPROVED |
| data-view-byte-length | 1.0.2 | MIT | Jordan Harband | <https://github.com/inspect-js/data-view-byte-length> | APPROVED |
| data-view-byte-offset | 1.0.1 | MIT | Jordan Harband | <https://github.com/inspect-js/data-view-byte-offset> | APPROVED |
| debug | 4.4.3 | MIT | Josh Junon | <git://github.com/debug-js/debug> | APPROVED |
| deep-eql | 5.0.2 | MIT | Jake Luer | <git@github.com:chaijs/deep-eql> | APPROVED |
| deepmerge | 4.3.1 | MIT | – | <git://github.com/TehShrike/deepmerge> | APPROVED |
| define-data-property | 1.1.4 | MIT | Jordan Harband | <https://github.com/ljharb/define-data-property> | APPROVED |
| define-properties | 1.2.1 | MIT | Jordan Harband | <git://github.com/ljharb/define-properties> | APPROVED |
| didyoumean | 1.2.2 | Apache-2.0 | Dave Porter | <https://github.com/dcporter/didyoumean.js> | APPROVED |
| dlv | 1.1.3 | MIT | Jason Miller | <developit/dlv> | APPROVED |
| dunder-proto | 1.0.1 | MIT | Jordan Harband | <https://github.com/es-shims/dunder-proto> | APPROVED |
| ejs | 3.1.10 | Apache-2.0 | Matthew Eernisse | <git://github.com/mde/ejs> | APPROVED |
| electron-to-chromium | 1.5.479 | ISC | Kilian Valkhof | <https://github.com/Kilian/electron-to-chromium> | APPROVED |
| es-abstract | 1.24.2 | MIT | Jordan Harband | <git://github.com/ljharb/es-abstract> | APPROVED |
| es-abstract-get | 1.0.0 | MIT | Jordan Harband | <https://github.com/ljharb/es-abstract-get> | APPROVED |
| es-define-property | 1.0.1 | MIT | Jordan Harband | <https://github.com/ljharb/es-define-property> | APPROVED |
| es-errors | 1.3.0 | MIT | Jordan Harband | <https://github.com/ljharb/es-errors> | APPROVED |
| es-module-lexer | 1.7.0 | MIT | Guy Bedford | <https://github.com/guybedford/es-module-lexer> | APPROVED |
| es-object-atoms | 1.1.2 | MIT | Jordan Harband | <https://github.com/ljharb/es-object-atoms> | APPROVED |
| es-set-tostringtag | 2.1.0 | MIT | Jordan Harband | <https://github.com/es-shims/es-set-tostringtag> | APPROVED |
| es-to-primitive | 1.3.4 | MIT | Jordan Harband | <git://github.com/ljharb/es-to-primitive> | APPROVED |
| esbuild | 0.21.5 | MIT | – | <https://github.com/evanw/esbuild> | APPROVED |
| escalade | 3.2.0 | MIT | Luke Edwards | <lukeed/escalade> | APPROVED |
| estree-walker | 2.0.2 | MIT | Rich Harris | <https://github.com/Rich-Harris/estree-walker> | APPROVED |
| estree-walker | 3.0.3 | MIT | Rich Harris | <https://github.com/Rich-Harris/estree-walker> | APPROVED |
| esutils | 2.0.3 | BSD-2-Clause | – | <http://github.com/estools/esutils> | APPROVED |
| eta | 4.6.0 | MIT | Ben Gubler | <https://github.com/bgub/eta> | APPROVED |
| expect-type | 1.4.0 | Apache-2.0 | – | <https://github.com/mmkal/expect-type> | APPROVED |
| fast-deep-equal | 3.1.3 | MIT | Evgeny Poberezkin | <https://github.com/epoberezkin/fast-deep-equal> | APPROVED |
| fast-glob | 3.3.3 | MIT | Denis Malinochkin | <mrmlnc/fast-glob> | APPROVED |
| fast-json-stable-stringify | 2.1.0 | MIT | James Halliday | <git://github.com/epoberezkin/fast-json-stable-stringify> | APPROVED |
| fast-uri | 3.1.9 | BSD-3-Clause | Vincent Le Goff | <https://github.com/fastify/fast-uri> | APPROVED |
| fastq | 1.20.3 | ISC | Matteo Collina | <https://github.com/mcollina/fastq> | APPROVED |
| fdir | 6.5.0 | MIT | thecodrr | <https://github.com/thecodrr/fdir> | APPROVED |
| fflate | 0.8.3 | MIT | Arjun Barrett | <https://github.com/101arrowz/fflate> | APPROVED |
| filelist | 1.0.6 | Apache-2.0 | Matthew Eernisse | <git://github.com/mde/filelist> | APPROVED |
| fill-range | 7.1.1 | MIT | Jon Schlinkert | <jonschlinkert/fill-range> | APPROVED |
| for-each | 0.3.5 | MIT | Raynos | <https://github.com/Raynos/for-each> | APPROVED |
| foreground-child | 3.3.1 | ISC | Isaac Z. Schlueter | <https://github.com/tapjs/foreground-child> | APPROVED |
| fraction.js | 4.3.7 | MIT | Robert Eisele | <git://github.com/rawify/Fraction.js> | APPROVED |
| fs-extra | 9.1.0 | MIT | JP Richardson | <https://github.com/jprichardson/node-fs-extra> | APPROVED |
| function-bind | 1.1.2 | MIT | Raynos | <https://github.com/Raynos/function-bind> | APPROVED |
| function.prototype.name | 1.2.0 | MIT | Jordan Harband | <git://github.com/es-shims/Function.prototype.name> | APPROVED |
| functions-have-names | 1.2.3 | MIT | Jordan Harband | <https://github.com/inspect-js/functions-have-names> | APPROVED |
| generator-function | 2.0.1 | MIT | Jordan Harbamd | <https://github.com/TimothyGu/generator-function> | APPROVED |
| gensync | 1.0.0-beta.2 | MIT | Logan Smyth | <https://github.com/loganfsmyth/gensync> | APPROVED |
| get-intrinsic | 1.3.0 | MIT | Jordan Harband | <https://github.com/ljharb/get-intrinsic> | APPROVED |
| get-own-enumerable-property-symbols | 3.0.2 | ISC | Shahar Or | <https://github.com/mightyiam/get-own-enumerable-property-symbols> | APPROVED |
| get-proto | 1.0.1 | MIT | Jordan Harband | <https://github.com/ljharb/get-proto> | APPROVED |
| get-symbol-description | 1.1.0 | MIT | Jordan Harband | <https://github.com/inspect-js/get-symbol-description> | APPROVED |
| glob | 11.1.0 | BlueOak-1.0.0 | Isaac Z. Schlueter | <git@github.com:isaacs/node-glob> | REVIEW REQUIRED |
| glob-parent | 5.1.2 | ISC | Gulp Team | <gulpjs/glob-parent> | APPROVED |
| glob-parent | 6.0.2 | ISC | Gulp Team | <gulpjs/glob-parent> | APPROVED |
| globalthis | 1.0.4 | MIT | Jordan Harband | <git://github.com/ljharb/System.global> | APPROVED |
| gopd | 1.2.0 | MIT | Jordan Harband | <https://github.com/ljharb/gopd> | APPROVED |
| graceful-fs | 4.2.12 | BlueOak-1.0.0 | – | <https://github.com/isaacs/node-graceful-fs> | REVIEW REQUIRED |
| has-bigints | 1.1.0 | MIT | Jordan Harband | <https://github.com/ljharb/has-bigints> | APPROVED |
| has-property-descriptors | 1.0.2 | MIT | Jordan Harband | <https://github.com/inspect-js/has-property-descriptors> | APPROVED |
| has-proto | 1.2.0 | MIT | Jordan Harband | <https://github.com/inspect-js/has-proto> | APPROVED |
| has-symbols | 1.1.0 | MIT | Jordan Harband | <git://github.com/inspect-js/has-symbols> | APPROVED |
| has-tostringtag | 1.0.2 | MIT | Jordan Harband | <https://github.com/inspect-js/has-tostringtag> | APPROVED |
| hasown | 2.0.4 | MIT | Jordan Harband | <https://github.com/inspect-js/hasOwn> | APPROVED |
| internal-slot | 1.1.0 | MIT | Jordan Harband | <https://github.com/ljharb/internal-slot> | APPROVED |
| is-array-buffer | 3.0.5 | MIT | Jordan Harband | <https://github.com/inspect-js/is-array-buffer> | APPROVED |
| is-async-function | 2.1.1 | MIT | Jordan Harband | <git://github.com/inspect-js/is-async-function> | APPROVED |
| is-bigint | 1.1.0 | MIT | Jordan Harband | <https://github.com/inspect-js/is-bigint> | APPROVED |
| is-binary-path | 2.1.0 | MIT | Sindre Sorhus | <sindresorhus/is-binary-path> | APPROVED |
| is-boolean-object | 1.2.2 | MIT | Jordan Harband | <git://github.com/inspect-js/is-boolean-object> | APPROVED |
| is-callable | 1.2.7 | MIT | Jordan Harband | <git://github.com/inspect-js/is-callable> | APPROVED |
| is-core-module | 2.18.0 | MIT | Jordan Harband | <https://github.com/inspect-js/is-core-module> | APPROVED |
| is-data-view | 1.0.2 | MIT | Jordan Harband | <https://github.com/inspect-js/is-data-view> | APPROVED |
| is-date-object | 1.1.0 | MIT | Jordan Harband | <git://github.com/inspect-js/is-date-object> | APPROVED |
| is-document.all | 1.0.0 | MIT | Jordan Harband | <https://github.com/inspect-js/is-document.all> | APPROVED |
| is-extglob | 2.1.1 | MIT | Jon Schlinkert | <jonschlinkert/is-extglob> | APPROVED |
| is-finalizationregistry | 1.1.1 | MIT | Jordan Harband | <https://github.com/inspect-js/is-finalizationregistry> | APPROVED |
| is-generator-function | 1.1.2 | MIT | Jordan Harband | <git://github.com/inspect-js/is-generator-function> | APPROVED |
| is-glob | 4.0.3 | MIT | Jon Schlinkert | <micromatch/is-glob> | APPROVED |
| is-map | 2.0.3 | MIT | Jordan Harband | <https://github.com/inspect-js/is-map> | APPROVED |
| is-module | 1.0.0 | MIT | Jonathan Ong | <component/is-module> | APPROVED |
| is-negative-zero | 2.0.3 | MIT | Jordan Harband | <git://github.com/inspect-js/is-negative-zero> | APPROVED |
| is-number | 7.0.0 | MIT | Jon Schlinkert | <jonschlinkert/is-number> | APPROVED |
| is-number-object | 1.1.1 | MIT | Jordan Harband | <git://github.com/inspect-js/is-number-object> | APPROVED |
| is-obj | 1.0.1 | MIT | Sindre Sorhus | <sindresorhus/is-obj> | APPROVED |
| is-regex | 1.2.1 | MIT | Jordan Harband | <git://github.com/inspect-js/is-regex> | APPROVED |
| is-regexp | 1.0.0 | MIT | Sindre Sorhus | <sindresorhus/is-regexp> | APPROVED |
| is-set | 2.0.3 | MIT | Jordan Harband | <https://github.com/inspect-js/is-set> | APPROVED |
| is-shared-array-buffer | 1.0.4 | MIT | Jordan Harband | <https://github.com/inspect-js/is-shared-array-buffer> | APPROVED |
| is-stream | 2.0.1 | MIT | Sindre Sorhus | <sindresorhus/is-stream> | APPROVED |
| is-string | 1.1.1 | MIT | Jordan Harband | <git://github.com/inspect-js/is-string> | APPROVED |
| is-symbol | 1.1.1 | MIT | Jordan Harband | <git://github.com/inspect-js/is-symbol> | APPROVED |
| is-typed-array | 1.1.15 | MIT | Jordan Harband | <git://github.com/inspect-js/is-typed-array> | APPROVED |
| is-weakmap | 2.0.2 | MIT | Jordan Harband | <https://github.com/inspect-js/is-weakmap> | APPROVED |
| is-weakref | 1.1.1 | MIT | Jordan Harband | <https://github.com/inspect-js/is-weakref> | APPROVED |
| is-weakset | 2.0.4 | MIT | Jordan Harband | <https://github.com/inspect-js/is-weakset> | APPROVED |
| isarray | 2.0.5 | MIT | Julian Gruber | <git://github.com/juliangruber/isarray> | APPROVED |
| isexe | 2.0.0 | ISC | Isaac Z. Schlueter | <https://github.com/isaacs/isexe> | APPROVED |
| jackspeak | 4.2.3 | BlueOak-1.0.0 | Isaac Z. Schlueter | <https://github.com/isaacs/jackspeak> | REVIEW REQUIRED |
| jake | 10.9.4 | Apache-2.0 | Matthew Eernisse | <git://github.com/jakejs/jake> | APPROVED |
| jiti | 1.21.7 | MIT | – | <unjs/jiti> | APPROVED |
| jsesc | 3.1.0 | MIT | Mathias Bynens | <https://github.com/mathiasbynens/jsesc> | APPROVED |
| json-schema-traverse | 1.0.0 | MIT | Evgeny Poberezkin | <https://github.com/epoberezkin/json-schema-traverse> | APPROVED |
| json5 | 2.2.3 | MIT | Aseem Kishore | <https://github.com/json5/json5> | APPROVED |
| jsonfile | 6.2.1 | MIT | JP Richardson | <git@github.com:jprichardson/node-jsonfile> | APPROVED |
| jsonpointer | 5.0.1 | MIT | Jan Lehnardt | <https://github.com/janl/node-jsonpointer> | APPROVED |
| leven | 3.1.0 | MIT | Sindre Sorhus | <sindresorhus/leven> | APPROVED |
| lilconfig | 2.1.0 | MIT | antonk52 | <https://github.com/antonk52/lilconfig> | APPROVED |
| lilconfig | 3.1.5 | MIT | antonk52 | <https://github.com/antonk52/lilconfig> | APPROVED |
| lines-and-columns | 1.2.4 | MIT | Brian Donovan | <https://github.com/eventualbuddha/lines-and-columns> | APPROVED |
| lodash | 4.18.1 | MIT | John-David Dalton | <lodash/lodash> | APPROVED |
| lodash.debounce | 4.0.8 | MIT | John-David Dalton | <lodash/lodash> | APPROVED |
| loupe | 3.2.1 | MIT | Veselin Todorov | <https://github.com/chaijs/loupe> | APPROVED |
| lru-cache | 11.5.3 | BlueOak-1.0.0 | Isaac Z. Schlueter | <ssh://git@github.com/isaacs/node-lru-cache> | REVIEW REQUIRED |
| lru-cache | 5.1.1 | ISC | Isaac Z. Schlueter | <git://github.com/isaacs/node-lru-cache> | APPROVED |
| magic-string | 0.30.21 | MIT | Rich Harris | <https://github.com/Rich-Harris/magic-string> | APPROVED |
| math-intrinsics | 1.1.0 | MIT | Jordan Harband | <https://github.com/es-shims/math-intrinsics> | APPROVED |
| merge2 | 1.4.1 | MIT | – | <git@github.com:teambition/merge2> | APPROVED |
| meshoptimizer | 0.18.1 | MIT | Arseny Kapoulkine | <https://github.com/zeux/meshoptimizer> | APPROVED |
| micromatch | 4.0.8 | MIT | Jon Schlinkert | <micromatch/micromatch> | APPROVED |
| minimatch | 10.2.6 | BlueOak-1.0.0 | Isaac Z. Schlueter | <git@github.com:isaacs/minimatch> | REVIEW REQUIRED |
| minimatch | 5.1.9 | ISC | Isaac Z. Schlueter | <git://github.com/isaacs/minimatch> | APPROVED |
| minipass | 7.1.3 | BlueOak-1.0.0 | Isaac Z. Schlueter | <https://github.com/isaacs/minipass> | REVIEW REQUIRED |
| moment | 2.31.0 | MIT | – | <https://github.com/moment/moment> | APPROVED |
| ms | 2.1.3 | MIT | – | <vercel/ms> | APPROVED |
| mz | 2.7.0 | MIT | Jonathan Ong | <normalize/mz> | APPROVED |
| nanoid | 3.3.20 | MIT | Andrey Sitnik | <ai/nanoid> | APPROVED |
| node-releases | 2.0.63 | MIT | Sergey Rubanov | <https://github.com/chicoxyzzy/node-releases> | APPROVED |
| normalize-path | 3.0.0 | MIT | Jon Schlinkert | <jonschlinkert/normalize-path> | APPROVED |
| normalize-range | 0.1.2 | MIT | James Talmage | <jamestalmage/normalize-range> | APPROVED |
| object-assign | 4.1.1 | MIT | Sindre Sorhus | <sindresorhus/object-assign> | APPROVED |
| object-hash | 3.0.0 | MIT | Scott Puleo | <https://github.com/puleos/object-hash> | APPROVED |
| object-inspect | 1.14.0 | MIT | James Halliday | <ssh://github.com/inspect-js/object-inspect> | APPROVED |
| object-keys | 1.1.1 | MIT | Jordan Harband | <git://github.com/ljharb/object-keys> | APPROVED |
| object.assign | 4.1.7 | MIT | Jordan Harband | <git://github.com/ljharb/object.assign> | APPROVED |
| own-keys | 1.0.2 | MIT | Jordan Harband | <https://github.com/ljharb/own-keys> | APPROVED |
| package-json-from-dist | 1.0.1 | BlueOak-1.0.0 | Isaac Z. Schlueter | <https://github.com/isaacs/package-json-from-dist> | REVIEW REQUIRED |
| package-name-regex | 2.0.6 | MIT | Sebastian Landwehr | <dword-design/package-name-regex> | APPROVED |
| path-key | 3.1.1 | MIT | Sindre Sorhus | <sindresorhus/path-key> | APPROVED |
| path-parse | 1.0.7 | MIT | Javier Blanco | <https://github.com/jbgutierrez/path-parse> | APPROVED |
| path-scurry | 2.0.2 | BlueOak-1.0.0 | Isaac Z. Schlueter | <https://github.com/isaacs/path-scurry> | REVIEW REQUIRED |
| pathe | 1.1.2 | MIT | – | <unjs/pathe> | APPROVED |
| pathval | 2.0.1 | MIT | Veselin Todorov | <ssh://git@github.com/chaijs/pathval> | APPROVED |
| picocolors | 1.1.1 | ISC | Alexey Raspopov | <alexeyraspopov/picocolors> | APPROVED |
| picomatch | 2.3.2 | MIT | Jon Schlinkert | <micromatch/picomatch> | APPROVED |
| picomatch | 4.0.7 | MIT | Jon Schlinkert | <micromatch/picomatch> | APPROVED |
| pirates | 4.0.7 | MIT | Ari Porad | <https://github.com/danez/pirates> | APPROVED |
| playwright | 1.63.0 | Apache-2.0 | Microsoft Corporation | <https://github.com/microsoft/playwright> | APPROVED |
| playwright-core | 1.63.0 | Apache-2.0 | Microsoft Corporation | <https://github.com/microsoft/playwright> | APPROVED |
| possible-typed-array-names | 1.1.0 | MIT | Jordan Harband | <https://github.com/ljharb/possible-typed-array-names> | APPROVED |
| postcss | 8.4.47 | MIT | Andrey Sitnik | <postcss/postcss> | APPROVED |
| postcss-import | 15.1.0 | MIT | Maxime Thirouin | <https://github.com/postcss/postcss-import> | APPROVED |
| postcss-js | 4.1.0 | MIT | Andrey Sitnik | <postcss/postcss-js> | APPROVED |
| postcss-load-config | 4.0.2 | MIT | Michael Ciniawky | <postcss/postcss-load-config> | APPROVED |
| postcss-nested | 6.2.0 | MIT | Andrey Sitnik | <postcss/postcss-nested> | APPROVED |
| postcss-selector-parser | 6.1.6 | MIT | – | <https://github.com/postcss/postcss-selector-parser> | APPROVED |
| postcss-value-parser | 4.2.0 | MIT | Bogdan Chadkin | <https://github.com/TrySound/postcss-value-parser> | APPROVED |
| pretty-bytes | 5.6.0 | MIT | Sindre Sorhus | <sindresorhus/pretty-bytes> | APPROVED |
| pretty-bytes | 6.1.1 | MIT | Sindre Sorhus | <sindresorhus/pretty-bytes> | APPROVED |
| queue-microtask | 1.2.3 | MIT | Feross Aboukhadijeh | <git://github.com/feross/queue-microtask> | APPROVED |
| react-refresh | 0.14.2 | MIT | – | <https://github.com/facebook/react> | APPROVED |
| read-cache | 1.0.2 | MIT | Bogdan Chadkin | <https://github.com/TrySound/read-cache> | APPROVED |
| readdirp | 3.6.0 | MIT | Thorsten Lorenz | <git://github.com/paulmillr/readdirp> | APPROVED |
| reflect.getprototypeof | 1.0.10 | MIT | Jordan Harband | <https://github.com/es-shims/Reflect.getPrototypeOf> | APPROVED |
| regenerate | 1.5.0 | MIT | Mathias Bynens | <https://github.com/mathiasbynens/regenerate> | APPROVED |
| regenerate-unicode-properties | 10.3.0 | MIT | Mathias Bynens | <https://github.com/mathiasbynens/regenerate-unicode-properties> | APPROVED |
| regexp.prototype.flags | 1.5.4 | MIT | Jordan Harband | <git://github.com/es-shims/RegExp.prototype.flags> | APPROVED |
| regexpu-core | 6.5.4 | MIT | Mathias Bynens | <https://github.com/mathiasbynens/regexpu-core> | APPROVED |
| regjsgen | 0.8.0 | MIT | Benjamin Tan | <https://github.com/bnjmnt4n/regjsgen> | APPROVED |
| regjsparser | 0.14.1 | BSD-2-Clause | 'Julian Viereck' | <ssh://git@github.com/jviereck/regjsparser> | APPROVED |
| require-from-string | 2.0.2 | MIT | Vsevolod Strukchinsky | <floatdrop/require-from-string> | APPROVED |
| resolve | 1.22.14 | MIT | James Halliday | <ssh://github.com/browserify/resolve> | APPROVED |
| reusify | 1.1.0 | MIT | Matteo Collina | <https://github.com/mcollina/reusify> | APPROVED |
| rollup | 4.68.2 | MIT | Rich Harris | <https://github.com/rollup/rollup> | APPROVED |
| rollup-plugin-license | 3.7.2 | MIT | Mickael Jeanroy | <https://github.com/mjeanroy/rollup-plugin-license> | APPROVED |
| run-parallel | 1.2.0 | MIT | Feross Aboukhadijeh | <git://github.com/feross/run-parallel> | APPROVED |
| safe-array-concat | 1.1.4 | MIT | Jordan Harband | <https://github.com/ljharb/safe-array-concat> | APPROVED |
| safe-push-apply | 1.0.0 | MIT | Jordan Harband | <https://github.com/ljharb/safe-push-apply> | APPROVED |
| safe-regex-test | 1.1.0 | MIT | Jordan Harband | <https://github.com/ljharb/safe-regex-test> | APPROVED |
| semver | 6.3.2 | ISC | GitHub Inc. | <https://github.com/npm/node-semver> | APPROVED |
| serialize-javascript | 7.1.4 | BSD-3-Clause | Eric Ferraiuolo | <https://github.com/yahoo/serialize-javascript> | APPROVED |
| set-function-length | 1.2.2 | MIT | Jordan Harband | <https://github.com/ljharb/set-function-length> | APPROVED |
| set-function-name | 2.0.2 | MIT | Jordan Harband | <https://github.com/ljharb/set-function-name> | APPROVED |
| set-proto | 1.0.0 | MIT | Jordan Harband | <https://github.com/ljharb/set-proto> | APPROVED |
| shebang-command | 2.0.0 | MIT | Kevin Mårtensson | <kevva/shebang-command> | APPROVED |
| shebang-regex | 3.0.0 | MIT | Sindre Sorhus | <sindresorhus/shebang-regex> | APPROVED |
| side-channel | 1.1.1 | MIT | Jordan Harband | <https://github.com/ljharb/side-channel> | APPROVED |
| side-channel-list | 1.0.1 | MIT | Jordan Harband | <https://github.com/ljharb/side-channel-list> | APPROVED |
| side-channel-map | 1.0.1 | MIT | Jordan Harband | <https://github.com/ljharb/side-channel-map> | APPROVED |
| side-channel-weakmap | 1.0.2 | MIT | Jordan Harband | <https://github.com/ljharb/side-channel-weakmap> | APPROVED |
| siginfo | 2.0.0 | ISC | Emil Bay | <https://github.com/emilbayes/siginfo> | APPROVED |
| signal-exit | 4.1.0 | ISC | Ben Coe | <https://github.com/tapjs/signal-exit> | APPROVED |
| smob | 1.6.2 | MIT | Peter Placzek | <https://github.com/Tada5hi/smob> | APPROVED |
| source-map | 0.6.1 | BSD-3-Clause | Nick Fitzgerald | <http://github.com/mozilla/source-map> | APPROVED |
| source-map | 0.8.0 | BSD-3-Clause | Nick Fitzgerald | <ssh://git@github.com/mozilla/source-map> | APPROVED |
| source-map-js | 1.2.2 | BSD-3-Clause | Valentin 7rulnik Semirulnik | <7rulnik/source-map-js> | APPROVED |
| source-map-support | 0.5.21 | MIT | – | <https://github.com/evanw/node-source-map-support> | APPROVED |
| spdx-compare | 1.0.0 | MIT | Kyle E. Mitchell | <kemitchell/spdx-compare.js> | APPROVED |
| spdx-exceptions | 2.5.0 | CC-BY-3.0 | The Linux Foundation | <kemitchell/spdx-exceptions.json> | REVIEW REQUIRED |
| spdx-expression-parse | 3.0.1 | MIT | Kyle E. Mitchell | <jslicense/spdx-expression-parse.js> | APPROVED |
| spdx-expression-validate | 2.0.0 | (MIT AND CC-BY-3.0) | Kyle E. Mitchell | <kemitchell/spdx-expression-validate.js> | REVIEW REQUIRED |
| spdx-license-ids | 3.0.24 | CC0-1.0 | Shinnosuke Watanabe | <jslicense/spdx-license-ids> | APPROVED |
| spdx-ranges | 2.1.1 | (MIT AND CC-BY-3.0) | The Linux Foundation | <kemitchell/spdx-ranges.js> | REVIEW REQUIRED |
| spdx-satisfies | 5.0.1 | MIT | Kyle E. Mitchell | <kemitchell/spdx-satisfies.js> | APPROVED |
| stackback | 0.0.2 | MIT | Roman Shtylman | <git://github.com/shtylman/node-stackback> | APPROVED |
| std-env | 3.10.0 | MIT | – | <unjs/std-env> | APPROVED |
| stop-iteration-iterator | 1.1.0 | MIT | Jordan Harband | <https://github.com/ljharb/stop-iteration-iterator> | APPROVED |
| string.prototype.matchall | 4.1.0 | MIT | Jordan Harband | <https://github.com/es-shims/String.prototype.matchAll> | APPROVED |
| string.prototype.trim | 1.2.11 | MIT | Jordan Harband | <git://github.com/es-shims/String.prototype.trim> | APPROVED |
| string.prototype.trimend | 1.0.10 | MIT | Jordan Harband | <git://github.com/es-shims/String.prototype.trimEnd> | APPROVED |
| string.prototype.trimstart | 1.0.8 | MIT | Jordan Harband | <git://github.com/es-shims/String.prototype.trimStart> | APPROVED |
| stringify-object | 3.3.0 | BSD-2-Clause | Sindre Sorhus | <yeoman/stringify-object> | APPROVED |
| strip-comments | 2.0.1 | MIT | Jon Schlinkert | <jonschlinkert/strip-comments> | APPROVED |
| sucrase | 3.35.1 | MIT | Alan Pierce | <https://github.com/alangpierce/sucrase> | APPROVED |
| supports-preserve-symlinks-flag | 1.0.0 | MIT | Jordan Harband | <https://github.com/inspect-js/node-supports-preserve-symlinks-flag> | APPROVED |
| tailwindcss | 3.4.13 | MIT | – | <https://github.com/tailwindlabs/tailwindcss> | APPROVED |
| temp-dir | 2.0.0 | MIT | Sindre Sorhus | <sindresorhus/temp-dir> | APPROVED |
| tempy | 0.6.0 | MIT | Sindre Sorhus | <sindresorhus/tempy> | APPROVED |
| terser | 5.51.4 | BSD-2-Clause | Mihai Bazon | <https://github.com/terser/terser> | APPROVED |
| thenify | 3.3.1 | MIT | Jonathan Ong | <thenables/thenify> | APPROVED |
| thenify-all | 1.6.0 | MIT | Jonathan Ong | <thenables/thenify-all> | APPROVED |
| tinybench | 2.9.0 | MIT | – | <tinylibs/tinybench> | APPROVED |
| tinyexec | 0.3.2 | MIT | James Garbutt | <https://github.com/tinylibs/tinyexec> | APPROVED |
| tinyglobby | 0.2.17 | MIT | Superchupu | <https://github.com/SuperchupuDev/tinyglobby> | APPROVED |
| tinypool | 1.1.1 | MIT | – | <https://github.com/tinylibs/tinypool> | APPROVED |
| tinyrainbow | 1.2.0 | MIT | – | <https://github.com/tinylibs/tinyrainbow> | APPROVED |
| tinyspy | 3.0.2 | MIT | – | <https://github.com/tinylibs/tinyspy> | APPROVED |
| to-regex-range | 5.0.1 | MIT | Jon Schlinkert | <micromatch/to-regex-range> | APPROVED |
| ts-interface-checker | 0.1.13 | Apache-2.0 | Dmitry S, Grist Labs | <https://github.com/gristlabs/ts-interface-checker> | APPROVED |
| type-fest | 0.16.0 | (MIT OR CC0-1.0) | Sindre Sorhus | <sindresorhus/type-fest> | APPROVED |
| typed-array-buffer | 1.0.3 | MIT | Jordan Harband | <https://github.com/inspect-js/typed-array-buffer> | APPROVED |
| typed-array-byte-length | 1.0.3 | MIT | Jordan Harband | <https://github.com/inspect-js/typed-array-byte-length> | APPROVED |
| typed-array-byte-offset | 1.0.5 | MIT | Jordan Harband | <https://github.com/inspect-js/typed-array-byte-offset> | APPROVED |
| typed-array-length | 1.0.8 | MIT | Jordan Harband | <https://github.com/inspect-js/typed-array-length> | APPROVED |
| typescript | 5.6.2 | Apache-2.0 | Microsoft Corp. | <https://github.com/microsoft/TypeScript> | APPROVED |
| unbox-primitive | 1.1.0 | MIT | Jordan Harband | <https://github.com/ljharb/unbox-primitive> | APPROVED |
| unicode-canonical-property-names-ecmascript | 2.0.1 | MIT | Mathias Bynens | <https://github.com/mathiasbynens/unicode-canonical-property-names-ecmascript> | APPROVED |
| unicode-match-property-ecmascript | 2.0.0 | MIT | Mathias Bynens | <https://github.com/mathiasbynens/unicode-match-property-ecmascript> | APPROVED |
| unicode-match-property-value-ecmascript | 2.2.1 | MIT | Mathias Bynens | <https://github.com/mathiasbynens/unicode-match-property-value-ecmascript> | APPROVED |
| unicode-property-aliases-ecmascript | 2.2.0 | MIT | Mathias Bynens | <https://github.com/mathiasbynens/unicode-property-aliases-ecmascript> | APPROVED |
| unique-string | 2.0.0 | MIT | Sindre Sorhus | <sindresorhus/unique-string> | APPROVED |
| universalify | 2.0.1 | MIT | Ryan Zimmerman | <https://github.com/RyanZim/universalify> | APPROVED |
| upath | 1.2.0 | MIT | Angelos Pikoulas | <git://github.com/anodynos/upath> | APPROVED |
| update-browserslist-db | 1.3.4 | MIT | Andrey Sitnik | <browserslist/update-db> | APPROVED |
| util-deprecate | 1.0.2 | MIT | Nathan Rajlich | <git://github.com/TooTallNate/util-deprecate> | APPROVED |
| vite | 5.4.8 | MIT | Evan You | <https://github.com/vitejs/vite> | APPROVED |
| vite-node | 2.1.9 | MIT | Anthony Fu | <https://github.com/vitest-dev/vitest> | APPROVED |
| vite-plugin-pwa | 2.0.0 | MIT | antfu | <https://github.com/vite-pwa/vite-plugin-pwa> | APPROVED |
| vitest | 2.1.9 | MIT | Anthony Fu | <https://github.com/vitest-dev/vitest> | APPROVED |
| which | 2.0.2 | ISC | Isaac Z. Schlueter | <git://github.com/isaacs/node-which> | APPROVED |
| which-boxed-primitive | 1.1.1 | MIT | Jordan Harband | <https://github.com/inspect-js/which-boxed-primitive> | APPROVED |
| which-builtin-type | 1.2.1 | MIT | Jordan Harband | <https://github.com/inspect-js/which-builtin-type> | APPROVED |
| which-collection | 1.0.2 | MIT | Jordan Harband | <https://github.com/inspect-js/which-collection> | APPROVED |
| which-typed-array | 1.1.24 | MIT | Jordan Harband | <git://github.com/inspect-js/which-typed-array> | APPROVED |
| why-is-node-running | 2.3.0 | MIT | Mathias Buus | <https://github.com/mafintosh/why-is-node-running> | APPROVED |
| workbox-background-sync | 7.4.1 | MIT | Google's Web DevRel Team and Google's Aurora Team | <https://github.com/googlechrome/workbox> | APPROVED |
| workbox-broadcast-update | 7.4.1 | MIT | Google's Web DevRel Team and Google's Aurora Team | <https://github.com/googlechrome/workbox> | APPROVED |
| workbox-build | 7.4.1 | MIT | Google's Web DevRel Team and Google's Aurora Team | <https://github.com/googlechrome/workbox> | APPROVED |
| workbox-cacheable-response | 7.4.1 | MIT | Google's Web DevRel Team and Google's Aurora Team | <https://github.com/googlechrome/workbox> | APPROVED |
| workbox-google-analytics | 7.4.1 | MIT | Google's Web DevRel Team and Google's Aurora Team | <https://github.com/googlechrome/workbox> | APPROVED |
| workbox-navigation-preload | 7.4.1 | MIT | Google's Web DevRel Team and Google's Aurora Team | <https://github.com/googlechrome/workbox> | APPROVED |
| workbox-range-requests | 7.4.1 | MIT | Google's Web DevRel Team and Google's Aurora Team | <https://github.com/googlechrome/workbox> | APPROVED |
| workbox-recipes | 7.4.1 | MIT | Google's Web DevRel Team and Google's Aurora Team | <https://github.com/googlechrome/workbox> | APPROVED |
| workbox-streams | 7.4.1 | MIT | Google's Web DevRel Team and Google's Aurora Team | <https://github.com/googlechrome/workbox> | APPROVED |
| workbox-sw | 7.4.1 | MIT | Google's Web DevRel Team and Google's Aurora Team | <https://github.com/googlechrome/workbox> | APPROVED |
| yallist | 3.1.1 | ISC | Isaac Z. Schlueter | <https://github.com/isaacs/yallist> | APPROVED |
| yaml | 2.9.1 | ISC | Eemeli Aro | <https://github.com/eemeli/yaml> | APPROVED |
