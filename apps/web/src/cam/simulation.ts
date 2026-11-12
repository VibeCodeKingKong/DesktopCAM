/**
 * Materialsimulering: materialets ovansida är ett höjdfält som verktyget
 * "fräser ner" rörelse för rörelse enligt G-koden. Lasergravyr bränner
 * (mörkar) ytan, laserskärning skär igenom.
 *
 * Simuleringen kan spolas till vilken tidpunkt som helst: framåt räknas bara
 * de nya rörelserna, bakåt börjar den om från början (det går snabbt).
 */
import type { MaterialSetup, ToolDefinition, ToolpathConfig } from '@desktopcam/core';
import type { ToolpathResult } from '../store/useAppStore';

const RAPID_RATE = 3000; // mm/min, samma antagande som tidsuppskattningen
const WORD = /([A-Za-z])\s*([-+]?(?:\d+\.?\d*|\.\d+))/g;

export type SimToolShape = { kind: 'endmill' | 'ballnose' | 'vbit' | 'drill' | 'laser' | 'plasma'; radius: number; angle: number };

interface Move {
  /** Startpunkt och slutpunkt. */
  x0: number; y0: number; z0: number;
  x1: number; y1: number; z1: number;
  cut: boolean;
  /** Laserns effekt 0–1 (0 för fräs). */
  power: number;
  t0: number;
  t1: number;
  job: number;
}

export interface SimJob {
  name: string;
  tool: SimToolShape;
  /** Laserskärning: skär genom hela materialet där strålen går. */
  laserCut: boolean;
  /** Profil med flikar: Z för flikarnas ovansida (markeras i simuleringen). */
  tabTop?: number;
}

/** Tolkar G-koden till rörelser med tider (sekunder i maskintid). */
/**
 * laser/plasma: strålen eller ljusbågen skär bara när den är tänd (M3/M4 … M5).
 * Plasma kräver inget S-värde. G4 (väntetid) räknas in i tiden, G92 och
 * höjdavkänning (G38) flyttar inte verktyget i simuleringen.
 */
function parseMoves(gcode: string, job: number, startTime: number, sMax: number, laser: boolean, plasma = false): { moves: Move[]; end: number } {
  const moves: Move[] = [];
  const beam = laser || plasma;
  let x = 0, y = 0, z = 5, mode = 0, feed = 1000, s = 0, on = !beam;
  let t = startTime;
  for (const raw of gcode.split('\n')) {
    const line = raw.replace(/\(.*?\)/g, '').split(';')[0].trim();
    if (!line) continue;
    if (/\bG(92|38(\.\d)?)\b/i.test(line)) continue;
    let nx = x, ny = y, nz = z, moved = false, dwell = false;
    WORD.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WORD.exec(line))) {
      const v = parseFloat(m[2]);
      switch (m[1].toUpperCase()) {
        case 'G': if (v === 0 || v === 1) mode = v; else if (v === 4) dwell = true; break;
        case 'P': if (dwell) t += v; break;
        case 'M': if (v === 3 || v === 4) on = true; else if (v === 5) on = !beam; break;
        case 'X': nx = v; moved = true; break;
        case 'Y': ny = v; moved = true; break;
        case 'Z': nz = v; moved = true; break;
        case 'F': if (v > 0) feed = v; break;
        case 'S': s = v; break;
      }
    }
    if (!moved) continue;
    const len = Math.hypot(nx - x, ny - y, nz - z);
    if (len > 0) {
      const cut = mode === 1 && (plasma ? on : !laser || (on && s > 0));
      const dt = (len / (mode === 0 ? RAPID_RATE : feed)) * 60;
      moves.push({ x0: x, y0: y, z0: z, x1: nx, y1: ny, z1: nz, cut, power: laser ? Math.min(1, s / sMax) : 0, t0: t, t1: t + dt, job });
      t += dt;
    }
    x = nx; y = ny; z = nz;
  }
  return { moves, end: t };
}

