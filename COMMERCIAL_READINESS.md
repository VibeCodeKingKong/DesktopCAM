# Kommersiell beredskap – desktopCAM

Öppna licensfrågor, beroenden av externa tjänster och punkter som kräver
juridisk granskning. Ingen komponent med status REVIEW REQUIRED eller
REJECTED får ingå i en kommersiell release utan uttryckligt godkännande.

Senast uppdaterad: 2026-11-21 (version 0.32.0).

> desktopCAM är **inte** juridiskt klar för kommersiell distribution. Att den
> automatiska licenskontrollen går igenom (`node scripts/license-audit.mjs
> --check`) betyder bara att inga kända otillåtna licenser följer med appen.

## Klassificering

### APPROVED – kommersiell användning kontrollerad, med licensens villkor

- Alla 44 tredjepartskomponenter som följer med appen (MIT, ISC, BSD-3-Clause,
  Apache-2.0, OFL-1.1, Unlicense, 0BSD). Villkor: notiser och licenstexter i
  `dist/licenses.txt` och `LICENSE_NOTICES/`. Se `THIRD_PARTY_LICENSES.md`.
- Rust-beroendena (om Wasm-motorn byggs): MIT/Apache-2.0, Unlicense/MIT,
  Unicode-3.0.

### REVIEW REQUIRED

| # | Punkt | Varför | Förslag |
|---|---|---|---|
| 1 | **Rättighetsinnehavare och slutanvändaravtal** | Det är inte fastställt vem som äger desktopCAM (person eller bolag), och det finns ingen EULA eller användarvillkor. | Bestäm rättighetsinnehavare, lägg till upphovsrättsnotis och EULA/villkor innan försäljning. |
| 2 | **Web3Forms** (feedbackformuläret) | Meddelandet, en valfri svarsadress och valfri appinformation (version, språk, maskin, webbläsarens user-agent) skickas till api.web3forms.com. Villkoren kunde inte läsas (sajten nås inte från utvecklingsmiljön). Okänt: kommersiell användning på gratisnivån, gränser, var data lagras, hur länge, om ett personuppgiftsbiträdesavtal (DPA) finns. | Granska villkor och DPA, eller byt till egen mottagare (t.ex. en Cloudflare Worker som skickar e-post) så att ingen tredje part hanterar data. Informera i integritetspolicyn. |
| 3 | **Cloudflare Workers** (drift) | Kommersiell användning är tillåten, men det behövs ett DPA och uppgifter om loggar och IP-adresser för GDPR. | Teckna Cloudflares DPA, beskriv i integritetspolicyn. |
| 4 | **Integritetspolicy (GDPR)** | Appen sparar projekt lokalt i webbläsaren (localStorage), har ingen analys eller spårning och skickar data bara via feedbackformuläret. Ingen integritetspolicy finns. | Skriv integritetspolicy och, vid behov, cookie- och lagringsinformation. |
| 5 | **Patent** | Ingen patentsökning har gjorts. Särskilt: mittlinjebaserad V-gravyr, V-inlägg, bild till relief. | Freedom-to-operate-sökning för CAM-relaterade patent före lansering. Se `IP_COMPLIANCE.md` §4. |
| 6 | **Varumärken** | Maskin- och programnamn i gränssnittet; namnet "desktopCAM" är inte sökt. | Varumärkessökning för produktnamnet; granska användningen av tredjeparts namn. |
| 7 | **Skärdata** | Siffror sammanställda bl.a. ur tillverkares skärtabeller. Fakta, låg risk. | Dokumentera källa per material/maskin. |
| 8 | **flo-paket utan licenstext** | Nio paket anger MIT i package.json men saknar licenstext. | Låg risk; alternativt be upphovsmannen lägga till LICENSE-filer. |
| 9 | **Byggverktyg med CC-BY-licens** | caniuse-lite (CC-BY-4.0), spdx-exceptions m.fl. (CC-BY-3.0). Distribueras inte. | Ingen åtgärd för appen; formellt godkännande för byggmiljön. |
| 10 | **PayPal-donationer** | Funktionen finns men är avstängd. Donationer i en kommersiell produkt kan ha skattemässiga och avtalsmässiga följder. | Avgör om donationer ska finnas kvar när produkten säljs. |

### REJECTED

Inga.

## Externa tjänster

| Tjänst | Används till | Data | Krävs för kärnfunktionen? |
|---|---|---|---|
| Cloudflare Workers | Drift av webbappen | IP-adresser i loggar | Ja (drift); appen kan också driftas annorstädes som statiska filer |
| Web3Forms | Feedbackformuläret | Meddelande, ev. svarsadress, ev. appinformation och user-agent | Nej |
| PayPal | Donationslänk (avstängd) | Hanteras av PayPal | Nej |
| npm-registret, crates.io | Bygget | – | Bara vid utveckling |

All CAM-beräkning, simulering och G-kod sker lokalt i webbläsaren. Appen
fungerar utan externa tjänster (utom att sidan måste levereras).

## Rutin vid ändringar

1. Före varje nytt beroende, modell, tjänst eller kopierad kod: licens,
   kommersiell användning, villkor och begränsningar – dokumentera i
   `THIRD_PARTY_LICENSES.md`/`IP_COMPLIANCE.md`. Är något oklart: stoppa och
   fråga.
2. Efter ändrade beroenden: `node scripts/license-audit.mjs` (uppdaterar
   SBOM.json, LICENSE_NOTICES/ och förteckningen) och `--check`.
3. Före kommersiell release: fullständig licensgranskning enligt
   `CLAUDE.md` och juridisk granskning av punkterna ovan.
