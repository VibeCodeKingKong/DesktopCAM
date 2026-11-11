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
- Gränssnittet finns på svenska och engelska (`apps/web/src/i18n/sv.ts` och
  `en.ts`) – lägg till texter i båda.

## Version och nyheter

Varje uppdatering som ändrar appen ska:

- höja versionen i `package.json` och `apps/web/package.json` (semver: ny
  funktion = minor, rättning = patch),
- få en post överst i `apps/web/src/data/changelog.ts` på svenska och
  engelska – den visas i appen under Om desktopCAM → Nyheter.