export class StockSimulator {
  readonly nx: number;
  readonly ny: number;
  readonly cell: number;
  /** Z för varje punkt (0 = orört, −tjocklek = genom), rad för rad nerifrån. */
  readonly heights: Float32Array;
  /** Bränningsgrad 0–1 för lasergravyr. */
  readonly burn: Float32Array;
  /** 1 där en flik står kvar (verktyget lyfte över materialet). */
  readonly tabMark: Uint8Array;
  /**
   * Kantutjämning: där fräsens kant bara delvis täcker en rutpunkt sparas det
   * djupaste delvisa snittet och hur stor del av rutan det täckte. Visningen
   * lägger väggen mellan rutpunkterna i stället för som ett trappsteg.
   */
  private partZ: Float32Array;
  private partC: Float32Array;
  private display: Float32Array;
  readonly duration: number;
  readonly jobs: SimJob[];
  private moves: Move[];
  private index = 0;
  private time = 0;
  /** Verktygets aktuella position (spetsen). */
  position = { x: 0, y: 0, z: 5 };
  currentJob = 0;
  version = 0;

  constructor(
    readonly material: { width: number; height: number; thickness: number },
    jobs: { job: SimJob; gcode: string }[],
    sMax: number,
  ) {
    const { width, height } = material;
    this.cell = Math.max(0.2, Math.max(width, height) / 700);
    this.nx = Math.max(2, Math.round(width / this.cell) + 1);
    this.ny = Math.max(2, Math.round(height / this.cell) + 1);
    this.heights = new Float32Array(this.nx * this.ny);
    this.burn = new Float32Array(this.nx * this.ny);
    this.tabMark = new Uint8Array(this.nx * this.ny);
    this.partZ = new Float32Array(this.nx * this.ny);
    this.partC = new Float32Array(this.nx * this.ny);
    this.display = new Float32Array(this.nx * this.ny);
    this.jobs = jobs.map((j) => j.job);
    const all: Move[] = [];
    let t = 0;
    jobs.forEach((j, i) => {
      const r = parseMoves(j.gcode, i, t, sMax, j.job.tool.kind === 'laser', j.job.tool.kind === 'plasma');
      all.push(...r.moves);
      t = r.end;
    });
    this.moves = all;
    this.duration = t;
    if (all.length) this.position = { x: all[0].x0, y: all[0].y0, z: all[0].z0 };
  }

  get currentTime() {
    return this.time;
  }

  reset() {
    this.heights.fill(0);
    this.burn.fill(0);
    this.tabMark.fill(0);
    this.partZ.fill(0);
    this.partC.fill(0);
    this.index = 0;
    this.time = 0;
    if (this.moves.length) this.position = { x: this.moves[0].x0, y: this.moves[0].y0, z: this.moves[0].z0 };
    this.version++;
  }

  /** Kör simuleringen fram (eller tillbaka) till tidpunkten t (sekunder). */
  seek(t: number) {
    t = Math.max(0, Math.min(this.duration, t));
    if (t < this.time) this.reset();
    const moves = this.moves;
    let changed = false;
    while (this.index < moves.length && moves[this.index].t1 <= t) {
      const mv = moves[this.index];
      if (mv.cut) {
        this.sweep(mv, 0, 1);
        changed = true;
      }
      this.index++;
    }
    let partial = 0;
    const mv = moves[this.index];
    if (mv && t > mv.t0) {
      partial = (t - mv.t0) / (mv.t1 - mv.t0);
      if (mv.cut) {
        this.sweep(mv, 0, partial);
        changed = true;
      }
    }
    const ref = mv ?? moves[moves.length - 1];
    if (ref) {
      const f = mv ? partial : 1;
      this.position = { x: ref.x0 + (ref.x1 - ref.x0) * f, y: ref.y0 + (ref.y1 - ref.y0) * f, z: ref.z0 + (ref.z1 - ref.z0) * f };
      this.currentJob = ref.job;
    }
    this.time = t;
    if (changed) this.version++;
  }

  /** Stämplar verktyget längs en del av rörelsen (från a till b, 0–1). */
  private sweep(mv: Move, a: number, b: number) {
    const job = this.jobs[mv.job];
    const len = Math.hypot(mv.x1 - mv.x0, mv.y1 - mv.y0, mv.z1 - mv.z0) * (b - a);
    const steps = Math.max(1, Math.ceil(len / (this.cell * 0.5)));
    for (let k = 0; k <= steps; k++) {
      const f = a + ((b - a) * k) / steps;
      this.stamp(mv.x0 + (mv.x1 - mv.x0) * f, mv.y0 + (mv.y1 - mv.y0) * f, mv.z0 + (mv.z1 - mv.z0) * f, job, mv.power);
    }
  }

