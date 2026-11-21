#!/usr/bin/env node
/**
 * Licensgranskning för desktopCAM.
 *
 *   node scripts/license-audit.mjs          → uppdaterar SBOM.json, LICENSE_NOTICES/
 *                                              och den genererade delen av THIRD_PARTY_LICENSES.md
 *   node scripts/license-audit.mjs --check  → bara kontroll; avslutar med fel om något
 *                                              paket har en licens som inte är godkänd
 *
 * Källor: `pnpm licenses list --json` (npm, även indirekta beroenden) och
 * `cargo metadata` (Rust/Wasm-motorn, om cargo finns). Egen kod, inga beroenden.
 *
 * OBS: en automatisk kontroll är en teknisk sållning – den ersätter inte en
 * juridisk granskning. Se IP_COMPLIANCE.md och COMMERCIAL_READINESS.md.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

/** Licenser som godkänns direkt (policy: MIT, Apache-2.0, BSD-2/3, ISC). */
const PREFERRED = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC']);
/**
 * Licenser som bedömts var för sig och godkänts med villkor (se IP_COMPLIANCE.md).
 * Allt annat är "REVIEW REQUIRED" tills det bedömts.
 */
const EVALUATED = {
  'OFL-1.1': 'Typsnitt: får bäddas in och användas kommersiellt. Licenstexten ska följa med; typsnittet får inte säljas separat.',
  Unlicense: 'Fri allmän egendom (public domain) med tillåtande reservlicens. Inga villkor.',
  '0BSD': 'Tillåtande, kräver inte ens upphovsrättsnotis.',
  'Unicode-3.0': 'Tillåtande (Unicode-data). Notisen ska följa med.',
  'CC0-1.0': 'Fri allmän egendom. Inga villkor.',
};
/** Kända fel i paketens metadata, kontrollerade mot paketets LICENSE-fil. */
const METADATA_FIX = { 'BDS-3-Clause': 'BSD-3-Clause' };
/** Paket som bara innehåller TypeScript-typer och aldrig följer med appen. */
const TYPES_ONLY = (name) => name.startsWith('@types/');
/** Paket som byts ut i bygget (vite.config.ts resolve.alias) – kopian ligger i appen. */
const REPLACED = { 'squares-rng': 'apps/web/src/shims/squares-rng.js (kopia av samma MIT-kod, avkodning ändrad)' };

const spdxOk = (expr) => {
  // "MIT OR Apache-2.0" → godkänd om något alternativ är godkänt; "A AND B" → alla.
  const e = expr.replace(/[()]/g, '').trim();
  if (e.includes(' OR ')) return e.split(' OR ').some((p) => spdxOk(p));
  if (e.includes(' AND ')) return e.split(' AND ').every((p) => spdxOk(p));
  return PREFERRED.has(e) || e in EVALUATED;
};
const status = (expr) => (!expr ? 'REVIEW REQUIRED' : spdxOk(expr) ? 'APPROVED' : 'REVIEW REQUIRED');

const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const licenseFile = (dir) => {
  if (!dir || !existsSync(dir)) return null;
  const f = readdirSync(dir).find((n) => /^(licen[cs]e|copying|notice)(\.(md|txt))?$/i.test(n) || /^(licen[cs]e|ofl)[-.]/i.test(n));
  return f ? join(dir, f) : null;
};
/** Licensavsnittet i README när paketet saknar licensfil (t.ex. flo-mat). */
const readmeLicense = (dir) => {
  const f = dir && existsSync(join(dir, 'README.md')) ? join(dir, 'README.md') : null;
  if (!f) return null;
  const m = readFileSync(f, 'utf8').match(/^#+\s*Licen[cs]e\s*\n([\s\S]*?)(?=\n#+\s|$)/im);
  return m && /permission is hereby granted|licen[cs]e/i.test(m[1]) ? `(Ur paketets README)\n\n${m[1].trim()}\n` : null;
};
const repoOf = (meta) => {
  const r = meta.repository;
  const url = typeof r === 'string' ? r : r?.url;
  return url ? url.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^github:/, 'https://github.com/') : meta.homepage ?? '';
};
const authorOf = (meta) => {
  const a = meta.author;
  return typeof a === 'string' ? a.replace(/\s*<[^>]*>/, '').replace(/\s*\([^)]*\)/, '') : a?.name ?? '';
};

