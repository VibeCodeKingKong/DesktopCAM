/**
 * Styr materialsimuleringen: bygger simulatorn från verktygsbanorna, spelar
 * upp den i realtid (uppsnabbat) och ritar in resultatet i 3D-vyn.
 */
import { getMachine, getMaterialPreset, useAppStore } from '../store/useAppStore';
import type { SceneController } from '../components/viewport/SceneController';
import { buildSimulator, type SimulationSet } from './simulation';
import { plugBlankLayout } from './toolpathService';
import { allShapes } from '../store/useAppStore';
import { mirrorAxis } from './inlayBlank';
import { assembleInlay, type InlayPlacement } from './inlayAssembly';
import type { CellKind } from './inlayAssembly';

/** Limningens animation (ms). */
const GLUE_MS = 3600;

/** Var pluggen ska ligga i fickan, per plugg (banans id). */
let placements = new Map<string, InlayPlacement>();
let assembly: {
  t0: number;
  items: { stock: number; from: { x: number; y: number }; to: { x: number; y: number; z: number }; lift: number; size: { w: number; h: number; t: number } }[];
  heights: Float32Array;
  kind: Uint8Array;
  colors: [number, number, number][];
} | null = null;

/** sRGB → linjär färg, som three.js räknar med i hörnfärgerna. */
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexRgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.replace('#', ''), 16);
  return [linear(((v >> 16) & 255) / 255), linear(((v >> 8) & 255) / 255), linear((v & 255) / 255)];
};
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
import { getT } from '../i18n';

/** En hel körning tar ungefär så här lång tid vid hastighet 1×. */
const BASE_PLAYBACK_SECONDS = 40;

let scene: SceneController | null = null;
let sim: SimulationSet | null = null;
let frame = 0;
let last = 0;
let lastUiUpdate = 0;

export function attachSimulationScene(ctl: SceneController | null) {
  scene = ctl;
  if (!ctl) stopLoop();
  else if (sim) showSim();
}

function showSim() {
  if (!scene || !sim) return;
  scene.setSimulation(
    sim.stocks.map((st) => ({ x: st.x, y: st.y, width: st.sim.material.width, height: st.sim.material.height, thickness: st.sim.material.thickness, nx: st.sim.nx, ny: st.sim.ny, color: st.color })),
  );
  drawn = sim.stocks.map(() => -1);
  draw();
}

/** Senast ritade version per ämne. */
let drawn: number[] = [];

function draw() {
  if (!scene || !sim) return;
  sim.stocks.forEach((st, i) => {
    if (st.sim.version === drawn[i]) return;
    scene!.updateSimulation(i, st.sim.displayHeights(), st.sim.burn, st.sim.nx, st.sim.ny, st.sim.material.thickness, st.sim.tabMark);
    drawn[i] = st.sim.version;
  });
  const done = sim.currentTime >= sim.duration;
  scene.setToolMarker(done ? null : sim.position, sim.jobs[sim.currentJob]?.tool);
}

function syncUi(force = false) {
  if (!sim) return;
  const now = performance.now();
  if (!force && now - lastUiUpdate < 100) return;
  lastUiUpdate = now;
  useAppStore.getState().setSim({ progress: sim.duration ? sim.currentTime / sim.duration : 1, job: sim.jobs[sim.currentJob]?.name ?? '' });
}

function tick(now: number) {
  frame = requestAnimationFrame(tick);
  if (!sim) return;
  const st = useAppStore.getState().sim;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (assembly) {
    animateAssembly(now);
    return;
  }
  if (st.playing) {
    const rate = (sim.duration / BASE_PLAYBACK_SECONDS) * st.speed;
    sim.seek(sim.currentTime + dt * rate);
    if (sim.currentTime >= sim.duration) {
      useAppStore.getState().setSim({ playing: false });
      syncUi(true);
    } else syncUi();
  }
  draw();
}

function startLoop() {
  if (frame) return;
  last = performance.now();
  frame = requestAnimationFrame(tick);
}

function stopLoop() {
  cancelAnimationFrame(frame);
  frame = 0;
}

