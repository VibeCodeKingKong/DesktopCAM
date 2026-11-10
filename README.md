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
│     ├─ sdf.ts              Avståndsfält: robust offset för profil och ficka
│     ├─ camOps.ts           Ficka och borrning
│     ├─ vcarve.ts           V-gravyr och V-inlägg
│     ├─ strokeFont.ts       Enkellinjigt gravyrtypsnitt
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
      ├─ editing/            Ritlagret: markering, flytt, ritverktyg och nodredigering
      ├─ i18n/               Svenska och engelska ordlistor
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

## Funktioner

**Design**
- Markera och flytta former direkt i 3D-vyn (mus och pekskärm), skift-klick för fler
- Rita linjer/polylinjer, Bézierkurvor, rektanglar, cirklar och text
- Nodredigering: dra punkter och kurvhandtag, dubbeltryck för ny punkt, ta bort punkt
- Exakt placering, storlek, rotation, spegling, centrering och duplicering i egenskapspanelen
- Fäst mot rutnät (0,1–10 mm) och mot befintliga noder
- Ångra och gör om (⌘Z / ⇧⌘Z), även för flytt och nodredigering
- Text med ett inbyggt enkellinjigt gravyrtypsnitt (versaler, siffror, ÅÄÖ, ÆØÜ)
- Import av SVG och DXF med förhandsvisning, enhetsval och sammanfogning
- Reliefbibliotek med 12 motiv

**CAM**
- Profil (utsida, insida, på linjen) med robust offset via avståndsfält – klarar
  konkava former, hål och överlapp
- Ficka med konturparallella ringar som går runt öar
- Borrning med hackborrning i mitten av slutna former
- V-gravyr med plan botten i breda partier, byggd på avståndsfältet (ingen
  separat mediallinjeberäkning behövs)
- V-inlägg (inlay) som i VCarve: ficka i grundträet och spegelvänd plugg i
  inläggsträet med startdjup, pluggdjup och beräknad limspalt
- 3D-reliefbana med grovbearbetning
- Laserskärning med kerf, linjegravyr och fotogravyr med dithering
- Banor räknas om automatiskt när former, verktyg eller material ändras

**Projekt och gränssnitt**
- Spara och öppna projekt (`.dcam`), automatisk sparning i webbläsaren
- Svenska och engelska (språkväljaren i titelraden)
- Redigerbart verktygsbibliotek
- Mobilanpassat: projektträd och egenskaper öppnas som paneler på telefon,
  ritfält med Klar/Stäng/Ångra punkt, nyp för att zooma

**Inte klart ännu:** flikar i profilbanor och ett separat urfräsningsverktyg för
stora plana ytor i V-gravyr och inlägg (i dag fräser V-fräsen även dem).

### Så fungerar V-inlägg

Fickan V-graveras ner till fickdjupet. Pluggen är samma form spegelvänd, och
området runt den V-graveras med ett *startdjup* S: väggen träffar formens kant
på djupet S, så pluggen sjunker ner S i fickan innan väggarna möts. Limspalten
under pluggen blir fickdjup − S och överskottet ovanför ytan pluggdjup − S.
Båda banorna delar inställningar och exporteras som separata G-kodsfiler.

### Lägga till ett språk

Kopiera `apps/web/src/i18n/en.ts` till t.ex. `de.ts`, översätt texterna och lägg
till språket i `DICTS` och `LANGUAGES` i `i18n/index.ts`. TypeScript varnar om
någon text saknas.

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

1. Flikar i profilbanor och urfräsningsverktyg för V-gravyr och inlägg
2. Flytta avståndsfältet till Rust för snabbare fickor i Wasm
3. Egna reliefer: importera höjdkartor (gråskalebild) och STL
4. Konturtypsnitt (OpenType) för text som ska skäras ut
5. Sortering av banor för kortare snabbförflyttningar
6. Wasm-trådar med `wasm-bindgen-rayon` (COOP/COEP är redan på plats)
7. Materialborttagningssimulering (höjdkarta) under fliken Simulera
