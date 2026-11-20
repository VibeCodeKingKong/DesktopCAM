/**
 * Bygger exempelprojekten i välkomstfönstret och deras bilder.
 *
 *   cd apps/web && npx vite --port 5199 &   (utvecklingsläge – devHooks.ts)
 *   node scripts/build-examples.cjs http://localhost:5199 [id …]
 *
 * Varje exempel byggs med appens egna kommandon, banorna räknas ut, och
 * bilden är slutresultatet i simuleringen. Resultatet hamnar i
 * public/examples/<id>.dcam och <id>.webp. Kör om skriptet när banorna eller
 * simuleringen ändras så att bilderna stämmer med appen.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2] || 'http://localhost:5199';
const ONLY = process.argv.slice(3);
const OUT = path.join(__dirname, '..', 'public', 'examples');

/* Körs i sidan: hjälpfunktioner för exemplen. */
function pageHelpers() {
  const dc = window.__dc;
  const S = () => dc.useAppStore.getState();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const add = (shape) => {
    S().addShape(shape);
    return shape.id;
  };
  const select = (ids) => S().setSelection(ids);
  const text = async (content, font, height, x, y) => {
    await dc.loadFont(font);
    // Mitten av texten hamnar i (x, y).
    const sh = dc.buildTextShape({ content, font, height, spacing: 0, align: 'left', x: 0, y: 0 });
    const b = dc.core.shapesBounds([sh]);
    return dc.core.transformShape(sh, dc.core.translate(x - (b.min.x + b.max.x) / 2, y - (b.min.y + b.max.y) / 2));
  };
  const lib = (id, w, h, cx, cy, params) => {
    const item = dc.core.SHAPE_LIBRARY.find((x) => x.id === id);
    // Namnen är nycklar som översätts när exemplet öppnas (localizeExample).
    return dc.core.buildLibraryShape(item, `lib:${id}`, w, h, params ?? dc.core.DEFAULT_SHAPE_PARAMS, cx, cy);
  };
  const reset = (machineId, material) => {
    dc.commands.newProject();
    S().setMachine(machineId);
    S().setMaterial(material);
  };
  /** Ett landskap med berg, sol och sjö – motiv för foto-exemplen. */
  const landscape = async () => {
    const W = 900, H = 600;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0, '#0f1b2e');
    sky.addColorStop(0.55, '#c98f55');
    sky.addColorStop(1, '#fff1cf');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    const sun = g.createRadialGradient(610, 300, 10, 610, 300, 200);
    sun.addColorStop(0, 'rgba(255,250,230,1)');
    sun.addColorStop(0.18, 'rgba(255,240,200,0.95)');
    sun.addColorStop(1, 'rgba(255,220,160,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, W, H);
    // Bergskedjor med slumpad mittpunktsförskjutning (fast frö = samma bild varje gång).
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
    const ridge = (base, rough, color) => {
      let pts = [base + rnd() * rough, base + rnd() * rough];
      for (let k = 0, r = rough; k < 8; k++, r *= 0.55) {
        const next = [];
        for (let i = 0; i < pts.length - 1; i++) next.push(pts[i], (pts[i] + pts[i + 1]) / 2 + rnd() * r);
        next.push(pts[pts.length - 1]);
        pts = next;
      }
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, H);
      pts.forEach((y, i) => g.lineTo((i / (pts.length - 1)) * W, y));
      g.lineTo(W, H);
      g.fill();
    };
    ridge(300, 160, '#7a6e7e');
    ridge(340, 140, '#433c4f');
    ridge(380, 110, '#1c1924');
    // Sjön: spegling av himlen och solen.
    const lake = g.createLinearGradient(0, 410, 0, H);
    lake.addColorStop(0, '#e8c9a0');
    lake.addColorStop(1, '#0d1220');
    g.fillStyle = lake;
    g.fillRect(0, 410, W, H - 410);
    g.fillStyle = 'rgba(255,245,215,0.75)';
    for (let i = 0; i < 26; i++) g.fillRect(610 - 70 + Math.sin(i * 1.7) * 30 + i, 418 + i * 7, 140 - i * 4, 2.2);
    ridge(470, 50, '#08070b');
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return new File([blob], 'landscape.png', { type: 'image/png' });
  };
  /** Väntar tills alla banor är uträknade. */
  const computed = async () => {
    for (let i = 0, calm = 0; i < 600; i++) {
      await sleep(250);
      const s = S();
      const done = s.toolpaths.every((t) => s.results[t.id] || s.errors[t.id]) && !Object.keys(s.progress).length;
      calm = done ? calm + 1 : 0;
      if (calm >= 4) break;
    }
    const s = S();
    return s.toolpaths.map((t) => `${t.name}: ${s.errors[t.id] ? 'FEL ' + s.errors[t.id] : (s.results[t.id].warnings ?? []).join('; ') || 'ok'}`);
  };
  window.__ex = { dc, S, sleep, add, select, text, lib, reset, landscape, computed };
}

