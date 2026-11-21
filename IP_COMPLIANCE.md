# Immaterialrätt och licenser – desktopCAM

Sammanfattning av immaterialrättsliga frågor och identifierade risker.
Uppdateras när beroenden, algoritmer eller tjänster ändras. Senast granskat:
2026-11-21 (version 0.40.0: felrapporter, skuggfilter, webbläsartester).

> Detta är en teknisk genomgång, inte juridisk rådgivning. Automatiska
> licenskontroller är en sållning och ersätter inte en juridisk granskning.
> desktopCAM ska inte betraktas som juridiskt klar för kommersiell
> distribution förrän punkterna i `COMMERCIAL_READINESS.md` är granskade.

## 1. desktopCAM:s egen kod

- All kod i `apps/web`, `packages/core` och `crates/cam-engine` är skriven för
  projektet och avsedd att vara proprietär (alla rättigheter förbehållna).
- Paketen är märkta `"private": true` och `"license": "UNLICENSED"` (npm:s
  beteckning för proprietär kod). Rust-motorn var tidigare märkt
  `license = "MIT"`; den är nu ändrad till
  `LicenseRef-desktopCAM-Proprietary` och `publish = false` (2026-11-21).
- Det finns ingen LICENSE-fil i roten som ger någon licens till projektets
  kod. Rättighetsinnehavare och slutanvändaravtal (EULA) är inte fastställda –
  se `COMMERCIAL_READINESS.md`.
- Inga delar av projektets kod omfattas av copyleft-villkor (inga GPL-, AGPL-,
  LGPL- eller MPL-komponenter följer med), så ingen källkod behöver lämnas ut.

## 2. Tredjepartskomponenter

Fullständig förteckning: `THIRD_PARTY_LICENSES.md` och `SBOM.json`.

- 52 komponenter följer med appen: MIT (37), ISC (4), BSD-3-Clause (1),
  Apache-2.0 (2), OFL-1.1 (6 typsnitt), Unlicense (1), 0BSD (1).
- Villkoren är att upphovsrättsnotiser och licenstexter följer med. Det sker i
  `dist/licenses.txt` (visas i appen under Om desktopCAM → Licenser) och i
  `LICENSE_NOTICES/`.
- **Typsnitt (OFL-1.1)**: Bebas Neue, Cinzel, Montserrat, Oswald, Pacifico och
  Playfair Display får bäddas in och användas i kommersiell programvara.
  Licenstexten ska följa med, typsnitten får inte säljas separat, och ändrade
  versioner får inte heta likadant. Text som användaren fräser eller graverar
  är inte typsnittsprogramvara och omfattas inte av OFL. Roboto Slab är
  Apache-2.0.
- **Paket utan licensfil**: nio av flo-paketen (beroenden till flo-mat) anger
  MIT i `package.json` men saknar licenstext. Licensen är angiven av upphovs-
  mannen, så risken bedöms som låg. Standardtexten för MIT med upphovsrätts-
  innehavaren (Floris Steenkamp) används. flo-mat och squares-rng har texten i
  sin README, och den används.
- **Service worker (offline)**: `apps/web/sw/sw.ts` är egen kod som använder
  Workbox (MIT, Google). Workbox-modulerna som följer med (core, precaching,
  routing, strategies, expiration, window) finns i `dist/licenses.txt`.
  Ingen analys eller spårning ingår (workbox-google-analytics är bara ett
  byggberoende och används inte). Appikonerna är ritade från projektets egen
  favicon.
- **Kopierad kod**: `apps/web/src/shims/squares-rng.js` är en kopia av
  squares-rng 2.0.4 (MIT). Avkodningen av den inbäddade Wasm-koden är
  omskriven så att den fungerar i en web worker. Upphovsrätt och licens anges
  i filen och i LICENSE_NOTICES. Ingen annan kod är kopierad från publika
  källor; ingen kod från Stack Overflow (CC BY-SA) finns i projektet.
- **Byggverktyg** som inte följer med appen: caniuse-lite (CC-BY-4.0) och
  spdx-exceptions m.fl. (CC-BY-3.0) är data i byggverktygen (browserslist,
  rollup-plugin-license). De distribueras inte. Status REVIEW REQUIRED enbart
  formellt – de påverkar inte produkten.
- **Rust/Wasm-motorn** (`crates/cam-engine`) är inte byggd och följer inte med
  appen i dag. Dess beroenden (wasm-bindgen, serde m.fl.) är MIT/Apache-2.0,
  memchr Unlicense/MIT och unicode-ident även Unicode-3.0 – alla tillåtande.

## 3. AI-modeller och data

- Inga AI-modeller, modellvikter, ML-ramverk eller träningsdata används.
- Ingen användardata skickas till AI-tjänster. Smart Trace körs helt i
  webbläsaren; foton och skisser lämnar inte användarens dator.
- **AI-segmentering (föreslagen, inte införd)** – kandidater att granska
  innan något laddas ner eller paketeras (licenserna kunde inte kontrolleras
  mot källan från utvecklingsmiljön och måste verifieras):

  | Modell | Uppgiven licens (kod / vikter) | Bedömning |
  |---|---|---|
  | Segment Anything (SAM), Meta | Apache-2.0 / Apache-2.0 | Kandidat – verifiera vikternas licens, träningsdata (SA-1B) och villkor för utdata. |
  | SAM 2, Meta | Apache-2.0 / Apache-2.0 | Kandidat – som ovan. |
  | MobileSAM | Apache-2.0 | Kandidat (liten nog för webbläsaren) – verifiera. |
  | EfficientSAM, Meta | Apache-2.0 | Kandidat – verifiera. |
  | FastSAM (Ultralytics-baserad) | AGPL-3.0 | REJECTED – stark copyleft. |
  | YOLO-modeller från Ultralytics | AGPL-3.0 eller kommersiell licens | REJECTED utan köpt licens. |
  | onnxruntime-web (körmiljö) | MIT | Kandidat för att köra en modell i webbläsaren. |