  private stamp(x: number, y: number, z: number, job: SimJob, power: number) {
    const tool = job.tool;
    const { cell, nx, ny, heights } = this;
    const floor = -this.material.thickness;
    const R = Math.max(tool.radius, cell * 0.5);
    // Rutor ut till en halv ruta utanför kanten kan vara delvis täckta.
    const reach = R + cell * 0.5;
    const i0 = Math.max(0, Math.floor((x - reach) / cell)), i1 = Math.min(nx - 1, Math.ceil((x + reach) / cell));
    const j0 = Math.max(0, Math.floor((y - reach) / cell)), j1 = Math.min(ny - 1, Math.ceil((y + reach) / cell));
    if (i0 > i1 || j0 > j1) return;
    const R2 = R * R, reach2 = reach * reach;
    const tanHalf = Math.tan(((tool.angle || 90) * Math.PI) / 360);
    for (let j = j0; j <= j1; j++) {
      const dy = j * cell - y;
      for (let i = i0; i <= i1; i++) {
        const dx = i * cell - x;
        const r2 = dx * dx + dy * dy;
        if (r2 > reach2) continue;
        const k = j * nx + i;
        if (tool.kind === 'laser' || tool.kind === 'plasma') {
          if (r2 > R2) continue;
          if (job.laserCut) heights[k] = floor;
          else this.burn[k] = Math.min(1, this.burn[k] + power * 0.5);
          continue;
        }
        if (z >= 0) continue;
        const r = Math.sqrt(r2);
        const rr = Math.min(r, R);
        let zt = z;
        if (tool.kind === 'ballnose') zt = z + R - Math.sqrt(Math.max(0, R2 - rr * rr));
        else if (tool.kind === 'vbit') zt = z + rr / tanHalf;
        zt = Math.max(floor, zt);
        // Andel av rutan innanför fräsens kant (linjärt över en ruta).
        const cover = Math.min(1, Math.max(0, 0.5 + (R - r) / cell));
        if (cover >= 1) {
          if (zt < heights[k]) {
            heights[k] = zt;
            if (job.tabTop !== undefined && Math.abs(zt - job.tabTop) < 0.05) this.tabMark[k] = 1;
          }
        } else if (cover > 0) {
          if (zt < this.partZ[k] - 1e-4) {
            this.partZ[k] = zt;
            this.partC[k] = cover;
          } else if (zt < this.partZ[k] + 1e-4 && cover > this.partC[k]) this.partC[k] = cover;
        }
      }
    }
  }

  /** Höjderna för visning, med kantutjämnade väggar. */
  displayHeights(): Float32Array {
    const { heights, partZ, partC, display } = this;
    for (let k = 0; k < heights.length; k++) {
      const h = heights[k];
      display[k] = partZ[k] < h ? h + (partZ[k] - h) * partC[k] : h;
    }
    return display;
  }
}

/** Bygger simuleringen av alla synliga, beräknade verktygsbanor i listans ordning. */
export function buildSimulator(
  material: MaterialSetup,
  toolpaths: ToolpathConfig[],
  results: Record<string, ToolpathResult>,
  tools: ToolDefinition[],
  sMax: number,
): StockSimulator | null {
  const jobs: { job: SimJob; gcode: string }[] = [];
  for (const tp of toolpaths) {
    const res = results[tp.id];
    if (!tp.visible || !res) continue;
    const tool = tools.find((t) => t.id === tp.toolId);
    const laser = tp.operation === 'laserCut' || tp.operation === 'laserRaster';
    const shape: SimToolShape =
      tp.operation === 'plasmaCut'
        ? { kind: 'plasma', radius: Math.max(0.1, tp.kerf / 2), angle: 0 }
        : laser
          ? { kind: 'laser', radius: Math.max(0.05, (tp.operation === 'laserCut' ? tp.kerf : tp.lineIntervalMm) / 2), angle: 0 }
          : { kind: (tool?.kind ?? 'endmill') as SimToolShape['kind'], radius: (tool?.diameter ?? 3) / 2, angle: tool?.angle ?? 90 };
    let tabTop: number | undefined;
    if (tp.operation === 'profile' && tp.side !== 'on' && tp.tabs?.enabled) {
      const finalDepth = Math.max(0, tp.cutDepth - Math.max(0, tp.strategy?.onionSkin ?? 0));
      const top = -(finalDepth - Math.min(tp.tabs.height, finalDepth));
      if (top < -0.05) tabTop = top;
    }
    jobs.push({ job: { name: tp.name, tool: shape, laserCut: tp.operation === 'laserCut' || tp.operation === 'plasmaCut', tabTop }, gcode: res.gcode });
  }
  if (!jobs.length) return null;
  return new StockSimulator(material, jobs, sMax);
}
