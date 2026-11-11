# Riktlinjer för desktopCAM

## Använd befintlig kod först

Innan ny funktionalitet skrivs: sök efter färdig, välunderhållen kod – inbyggda
webbläsar-API:er (Canvas, Web Workers, File API …), npm-paket och projekt på
GitHub. Skriv egen kod bara när inget lämpligt finns, eller när det befintliga
inte passar (licens, storlek, underhåll, fel funktion). Ange i commit-meddelandet
vilket bibliotek som valts och varför, eller varför egen kod behövdes.

- Kontrollera licens (MIT/BSD/ISC/Apache går bra), senaste version och att
  paketet underhålls.
- Lås exakta versioner i package.json.

## Bygg och test

- `pnpm install`, `pnpm build`, `pnpm typecheck` i roten.
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
- Ett nytt språk läggs till i `i18n/initial.ts` (`LANGUAGE_CODES`), som ny
  ordlista i `i18n/` registrerad i `i18n/index.ts`, och i varje post i
  `changelog.ts`.
