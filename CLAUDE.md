# Riktlinjer för desktopCAM

## Använd befintlig kod först

Innan ny funktionalitet skrivs: sök efter färdig, välunderhållen kod – inbyggda
webbläsar-API:er (Canvas, Web Workers, File API …), npm-paket och projekt på
GitHub. Skriv egen kod bara när inget lämpligt finns, eller när det befintliga
inte passar (licens, storlek, underhåll, fel funktion). Ange i commit-meddelandet
vilket bibliotek som valts och varför, eller varför egen kod behövdes.

- Kontrollera licens enligt "Licenser och immaterialrätt" nedan, senaste
  version och att paketet underhålls.
- Lås exakta versioner i package.json.

## Bygg och test

- `pnpm install`, `pnpm build`, `pnpm typecheck` i roten.
- `pnpm test`: regressionstester för G-koden (exempelprojektens jobb mot facit
  och säkerhetsregler). Körs också av `pnpm build`. Ändras G-koden med avsikt:
  kontrollera i simuleringen och kör `pnpm test:update`. Ändras jobbformatet
  eller exemplen: `node scripts/capture-gcode-fixtures.cjs` med dev-servern igång.
- `pnpm test:e2e`: webbläsartester av huvudflödena (Playwright, `apps/web/e2e/`)
  mot det byggda programmet – kör efter `pnpm build`. Körs inte i Cloudflares
  bygge (ingen webbläsare där). Första gången: `npx playwright install chromium`.
- Projektstruktur: `apps/web` (React/Vite), `packages/core` (CAM-kärna i
  TypeScript), `crates/cam-engine` (Rust/Wasm).
- Verifiera ändringar i webbläsaren (Playwright) och, för verktygsbanor, genom
  att simulera G-koden (`apps/web/src/cam/simulation.ts`).
- Gränssnittet finns på svenska, engelska, franska, tyska, spanska, polska och
  ukrainska (`apps/web/src/i18n/sv.ts`, `en.ts`, `fr.ts`, `de.ts`, `es.ts`,
  `pl.ts`, `uk.ts`). Nya eller ändrade texter ska läggas in i **alla** språk –
  typen `Dict` (formen av `sv.ts`) gör att `pnpm typecheck` fallerar om ett
  språk saknar en nyckel. Använd `t.locale`/`decimalSep(t)` för tal, aldrig
  hårdkodad `'sv-SE'` eller `t.code === 'sv'`.

## Version och nyheter

Varje uppdatering som ändrar appen ska:

- höja versionen i `package.json` och `apps/web/package.json` (semver: ny
  funktion = minor, rättning = patch),
- få en post överst i `apps/web/src/data/changelog.ts` på **alla** språk i
  appen (sv, en, fr, de, es, pl, uk) – den visas i appen under Om desktopCAM →
  Nyheter. Typen `Record<Language, string[]>` kräver alla språk.
- **En post per dag**: har den översta posten dagens datum, uppdatera den i
  stället för att lägga till en ny – sätt `version` till den nya versionen och
  skriv om texten så att den täcker alla dagens nyheter (fortfarande högst
  3–5 punkter, det viktigaste först). En ny post läggs bara till första
  uppdateringen en ny dag.
- Fältet `since` anger för varje punkt i vilken version den tillkom (samma
  ordning som texten). När dagens post uppdateras behåller gamla punkter sin
  version och nya punkter får den nya – appen märker då det som tillkommit
  sedan användarens förra version med "Ny".
- Ett nytt språk läggs till i `i18n/initial.ts` (`LANGUAGE_CODES`), som ny
  ordlista i `i18n/` registrerad i `i18n/index.ts`, och i varje post i
  `changelog.ts`.

### Så skrivs nyheterna

Nyheterna är till för användaren, som vill veta vilken ny funktionalitet som
finns och hur den används – inte hur den är byggd.

- Börja med vad användaren kan göra, inte med vad som ändrats i programmet.
- En funktion per punkt, som börjar med en kort rubrik i fetstil:
  `**Gruppera former** Håll ihop delar som …` (appen visar rubriken i fetstil).