/* ───────── npm (pnpm) ───────── */

function pnpmList(prod) {
  const out = execSync(`pnpm licenses list --json -r${prod ? ' --prod' : ''}`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const list = [];
  for (const [license, pkgs] of Object.entries(JSON.parse(out))) {
    for (const p of pkgs) for (const [i, version] of p.versions.entries()) list.push({ name: p.name, version, license, dir: p.paths[i] ?? p.paths[0] });
  }
  return list;
}

const shipped = new Set(pnpmList(true).map((p) => `${p.name}@${p.version}`));
const npm = pnpmList(false).map((p) => {
  const meta = existsSync(join(p.dir, 'package.json')) ? readJson(join(p.dir, 'package.json')) : {};
  const license = METADATA_FIX[p.license] ?? p.license;
  const isShipped = shipped.has(`${p.name}@${p.version}`) && !TYPES_ONLY(p.name);
  return {
    ecosystem: 'npm',
    name: p.name,
    version: p.version,
    license,
    metadataLicense: p.license !== license ? p.license : undefined,
    author: authorOf(meta),
    repository: repoOf(meta),
    shipped: isShipped,
    replacedBy: REPLACED[p.name],
    licenseFile: licenseFile(p.dir),
    dir: p.dir,
    status: status(license),
  };
});

/* ───────── Rust (cargo) ───────── */

let cargo = [];
try {
  const meta = JSON.parse(
    execSync('cargo metadata --format-version 1 --locked', { cwd: join(ROOT, 'crates/cam-engine'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }),
  );
  const wasmBuilt = existsSync(join(ROOT, 'apps/web/public/wasm/cam_engine_bg.wasm'));
  cargo = meta.packages
    .filter((p) => p.name !== 'cam-engine')
    .map((p) => ({
      ecosystem: 'cargo',
      name: p.name,
      version: p.version,
      license: p.license ?? '',
      author: (p.authors ?? []).join(', ').replace(/\s*<[^>]*>/g, ''),
      repository: p.repository ?? '',
      // Wasm-motorn följer bara med om den är byggd (apps/web/public/wasm).
      shipped: wasmBuilt,
      licenseFile: licenseFile(dirname(p.manifest_path)),
      status: status(p.license ?? ''),
    }));
} catch {
  console.warn('cargo saknas eller Cargo.lock är inte aktuell – Rust-beroenden hoppas över.');
}

const all = [...npm, ...cargo].sort((a, b) => a.ecosystem.localeCompare(b.ecosystem) || a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
const problems = all.filter((c) => c.status !== 'APPROVED');

console.log(`${all.length} komponenter (${all.filter((c) => c.shipped).length} följer med appen).`);
for (const c of problems) console.log(`  ${c.status}: ${c.ecosystem} ${c.name}@${c.version} – ${c.license || 'ingen licens angiven'}${c.shipped ? ' (följer med appen)' : ''}`);
const missingText = all.filter((c) => c.shipped && !c.licenseFile);
for (const c of missingText)
  console.log(`  OBS: ${c.name}@${c.version} har ingen licensfil – ${readmeLicense(c.dir) ? 'licenstexten hämtas ur README' : `standardtext för ${c.license} används`}.`);

if (CHECK) {
  if (problems.some((c) => c.shipped)) {
    console.error('Licenskontrollen stoppade: komponenter som följer med appen behöver granskas (se ovan).');
    process.exit(1);
  }
  console.log('Licenskontroll OK – alla komponenter som följer med appen har godkända licenser.');
  process.exit(0);
}

/* ───────── SBOM (CycloneDX 1.5) ───────── */

const appVersion = readJson(join(ROOT, 'package.json')).version;
const purl = (c) => (c.ecosystem === 'npm' ? `pkg:npm/${c.name.startsWith('@') ? '%40' + c.name.slice(1) : c.name}@${c.version}` : `pkg:cargo/${c.name}@${c.version}`);
const spdxLicenses = (expr) =>
  !expr ? [] : /\s(OR|AND)\s|[()]/.test(expr) ? [{ expression: expr }] : [{ license: { id: expr } }];
const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: {
    component: { type: 'application', name: 'desktopCAM', version: appVersion, licenses: [{ license: { name: 'Proprietary – all rights reserved' } }] },
    tools: { components: [{ type: 'application', name: 'desktopcam-license-audit', version: '1' }] },
  },
  components: all.map((c) => ({
    type: c.name.startsWith('@fontsource/') ? 'file' : 'library',
    name: c.name,
    version: c.version,
    purl: purl(c),
    licenses: spdxLicenses(c.license),
    ...(c.author ? { author: c.author } : {}),
    ...(c.repository ? { externalReferences: [{ type: 'vcs', url: c.repository }] } : {}),
    // required = följer med appen; excluded = bara byggverktyg/typer.
    scope: c.shipped ? 'required' : 'excluded',
    properties: [
      { name: 'desktopcam:status', value: c.status },
      ...(c.replacedBy ? [{ name: 'desktopcam:replacedBy', value: c.replacedBy }] : []),
      ...(c.metadataLicense ? [{ name: 'desktopcam:metadataLicense', value: c.metadataLicense }] : []),
    ],
  })),
};
writeFileSync(join(ROOT, 'SBOM.json'), JSON.stringify(sbom, null, 2) + '\n');

/* ───────── LICENSE_NOTICES/ ───────── */

const MIT_TEXT = (holder) => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
const notices = join(ROOT, 'LICENSE_NOTICES');
rmSync(notices, { recursive: true, force: true });
mkdirSync(notices);
for (const c of all.filter((x) => x.shipped)) {
  const file = `${c.ecosystem}-${c.name.replace(/^@/, '').replace(/\//g, '__')}@${c.version}.txt`;
  const head = `${c.name} ${c.version}\nLicens: ${c.license}${c.author ? `\nUpphovsrätt: ${c.author}` : ''}${c.repository ? `\nKälla: ${c.repository}` : ''}\n${'-'.repeat(72)}\n\n`;
  const text = c.licenseFile
    ? readFileSync(c.licenseFile, 'utf8')
    : (readmeLicense(c.dir) ?? (c.license === 'MIT' ? `${MIT_TEXT(c.author || c.name)}\n(Paketet saknar licenstext; standardtexten för MIT med upphovsrättsinnehavaren enligt paketets metadata.)` : `(Ingen licenstext i paketet – licens enligt metadata: ${c.license})\n`));
  writeFileSync(join(notices, file), head + text.trim() + '\n');
}
writeFileSync(
  join(notices, 'README.md'),
  `# Licenstexter för tredjepartskomponenter

Genereras av \`node scripts/license-audit.mjs\`. En fil per komponent som följer
med desktopCAM (npm-paket och typsnitt; Rust-crates bara när Wasm-motorn är
byggd). Samma texter samlas vid bygget i \`dist/licenses.txt\`, som visas i
appen under Om desktopCAM → Licenser.
`,
);

/* ───────── THIRD_PARTY_LICENSES.md (genererad del) ───────── */

const row = (c) =>
  `| ${c.name} | ${c.version} | ${c.license}${c.metadataLicense ? ` (metadata: ${c.metadataLicense})` : ''} | ${c.author || '–'} | ${c.repository ? `<${c.repository}>` : '–'} | ${c.status}${c.replacedBy ? ' – ersatt av egen kopia' : ''} |`;
const table = (rows) => ['| Paket | Version | Licens | Upphovsrätt | Källa | Status |', '|---|---|---|---|---|---|', ...rows.map(row)].join('\n');
const gen = `<!-- GENERERAT AV scripts/license-audit.mjs – ändra inte för hand nedanför denna rad -->

## Följer med appen (${all.filter((c) => c.shipped).length})

${table(all.filter((c) => c.shipped))}

## Bara byggverktyg, typer och utveckling – följer inte med appen (${all.filter((c) => !c.shipped).length})

${table(all.filter((c) => !c.shipped))}
`;
const tplPath = join(ROOT, 'THIRD_PARTY_LICENSES.md');
const manual = existsSync(tplPath) ? readFileSync(tplPath, 'utf8').split('<!-- GENERERAT AV')[0].trimEnd() : '# Tredjepartslicenser';
writeFileSync(tplPath, `${manual}\n\n${gen}`);
console.log('Uppdaterade SBOM.json, LICENSE_NOTICES/ och THIRD_PARTY_LICENSES.md.');