/** Startar (eller startar om) simuleringen från början. */
export function startSimulation(autoplay = true): boolean {
  const s = useAppStore.getState();
  const t = getT();
  const blanks = plugBlankLayout();
  const plugs = new Map([...blanks].map(([id, b]) => [id, { x: b.displayX, y: b.displayY, color: b.color, width: b.width, height: b.height, thickness: b.thickness }]));
  const next = buildSimulator(s.material, s.toolpaths, s.results, s.tools, getMachine().laser?.sMax ?? 1000, getMaterialPreset().color, plugs);
  const shapes = allShapes(s.layers);
  placements = new Map(
    [...blanks].map(([id, b]) => {
      const tp = s.toolpaths.find((x) => x.id === id);
      return [id, { x0: b.x0, y0: b.y0, cx: mirrorAxis(shapes.filter((sh) => tp?.shapeIds.includes(sh.id))) }];
    }),
  );
  assembly = null;
  if (!next) {
    s.setStatus(t.sim.noToolpaths);
    return false;
  }
  sim = next;
  if (s.editTool === 'tabs') s.setEditTool('select');
  s.setSim({ active: true, playing: autoplay, progress: 0, duration: sim.duration, job: sim.jobs[0]?.name ?? '', inlays: sim.stocks.length - 1, assembly: 'none', fit: [] });
  s.setStatus(t.sim.started);
  showSim();
  startLoop();
  return true;
}

export function playPause() {
  undoAssembly();
  const st = useAppStore.getState().sim;
  if (!sim) {
    startSimulation(true);
    return;
  }
  if (!st.playing && sim.currentTime >= sim.duration) sim.reset();
  useAppStore.getState().setSim({ playing: !st.playing });
  startLoop();
}

/** Hoppar till en punkt (0–1) i körningen. */
export function seekSimulation(fraction: number) {
  if (!sim && !startSimulation(false)) return;
  undoAssembly();
  sim!.seek(fraction * sim!.duration);
  syncUi(true);
  draw();
}

/** Visar slutresultatet direkt. */
export function showFinalResult() {
  if (!sim && !startSimulation(false)) return;
  useAppStore.getState().setSim({ playing: false });
  seekSimulation(1);
}

export function stopSimulation() {
  sim = null;
  stopLoop();
  scene?.setSimulation(null);
  scene?.setToolMarker(null);
  assembly = null;
  useAppStore.getState().setSim({ active: false, playing: false, progress: 0, duration: 0, job: '', inlays: 0, assembly: 'none', fit: [] });
}

/** Simuleringen bygger på banorna när den startades – stäng den om något ändras. */
export function watchSimulationInputs() {
  return useAppStore.subscribe((s, prev) => {
    if (!s.sim.active) return;
    if (s.results !== prev.results || s.material !== prev.material || s.toolpaths !== prev.toolpaths || s.tools !== prev.tools) stopSimulation();
  });
}

/* ───────── Limma och plana (V-inlägg) ───────── */

/** Lägger tillbaka inläggsträet bredvid grundträet och visar fräsningen igen. */
function undoAssembly() {
  if (!sim || useAppStore.getState().sim.assembly === 'none') return;
  assembly = null;
  sim.stocks.forEach((st, i) => scene?.setSimStockTransform(i, { x: st.x, y: st.y, z: 0, rotY: 0, visible: true }));
  drawn = sim.stocks.map(() => -1);
  useAppStore.getState().setSim({ assembly: 'none', fit: [] });
  draw();
}

/**
 * Kör fräsningen till slut, vänder pluggarna, sänker ner dem i fickorna och
 * planar. Visar sedan ytan med grundträ, inlägg och eventuella glipor.
 */
