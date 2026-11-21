/**
 * Fångar de CAM-jobb som appen skickar till workern när exempelprojekten
 * öppnas och sparar dem som testdata i apps/web/test/fixtures/<exempel>.json.
 * Regressionstesterna (apps/web/test/gcode.test.ts) räknar sedan fram G-koden
 * ur jobben och jämför med facit.
 *
 * Kör med dev-servern igång (pnpm dev), när jobbformatet eller exemplen ändrats:
 *   node scripts/capture-gcode-fixtures.cjs [http://localhost:5173]
 * och uppdatera sedan facit: pnpm test:update
 */
const { chromium } = require('playwright');
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const URL = process.argv[2] || 'http://localhost:5173';
const OUT = path.join(__dirname, '../apps/web/test/fixtures');
const TOOLPATH_TYPES = ['profile', 'routerProfile', 'pocket', 'drill', 'vcarve', 'facing', 'relief', 'plasma', 'plotter', 'plotterImage', 'raster'];

(async () => {
  const { EXAMPLES } = await import('../apps/web/src/data/examples.ts').catch(() => ({ EXAMPLES: null }));
  const ids = EXAMPLES ? EXAMPLES.map((e) => e.id) : fs.readdirSync(path.join(__dirname, '../apps/web/public/examples')).filter((f) => f.endsWith('.dcam')).map((f) => f.replace('.dcam', ''));
  const browser = await chromium.launch();
  for (const id of ids) {
    const page = await browser.newPage();
    await page.addInitScript((types) => {
      // Typade arrayer sparas som { __typed: namn, b64: data }.
      const enc = (v) => {
        if (ArrayBuffer.isView(v)) {
          const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
          let s = '';
          for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
          return { __typed: v.constructor.name, b64: btoa(s) };
        }
        if (Array.isArray(v)) return v.map(enc);
        if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)]));
        return v;
      };
      window.__captured = [];
      const orig = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (msg, transfer) {
        if (msg && msg.request && types.includes(msg.request.type)) window.__captured.push(enc(msg.request));
        return orig.call(this, msg, transfer);
      };
    }, TOOLPATH_TYPES);
    await page.goto(URL);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('desktopcam.lang', 'en');
      localStorage.setItem('desktopcam.welcomeDone', '1');
      localStorage.setItem('desktopcam.tourDone', '1');
      localStorage.setItem('desktopcam.seenVersion', 'x');
    });
    await page.reload();
    await page.waitForFunction(() => window.__dc, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => (window.__captured = []));
    await page.evaluate((exId) => window.__dc.commands.openExample(exId, exId), id);
    // Vänta tills alla banor är uträknade.
    await page.waitForFunction(() => {
      const s = window.__dc.useAppStore.getState();
      return s.toolpaths.length > 0 && !Object.keys(s.progress).length && s.toolpaths.every((tp) => s.results[tp.id] || s.errors[tp.id]);
    }, null, { timeout: 180000 });
    await page.waitForTimeout(500);
    const meta = await page.evaluate(() => {
      const s = window.__dc.useAppStore.getState();
      const m = s.machines.find((x) => x.id === s.machineId);
      return { machineKind: m.kind, workArea: m.workArea, thickness: s.material.thickness, toolpaths: s.toolpaths.map((tp) => tp.name) };
    });
    // Samma jobb kan skickas flera gånger (omräkning när projektet laddats) – spara varje jobb en gång.
    const seen = new Set();
    const requests = (await page.evaluate(() => window.__captured)).filter((r) => {
      const k = JSON.stringify(r);
      return !seen.has(k) && seen.add(k);
    });
    fs.writeFileSync(path.join(OUT, `${id}.json.gz`), zlib.gzipSync(JSON.stringify({ example: id, ...meta, requests }), { level: 9 }));
    console.log(`${id}: ${requests.length} jobb (${requests.map((r) => r.type).join(', ')})`);
    await page.close();
  }
  await browser.close();
})();