## 4. Algoritmer och möjliga patent

Ingen patentsökning (freedom-to-operate) har gjorts. Algoritmerna nedan är
implementerade självständigt från allmänt publicerade beskrivningar. Kända
grundmetoder är gamla och bedöms som fria, men **produktspecifika
tillämpningar i CAM-branschen kan omfattas av patent** och bör granskas.

| Område | Metod i desktopCAM | Bedömning |
|---|---|---|
| Avståndsfält, offset | Euklidisk avståndstransform (Felzenszwalb–Huttenlocher 2004), isolinjer med marching squares | Grundmetoderna bedöms fria (marching cubes-patentet US 4 710 876 löpte ut 2005). |
| V-gravyr, konturer | Offsetkonturer med djup efter avståndet | Vanlig metod i CAM-program; inget känt patent. REVIEW REQUIRED (branschpatent ej sökta). |
| V-gravyr, mittlinje | Medial axis transform via flo-mat (Choi m.fl. 1997) | Medial axis är en klassisk metod (Blum 1967). Mittlinjebaserad V-gravyr finns i flera kommersiella CAM-program – REVIEW REQUIRED. |
| V-inlägg (ficka/plugg) | Egen implementering: spegling, startdjup, limspalt | Etablerad snickeriteknik; programvaruimplementeringar hos andra leverantörer kan vara patenterade – REVIEW REQUIRED. |
| Fotogravyr | Floyd–Steinberg m.fl. felspridning (1976), tröskling, Otsu (1979) | Gamla, fria metoder. |
| Bild till linjer (penplotter) | Skraffering, spiral, viktad Voronoi-stippling (Lloyd, Secord 2002) | Allmänt publicerade; inga kända patent. |
| Bild till relief | Gråskala till höjd, egen analys | Allmän metod. |
| G-kod | Bågpassning (G2/G3), Douglas–Peucker (1973), närmaste-granne-ordning | Fria metoder. |
| Plasma | Anslag (lead-in), skärspalt, hörnfartsminskning | Allmänt kända tekniker; maskintillverkares egna funktioner är inte kopierade. |
| Simulering | Höjdfält (z-buffer) med verktygsform | Vanlig metod. |
| Spårning: papper och perspektiv | Ljusaste ytan (Otsu), konvext hölje, linjeanpassning (minsta kvadrat), homografi med fyra punkter (DLT) | Klassisk bildgeometri. Automatisk dokument-/pappersdetektering finns i kommersiella skannerappar och kan vara patenterad i specifika utföranden – REVIEW REQUIRED. |
| Spårning: objekt och konturer | Tröskel, sammanhängande komponenter, morfologi, marching squares, Douglas–Peucker, avståndsfältets offset | Allmänna metoder; inga kända patent. Potrace (GPL) används inte. |
| Spårning: mittlinje | Zhang–Suen-uttunning (1984), egen grafföljning och borttagning av utstickare | Publicerad 1984; inget känt patent. |
| Spårning: skuggfilter | Otsu med tre klasser (Liao m.fl. 2001) och färgmättnad per bildpunkt: grå mellanton = skugga | Allmänna bildbehandlingsmetoder, egen kod. Automatisk skuggborttagning finns i patenterade utföranden – REVIEW REQUIRED (ingår i patentsökningen). |
| Räta upp | Minsta omslutande rektangel via konvext hölje och roterande skjutmått (Freeman–Shapira 1975, Toussaint 1983) | Klassisk beräkningsgeometri; inget känt patent. |
| Vektorexport | SVG (W3C, royaltyfri), DXF R12 (Autodesks publicerade format), PDF 1.4 (ISO 32000) | Öppna/publicerade format; egen kod. DXF är Autodesks format – användning för utbyte bedöms tillåten, men "DXF" är ett varumärke att nämna med försiktighet. |

## 5. Varumärken

- Gränssnittet nämner maskiner och program (t.ex. Shapeoko, Creality, xTool,
  Inkscape, Illustrator, Fusion 360) för att beskriva kompatibilitet. En
  ansvarsfriskrivning finns i Om desktopCAM. Benämningarna bör granskas inför
  lansering (bl.a. maskinnamnen i maskinlistan).
- Hänvisningar till konkurrerande CAM-program (Vectric, Estlcam) i kodkommen-
  tarer och i nyhetslistan är borttagna (2026-11-21).
- Namnet "desktopCAM" är inte varumärkessökt.

## 6. Data och innehåll

- Maskinprofiler (`machines.json`), verktyg (`tools.json`) och skärdata
  (`materials.json`) är sammanställda fakta (mått, hastigheter, effekter)
  formulerade för projektet. Siffror från tillverkares publicerade
  skärtabeller är fakta och bedöms inte vara upphovsrättsskyddade, men
  ursprunget bör dokumenteras per post – REVIEW REQUIRED (låg risk).
- Reliefbibliotek, formbibliotek, illustrationer, rundturens bilder,
  exempelprojekt och exempelbilder är skapade för projektet.

## 7. Referensprodukter

Funktioner får inspireras av andra produkter (t.ex. Tooltrace.ai, Shaper
Trace), men källkod, grafik, distinkt design och proprietära algoritmer får
inte kopieras eller tas fram genom reverse engineering. Ingen sådan kod eller
grafik finns i projektet i dag.