export function glueInlays() {
  if (!sim || sim.stocks.length < 2) return;
  undoAssembly();
  useAppStore.getState().setSim({ playing: false });
  sim.seek(sim.duration);
  syncUi(true);
  draw();
  const s = useAppStore.getState();
  const base = sim.stocks[0].sim;
  const heights = Float32Array.from(base.heights);
  const kind = new Uint8Array(heights.length);
  const fit: (ReturnType<typeof assembleInlay> & { name: string })[] = [];
  const items: NonNullable<typeof assembly>['items'] = [];
  const colors: [number, number, number][] = [];
  sim.stocks.forEach((st, i) => {
    if (i === 0 || !st.plugOf) return;
    const at = placements.get(st.plugOf);
    if (!at) return;
    // Passningen räknas på ett fint rutnät (samma som inläggsträets) över
    // inläggets yta – grundträets grova rutnät missar botten i smala V-spår.
    const m = st.sim.material;
    const rx = 2 * at.cx - at.x0 - m.width, ry = at.y0;
    const fine = sim!.fineBase(rx, ry, m.width, m.height, st.sim.cell);
    const fk = new Uint8Array(fine.heights.length);
    const fh = Float32Array.from(fine.heights);
    const r = assembleInlay(fine, st.sim, at, fk, fh);
    // Över till grundträets rutnät för visningen. Varje inlägg får sitt eget
    // nummer i kind (1, 3 = inlägg, 2 = glipa) – färgen per inlägg sparas separat.
    for (let j = 0; j < base.ny; j++) {
      const fj = Math.round((j * base.cell - ry) / fine.cell);
      if (fj < 0 || fj >= fine.ny) continue;
      for (let i = 0; i < base.nx; i++) {
        const fi = Math.round((i * base.cell - rx) / fine.cell);
        if (fi < 0 || fi >= fine.nx) continue;
        const f = fj * fine.nx + fi;
        if (!fk[f]) continue;
        const k = j * base.nx + i;
        kind[k] = fk[f] + 4 * colors.length;
        heights[k] = fh[f];
      }
    }
    colors.push(hexRgb(st.color));
    const tp = s.toolpaths.find((x) => x.id === st.plugOf);
    fit.push({ ...r, name: tp?.name ?? '' });
    // Lyft så högt att träet kan vändas utan att slå i grundträet.
    items.push({ stock: i, from: { x: st.x, y: st.y }, to: { x: 2 * at.cx - at.x0, y: at.y0, z: -r.sink }, lift: 15 + m.thickness + Math.max(m.width, m.height) / 2, size: { w: m.width, h: m.height, t: m.thickness } });
  });
  assembly = { t0: performance.now(), items, heights, kind, colors };
  scene?.setToolMarker(null);
  useAppStore.getState().setSim({ assembly: 'animating', fit });
  startLoop();
}

function animateAssembly(now: number) {
  if (!assembly || !scene || !sim) return;
  const f = (now - assembly.t0) / GLUE_MS;
  for (const it of assembly.items) {
    // 0–25 %: lyft. 25–65 %: vänd och flytta över fickan. 65–100 %: sänk ner.
    // Träet vänds runt sin mittpunkt c; gruppens origo är dess nedre vänstra hörn.
    const up = ease(f / 0.25), over = ease((f - 0.25) / 0.4), down = ease((f - 0.65) / 0.35);
    const { w, h, t } = it.size;
    const c = { x: w / 2, y: h / 2, z: -t / 2 };
    const start = { x: it.from.x + c.x, y: it.from.y + c.y, z: c.z };
    // Mitten när träet ligger vänt i fickan (origo i to, vänt 180° runt Y).
    const end = { x: it.to.x - c.x, y: it.to.y + c.y, z: it.to.z - c.z };
    const cx = start.x + (end.x - start.x) * over;
    const cy = start.y + (end.y - start.y) * over;
    const cz = start.z + it.lift * up + (end.z - start.z - it.lift) * down;
    const a = Math.PI * over;
    // Gruppens origo = mitten − R(a)·c, där R är vridningen runt Y.
    const rx = c.x * Math.cos(a) + c.z * Math.sin(a), rz = -c.x * Math.sin(a) + c.z * Math.cos(a);
    scene.setSimStockTransform(it.stock, { x: cx - rx, y: cy - c.y, z: cz - rz, rotY: a });
  }
  if (f < 1) return;
  // Planat: inläggsträet är borta, grundträets yta visar inläggen.
  for (const it of assembly.items) scene.setSimStockTransform(it.stock, { x: it.to.x, y: it.to.y, z: it.to.z, rotY: Math.PI, visible: false });
  const base = sim.stocks[0];
  const { kind, colors, heights } = assembly;
  const red = hexRgb('#db2626');
  const yellow = hexRgb('#f9c71a');
  const paint = (k: number): [number, number, number] | null => {
    const v = kind[k] as number;
    if (!v) return null;
    const c = (v % 4) as CellKind;
    if (c === 2) return red;
    if (c === 3) return yellow;
    return colors[Math.floor(v / 4)] ?? null;
  };
  scene.updateSimulation(0, heights, new Float32Array(heights.length), base.sim.nx, base.sim.ny, base.sim.material.thickness, undefined, paint);
  drawn[0] = base.sim.version;
  assembly = null;
  useAppStore.getState().setSim({ assembly: 'done' });
}