/** Exemplen: maskin, material, hur projektet byggs och hur bilden tas. */
const EXAMPLES = [
  {
    id: 'router-sign',
    view: 'iso',
    build: async () => {
      const { S, add, select, text, lib, reset, dc } = window.__ex;
      reset('mpcnc-primo', { presetId: 'oak', width: 300, height: 150, thickness: 15 });
      const frame = add(lib('frame-plaque', 270, 120, 150, 75, { band: 6, spacing: 8 }));
      const label = add(await text('EST. 2026', 'cinzel', 30, 150, 75));
      select([frame, label]);
      dc.commands.createToolpath('vcarve');
      const outline = add(dc.core.makeRect('rect:1', 6, 6, 288, 138));
      select([outline]);
      dc.commands.createToolpath('profile');
      S().selectToolpath(null);
    },
  },
  {
    id: 'router-inlay',
    view: 'iso',
    glue: true,
    build: async () => {
      const { add, select, lib, reset, dc } = window.__ex;
      reset('mpcnc-primo', { presetId: 'oak', width: 200, height: 180, thickness: 18 });
      const heart = add(lib('heart', 120, 110, 100, 90));
      select([heart]);
      dc.commands.createInlay();
    },
  },
  {
    id: 'router-relief',
    view: 'iso',
    build: async () => {
      const { S, reset, dc } = window.__ex;
      const process_relief = window.__relief || 'rosette';
      reset('mpcnc-primo', { presetId: 'pine', width: 200, height: 200, thickness: 18 });
      dc.commands.addRelief(process_relief, { width: 170, height: 170, depth: 8 }, { invert: false, mirror: false });
      S().updateRelief(S().reliefs[0].id, { x: 15, y: 15 });
      dc.commands.createToolpath('relief');
      S().selectToolpath(null);
    },
  },
  {
    id: 'router-gears',
    view: 'top',
    build: async () => {
      const { S, add, select, reset, dc } = window.__ex;
      reset('mpcnc-primo', { presetId: 'birch-ply', width: 260, height: 150, thickness: 12 });
      const g1 = add(dc.core.makeGear('gear:1', 78, 75, 62, 54, 22));
      const g2 = add(dc.core.makeGear('gear:2', 190, 75, 44, 36, 15));
      const h1 = add(dc.core.makeCircle('circle:1', 78, 75, 8));
      const h2 = add(dc.core.makeCircle('circle:2', 190, 75, 6));
      select([h1, h2]);
      dc.commands.createToolpath('pocket');
      select([g1, g2]);
      dc.commands.createToolpath('profile');
      S().selectToolpath(null);
    },
  },
  {
    id: 'laser-photo',
    view: 'top',
    build: async () => {
      const { S, reset, landscape, dc } = window.__ex;
      reset('creality-falcon2-22w', { presetId: 'birch-ply', width: 200, height: 140, thickness: 3 });
      const id = await dc.importImage(await landscape());
      S().updateImageObject(id, { widthMm: 180, x: 10, y: 10 });
      await dc.commands.importPhotoForEngraving();
      const tp = S().toolpaths[0];
      S().updateToolpath(tp.id, { params: { ...tp.params, laserPowerPct: 70 } });
      S().selectToolpath(null);
    },
  },
  {
    id: 'laser-coaster',
    view: 'top',
    build: async () => {
      const { S, add, select, lib, text, reset, dc } = window.__ex;
      reset('creality-falcon2-22w', { presetId: 'birch-ply', width: 120, height: 120, thickness: 3 });
      const sun = add(lib('sunburst', 84, 84, 60, 60));
      const ring = add(dc.core.makeCircle('circle:1', 60, 60, 46));
      select([sun, ring]);
      dc.commands.createLineEngraving();
      const word = add(await text('SOL', 'bebas-neue', 14, 60, 54));
      select([word]);
      dc.commands.createToolpath('laserCut', { side: 'on' });
      const edge = add(dc.core.makeCircle('circle:2', 60, 60, 55));
      select([edge]);
      dc.commands.createToolpath('laserCut');
      S().selectToolpath(null);
    },
  },
  {
    id: 'plasma-shield',
    view: 'top',
    build: async () => {
      const { S, add, select, lib, reset, dc } = window.__ex;
      reset('langmuir-crossfire-pro', { presetId: 'mild-steel', width: 240, height: 260, thickness: 3 });
      const shield = add(lib('shield', 190, 220, 120, 130));
      const star = add(lib('star', 90, 90, 120, 140));
      const h1 = add(dc.core.makeCircle('circle:1', 70, 205, 6));
      const h2 = add(dc.core.makeCircle('circle:2', 170, 205, 6));
      select([shield, star, h1, h2]);
      dc.commands.createToolpath('plasmaCut');
      S().selectToolpath(null);
    },
  },
  {
    id: 'pen-spiral',
    view: 'top',
    build: async () => {
      const { S, reset, landscape, dc } = window.__ex;
      reset('mpcnc-primo-pen', { presetId: 'paper' });
      const id = await dc.importImage(await landscape());
      S().updateImageObject(id, { widthMm: 240, x: 28.5, y: 25 });
      await dc.commands.importImageForPlotter();
      const tp = S().toolpaths[0];
      S().updateToolpath(tp.id, { image: { ...tp.image, method: 'spiral', spacing: 1.6, contrast: 1.4 } });
      S().selectToolpath(null);
    },
  },
  {
    id: 'pen-card',
    view: 'top',
    build: async () => {
      const { S, add, select, lib, reset, dc } = window.__ex;
      reset('mpcnc-primo-pen', { presetId: 'paper' });
      const frame = add(lib('frame-double', 270, 186, 148.5, 105, { band: 6, spacing: 8 }));
      const heart = add(lib('heart', 80, 74, 100, 105));
      const star = add(lib('star', 84, 84, 200, 105));
      select([frame, heart, star]);
      dc.commands.createToolpath('penDraw');
      select([heart]);
      const red = S().tools.find((x) => x.id === 'pen-gel-08-red');
      dc.commands.createToolpath('penFill', { toolId: red.id, pattern: 'cross', spacing: 1.6 });
      select([star]);
      const gold = S().tools.find((x) => x.id === 'pen-gold-10');
      dc.commands.createToolpath('penFill', { toolId: gold.id, pattern: 'offset', spacing: 2 });
      S().selectToolpath(null);
    },
  },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('desktopcam.lang', 'en');
    localStorage.setItem('desktopcam.tourDone', '1');
    localStorage.setItem('desktopcam.welcomeDone', '1');
  });
  await page.reload();
  await page.waitForFunction(() => window.__dc);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  // Bara 3D-vyn på bilden: dölj knappar och rutor ovanpå den.
  await page.addStyleTag({ content: 'main [data-tour="viewport"] > div > div:not(:first-child), main > div > div:not(:first-child){display:none!important}' });
  await page.evaluate(pageHelpers);
  if (process.env.RELIEF) await page.evaluate((r) => (window.__relief = r), process.env.RELIEF);

  for (const ex of EXAMPLES) {
    if (ONLY.length && !ONLY.includes(ex.id)) continue;
    const t0 = Date.now();
    await page.evaluate(ex.build);
    const report = await page.evaluate(() => window.__ex.computed());
    const project = await page.evaluate(() => {
      const p = window.__dc.commands.projectJson();
      return JSON.stringify({ ...p, projectName: '', savedAt: undefined });
    });
    fs.writeFileSync(path.join(OUT, `${ex.id}.dcam`), project);

    // Slutresultatet i simuleringen.
    await page.evaluate(async ({ view, glue }) => {
      const { dc, S, sleep } = window.__ex;
      dc.useAppStore.getState().setTab('simulate');
      dc.sim.startSimulation(false);
      dc.sim.showFinalResult();
      await sleep(800);
      if (glue) {
        dc.sim.glueInlays();
        for (let i = 0; i < 200 && S().sim.assembly !== 'done'; i++) await sleep(100);
        await sleep(400);
      }
      S().sendViewCommand(view);
      await sleep(400);
      S().sendViewCommand('fitStock');
      await sleep(300);
      await sleep(900);
    }, { view: ex.view, glue: !!ex.glue });
    // Utsnitt runt ämnet (alla åtta hörn projicerade på skärmen), 3:2 med marginal.
    const main = await page.locator('main').boundingBox();
    const r = await page.evaluate(() => {
      const { width, height, thickness } = window.__dc.useAppStore.getState().material;
      const pts = [];
      for (const x of [0, width]) for (const y of [0, height]) for (const z of [0, -thickness]) pts.push(window.__scene.worldToScreen(x, y, z));
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    });
    if (process.env.DEBUG) console.log(JSON.stringify({ r, main }));
    let w = (r.x1 - r.x0) * 1.12, h = (r.y1 - r.y0) * 1.12;
    if (w / h > 1.5) h = w / 1.5;
    else w = h * 1.5;
    w = Math.min(w, main.width);
    h = Math.min(h, main.height, w / 1.5);
    w = h * 1.5;
    const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
    const clip = {
      x: main.x + Math.max(0, Math.min(main.width - w, cx - w / 2)),
      y: main.y + Math.max(0, Math.min(main.height - h, cy - h / 2)),
      width: w,
      height: h,
    };
    const png = await page.screenshot({ clip });
    const webp = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = 720;
      c.height = 480;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', 0.82).split(',')[1];
    }, png.toString('base64'));
    fs.writeFileSync(path.join(OUT, `${ex.id}.webp`), Buffer.from(webp, 'base64'));
    await page.evaluate(() => window.__dc.sim.stopSimulation());
    console.log(`${ex.id} (${((Date.now() - t0) / 1000).toFixed(0)} s, ${(project.length / 1024).toFixed(0)} kB): ${report.join(' | ')}`);
  }
  if (errors.length) console.log('Fel i sidan:', errors);
  await browser.close();
})();
