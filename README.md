# desktopCAM

Webbaserad CAD/CAM för hobbyfräsar och diodlasrar. Allt körs lokalt i webbläsaren:
React-gränssnitt med Ribbon-meny, Three.js-vy och en CAM-motor i Rust/WebAssembly
som körs i en Web Worker. Ingen maskinstyrning – programmet ritar, beräknar och
exporterar `.gcode`.

## Kom igång

Kräver Node 20+ och pnpm 9.

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

Appen fungerar direkt med TypeScript-motorn. För att köra den riktiga Wasm-motorn:

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
pnpm wasm:build     # bygger crates/cam-engine till apps/web/public/wasm/
pnpm wasm:test      # Rust-enhetstester
```

Ladda om sidan. Statusfältet nere till höger visar vilken motor som används
("Wasm 0.1.0" eller "TypeScript-motor").

## Struktur

```
desktopcam/
├─ packages/core/            Delade typer och logik (ingen UI, inga DOM-beroenden)
│  └─ src/
│     ├─ types.ts            MachineProfile, ToolDefinition, VectorLayer, ToolpathConfig …
│     ├─ protocol.ts         Meddelanden mellan UI och worker
│     ├─ engine.ts           CamEngine-gränssnittet som båda motorerna uppfyller
│     ├─ referenceEngine.ts  TypeScript-motor (reserv + facit för Rust)
│     ├─ geometry.ts         Kurvutplattning, offset, formfabriker
│     ├─ transform.ts        2D-matriser och SVG:s transform-attribut
│     ├─ pathOps.ts          Transformera, vända och sammanfoga banor
│     ├─ import/             SVG- och DXF-tolkar (körs i workern)
│     ├─ reliefLibrary.ts    Reliefbiblioteket: 12 genererade 3D-motiv
│     ├─ reliefToolpath.ts   Drop cutter-bana för reliefer (facit för Rust)
│     └─ gcode.ts            G-kodsparser → förhandsvisning och statistik
├─ crates/cam-engine/        Rust → WebAssembly (wasm-bindgen)
│  └─ src/ lib.rs, geometry.rs, gcode.rs, raster.rs, relief.rs
└─ apps/web/                 Vite + React + Tailwind
   ├─ public/_headers        COOP/COEP för Cloudflare Pages
   ├─ public/samples/        skylt.svg och hallare.dxf att testa importen med
   └─ src/
      ├─ engine/             camClient (Promise-RPC), Wasm-laddare med reserv
      ├─ workers/            cam.worker.ts
      ├─ cam/                Kommandon, verktygsbaneservice och höjdkartor för reliefer
      ├─ store/              Zustand-store
      ├─ data/               JSON-bibliotek för maskiner, verktyg, material + guider
      └─ components/
         ├─ ribbon/          Ribbon, grupper, knappar och en fil per flik
         ├─ smartguide/      SmartTooltip, InfoHint och illustrationer
         ├─ viewport/        SceneController (Three.js) + React-skal
         ├─ layout/          Header, projektträd, egenskapspanel, statusfält
         └─ dialogs/         Maskininställning, G-kodsvisare, import, reliefbibliotek
```

## Så flödar en beräkning

1. Användaren väljer t.ex. **Verktygsbanor › Profil**. `cam/commands.ts` skapar en
   `ToolpathConfig` med värden från verktyg och material.
2. `toolpathService` plattar ut formerna till polylinjer och skickar ett
   `ProfileJob` via `camClient` till workern.
3. Workern kör `CamEngine.profileGcode` – Rust/Wasm om den är byggd, annars
   TypeScript – och tolkar sedan G-koden till linjesegment.
4. Segmenten skickas tillbaka som överförbara `Float32Array` (ingen kopiering)
   och ritas av `SceneController`.

Förhandsvisningen byggs alltid från den färdiga G-koden, så det du ser är exakt
det som exporteras.

## Vad som fungerar i prototypen

- Ribbon med sex flikar, hopfällbar, med SmartTooltips och kortkommandon
  (R, C, P, L, F, 1–3, ⌘/Ctrl+E)
- Nybörjarläge med ?-guider och rekommenderade värden per material
- Ljust och mörkt läge (följer systemet vid start)
- 3D-vy med bord, material, vektorer, verktygsbanor och markörposition
- Profilfräsning (utsida/insida/på linjen, flera djuppass)
- Laserskärning med kerf-kompensation och flera pass
- Fotogravyr: Floyd–Steinberg, ordnad dithering eller tröskel, dubbelriktad rastrering
- Maskininställning i tre steg och G-kodsexport
- SVG-import: path (alla kommandon), rect med rundade hörn, circle, ellipse, line,
  polyline, polygon, grupper med transform, `<use>` och Inkscape-lager
- DXF-import: LINE, ARC, CIRCLE, LWPOLYLINE och POLYLINE med bulge, ELLIPSE,
  SPLINE (även rationella), INSERT med nästlade block och speglade objekt
- Importdialog med förhandsvisning, enhetsval, sammanfogning av lösa segment till
  slutna konturer och placering på materialet; dra och släpp filer i 3D-vyn
- Reliefbibliotek med 12 motiv i tre kategorier, skuggade miniatyrer, storlek,
  djup, invertering och spegling
- 3D-reliefbana med drop cutter för kulfräs, pinnfräs och V-fräs, valfri
  grovbearbetning i lager och reliefen inristad i 3D-vyns material

### Testa importen

Dra `apps/web/public/samples/skylt.svg` eller `hallare.dxf` till 3D-vyn. Skylten har
lager, rundade hörn, återanvända hål och en text som hoppas över med en varning.
Hållaren består av lösa linjer och bågar som sammanfogas till en sluten kontur.

## Driftsättning på Cloudflare Pages

| Inställning     | Värde                                   |
| --------------- | --------------------------------------- |
| Build command   | `pnpm install && pnpm build`            |
| Output folder   | `apps/web/dist`                         |
| Node version    | `NODE_VERSION=20`                       |

Har projektet skapats som en **Worker** i stället för Pages (byggloggen kör då
`npx wrangler deploy`) används `wrangler.jsonc` i roten. Se till att `name` där är
samma som Workerns namn i Cloudflare, och att `pnpm-lock.yaml` är incheckad så att
Cloudflare installerar med pnpm.

Cloudflares byggmiljö har inte Rust förinstallerat. Enklast är att bygga Wasm
lokalt och checka in `apps/web/public/wasm/` (ta bort raden i `.gitignore`), eller
bygga i GitHub Actions och publicera med `wrangler pages deploy`.

## Nästa steg

1. Robust offset med Clipper2 i Rust (konkava former, självkorsningar, öar)
2. Ficka, borrning och V-gravyr (medial axis) i motorn
3. Egna reliefer: importera höjdkartor (gråskalebild) och STL
4. Ritverktyg i vyn: klicka för att rita, markera och dra noder
5. Flikar (tabs) i profilbanor och sortering för kortare snabbförflyttningar
6. Wasm-trådar med `wasm-bindgen-rayon` (COOP/COEP är redan på plats)
7. Materialborttagningssimulering (höjdkarta) under fliken Simulera
8. Spara och öppna projekt (`.dcam` = JSON) samt i18n