- Säg var funktionen finns och hur man kommer igång (t.ex. "Design → Gruppera
  (⌘G)"), gärna med ett konkret exempel.
- Inga tekniska ord (t.ex. länkning, närmaste granne, postprocessor-fält,
  avståndsfält, IndexedDB) och inga interna namn.
- Förbättringar av befintliga funktioner beskrivs som en nytta (går snabbare,
  blir jämnare, stämmer bättre) och kommer efter de nya funktionerna.
- Högst 3–5 punkter. Småfixar samlas i en avslutande punkt eller utelämnas;
  rena interna ändringar (tester, licensdokument) nämns inte.
- Samma innehåll på alla språk, skrivet naturligt på varje språk.

## Licenser och immaterialrätt (kommersiell produkt)

desktopCAM ska bli en proprietär kommersiell produkt. Kommersiell gångbarhet
går före bekvämlighet. Gäller allt från tredje part: npm- och Python-paket,
Rust-crates, bild- och geometribibliotek, AI-modeller och vikter, typsnitt,
ikoner och grafik, externa API:er och tjänster, dataset och kod från publika
källor (även Stack Overflow och GitHub).

- **Godkända licenser**: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC.
  Bedömda och godkända med villkor: OFL-1.1 (typsnitt), Unlicense, 0BSD,
  CC0-1.0, Unicode-3.0 (se `IP_COMPLIANCE.md`).
- **Begränsade – aldrig utan uttryckligt godkännande och juridisk granskning**:
  GPL, AGPL, SSPL, stark copyleft, icke-kommersiella, akademiska/forsknings-
  licenser, source-available med kommersiella begränsningar, okända eller
  egna licenser. LGPL, MPL och annan svag copyleft bedöms var för sig.
- **Spärr före varje nytt beroende, modell, tjänst eller kopierad kod**:
  1) ta reda på licensen, 2) kontrollera kommersiell användning, 3) villkor och
  begränsningar, 4) förenlighet med proprietär distribution, 5) dokumentera.
  Är licensen oklar eller kan vara oförenlig: **stoppa**, förklara problemet,
  föreslå ett kommersiellt lämpligt alternativ och vänta på godkännande. Byt
  aldrig tyst till en tveksam komponent.
- **AI-modeller**: ramverkets licens gäller inte vikterna. Kontrollera modell
  och version, utgivare, licens, kommersiell rätt, distribution/hosting,
  attribution, villkor för utdata och om avtal krävs. Inga forsknings- eller
  icke-kommersiella modeller. Ladda inte ner eller paketera vikter förrän
  licensen är kontrollerad.
- **Egen implementering**: funktioner får inspireras av andra produkter
  (t.ex. Tooltrace.ai, Shaper Trace), men källkod, grafik, distinkt design och
  proprietära algoritmer får inte kopieras eller tas fram genom reverse
  engineering. Nämn inte konkurrerande produkter i gränssnitt eller kod.
- **Patent**: anta inte att en publicerad metod är fri. Flagga kända eller
  misstänkta patent (bildsegmentering, vektorisering, offset, CAD-geometri,
  ML, tillverkningsflöden) i `IP_COMPLIANCE.md`.
- **Externa tjänster**: bedöm kommersiell rätt, pris och gränser, dataägande,
  GDPR, lagring och träning på data, tillgänglighet. Kärnfunktionen ska fungera
  utan tredjepartstjänster.
- **Egen kod** är proprietär: märk aldrig projektets kod med en öppen licens
  och ändra inte projektets licens. Inga beroenden som kräver att källkoden
  lämnas ut.
- **Dokumentation som hålls aktuell**: `THIRD_PARTY_LICENSES.md`,
  `IP_COMPLIANCE.md`, `SBOM.json` (CycloneDX), `LICENSE_NOTICES/`,
  `COMMERCIAL_READINESS.md`. Efter ändrade beroenden: `pnpm license:audit`
  (uppdaterar SBOM, notiser och förteckning) och `pnpm license:check`.
- **Före kommersiell release**: fullständig licensgranskning med status
  APPROVED / REVIEW REQUIRED / REJECTED per komponent. Inget med REVIEW
  REQUIRED eller REJECTED får ingå utan uttryckligt godkännande. Påstå aldrig
  att desktopCAM är juridiskt klar bara för att den automatiska kontrollen går
  igenom.
