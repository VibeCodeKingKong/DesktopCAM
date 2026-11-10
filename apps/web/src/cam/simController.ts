/**
 * Styr materialsimuleringen: bygger simulatorn från verktygsbanorna, spelar
 * upp den i realtid (uppsnabbat) och ritar in resultatet i 3D-vyn.
 */
import { getMachine, getMaterialPreset, useAppStore } from '../store/useAppStore';
import type { SceneController } from '../components/viewport/SceneController';
import { buildSimulator, type StockSimulator } from './simulation';
import { getT } from '../i18n';

/** En hel körning tar ungefär så här lång tid vid hastighet 1×. */
const BASE_PLAYBACK_SECONDS = 40;

let scene: SceneController | null = null;
let sim: StockSimulator | null = null;
let frame = 0;
let last = 0;
let drawnVersion = -1;
let lastUiUpdate = 0;

export function attachSimulationScene(ctl: SceneController | null) {
  scene = ctl;
  if (!ctl) stopLoop();
  else if (sim) showSim();
}

function showSim() {
  if (!scene || !sim) return;
  scene.setSimulation({ ...sim.material, nx: sim.nx, ny: sim.ny, color: getMaterialPreset().color });
  drawnVersion = -1;
  draw();
}

function draw() {
  if (!scene || !sim) return;
  if (sim.version !== drawnVersion) {
    scene.updateSimulation(sim.heights, sim.burn, sim.nx, sim.ny, sim.material.thickness, sim.tabMark);
    drawnVersion = sim.version;
  }
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
  const next = buildSimulator(s.material, s.toolpaths, s.results, s.tools, getMachine().laser?.sMax ?? 1000);
  if (!next) {
    s.setStatus(t.sim.noToolpaths);
    return false;
  }
  sim = next;
  if (s.editTool === 'tabs') s.setEditTool('select');
  s.setSim({ active: true, playing: autoplay, progress: 0, duration: sim.duration, job: sim.jobs[0]?.name ?? '' });
  s.setStatus(t.sim.started);
  showSim();
  startLoop();
  return true;
}

export function playPause() {
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
  useAppStore.getState().setSim({ active: false, playing: false, progress: 0, duration: 0, job: '' });
}

/** Simuleringen bygger på banorna när den startades – stäng den om något ändras. */
export function watchSimulationInputs() {
  return useAppStore.subscribe((s, prev) => {
    if (!s.sim.active) return;
    if (s.results !== prev.results || s.material !== prev.material || s.toolpaths !== prev.toolpaths || s.tools !== prev.tools) stopSimulation();
  });
}
