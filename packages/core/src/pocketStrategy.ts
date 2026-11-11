/**
 * Fickfräsning med strategier, som i Vectric, Fusion och Estlcam:
 *
 *  - Mönster: konturparallellt (ringar som följer formen, inifrån och ut)
 *    eller raster (parallella linjer i zigzag i valfri vinkel, följt av ett
 *    varv runt väggen som tar bort trappstegen).
 *  - Fräsriktning: medfräsning (climb) eller motfräsning (conventional).
 *  - Finpass: grovpassen lämnar hud mot väggar och botten; botten rensas
 *    sedan i ett lätt pass på slutdjupet och väggarna fräses till exakt mått.
 *  - Nedgång: rakt ner, ramp längs banan eller spiral (helix) – skonsamt
 *    mot pinnfräsar som inte är gjorda för att borra.
 *
 * Geometrin kommer från avståndsfältet (sdf.ts), som klarar öar och hål.
 */
import { formatNumber } from './gcode';
import type { PocketJob } from './protocol';
import { depthPasses } from './referenceEngine';
import { orient, Track } from './profileStrategy';
import { buildDistanceField, isolines, type DistanceField } from './sdf';
import type { PocketStrategy, StrategyPreset } from './types';

export const POCKET_PRESETS: Record<Exclude<StrategyPreset, 'custom'>, Omit<PocketStrategy, 'preset' | 'pattern' | 'rasterAngle'>> = {
  fast: { direction: 'conventional', finishPass: false, wallAllowance: 0, floorAllowance: 0, finishDirection: 'climb', finishFeedFactor: 1, entry: 'ramp', rampAngle: 10 },
  balanced: { direction: 'conventional', finishPass: true, wallAllowance: 0.3, floorAllowance: 0.2, finishDirection: 'climb', finishFeedFactor: 1, entry: 'helix', rampAngle: 5 },
  fine: { direction: 'conventional', finishPass: true, wallAllowance: 0.5, floorAllowance: 0.3, finishDirection: 'climb', finishFeedFactor: 0.7, entry: 'helix', rampAngle: 3 },
};

export const defaultPocketStrategy = (preset: Exclude<StrategyPreset, 'custom'> = 'balanced', pattern: 'offset' | 'raster' = 'offset'): PocketStrategy => ({
  preset,
  pattern,
  rasterAngle: 0,
  ...POCKET_PRESETS[preset],
});

/** Vilken förinställning motsvarar inställningarna? Mönstret räknas inte. */
export function matchPocketPreset(s: PocketStrategy): StrategyPreset {
  for (const [name, p] of Object.entries(POCKET_PRESETS) as [Exclude<StrategyPreset, 'custom'>, Omit<PocketStrategy, 'preset' | 'pattern' | 'rasterAngle'>][]) {
    if ((Object.keys(p) as (keyof typeof p)[]).every((k) => p[k] === s[k])) return name;
  }
  return 'custom';
}

/* ───────── Hjälpfunktioner för fältet ───────── */

/** Bilinjärt värde i avståndsfältet (negativt inuti). */
function sample(f: DistanceField, x: number, y: number): number {
  const fx = (x - f.x0) / f.cell - 0.5;
  const fy = (y - f.y0) / f.cell - 0.5;
  const i = Math.floor(fx), j = Math.floor(fy);
  if (i < 0 || j < 0 || i >= f.nx - 1 || j >= f.ny - 1) return 1e9;
  const tx = fx - i, ty = fy - j;
  const d = f.d;
  const a = d[j * f.nx + i] * (1 - tx) + d[j * f.nx + i + 1] * tx;
  const b = d[(j + 1) * f.nx + i] * (1 - tx) + d[(j + 1) * f.nx + i + 1] * tx;
  return a * (1 - ty) + b * ty;
}

/** Ligger hela sträckan inom området (fältet under level)? */
function segmentInside(f: DistanceField, ax: number, ay: number, bx: number, by: number, level: number): boolean {
  const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / f.cell));
  for (let k = 0; k <= n; k++) {
    if (sample(f, ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n) > level + 1e-6) return false;
  }
  return true;
}

const loopLength = (p: number[]) => new Track(p, true).length;

/* ───────── Raster ───────── */

interface Seg { ax: number; ay: number; bx: number; by: number; line: number; u0: number; u1: number }

/** Rasterlinjer inom området, länkade till zigzag-kedjor. */
function rasterChains(f: DistanceField, level: number, step: number, angleDeg: number): number[][] {
  const th = (angleDeg * Math.PI) / 180;
  const c = Math.cos(th), s = Math.sin(th);
  // Områdets utbredning i det roterade systemet (u längs linjerna, v tvärs).
  const corners = [
    [f.x0, f.y0], [f.x0 + f.nx * f.cell, f.y0], [f.x0, f.y0 + f.ny * f.cell], [f.x0 + f.nx * f.cell, f.y0 + f.ny * f.cell],
  ];
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  for (const [x, y] of corners) {
    const u = x * c + y * s, v = -x * s + y * c;
    umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v);
  }
  const du = Math.max(f.cell * 0.5, 0.02);
  const lines: Seg[][] = [];
  let li = 0;
  for (let v = vmin + step / 2; v < vmax; v += step, li++) {
    const segs: Seg[] = [];
    let start: number | null = null;
    for (let u = umin; u <= umax + du; u += du) {
      const x = u * c - v * s, y = u * s + v * c;
      const inside = u <= umax && sample(f, x, y) < level;
      if (inside && start === null) start = u;
      if (!inside && start !== null) {
        const u1 = u - du;
        if (u1 - start > 1e-3) segs.push({ ax: start * c - v * s, ay: start * s + v * c, bx: u1 * c - v * s, by: u1 * s + v * c, line: li, u0: start, u1 });
        start = null;
      }
    }
    lines.push(segs);
  }
  // Kedjor: börja i första lediga segment, fortsätt till ett överlappande segment på nästa linje.
  const used = lines.map((l) => l.map(() => false));
  const chains: number[][] = [];
  for (let L = 0; L < lines.length; L++) {
    for (let k = 0; k < lines[L].length; k++) {
      if (used[L][k]) continue;
      used[L][k] = true;
      let seg = lines[L][k];
      let forward = true;
      const pts: number[] = [seg.ax, seg.ay, seg.bx, seg.by];
      for (let M = L + 1; M < lines.length; M++) {
        const endX = pts[pts.length - 2], endY = pts[pts.length - 1];
        let next = -1;
        for (let q = 0; q < lines[M].length; q++) {
          const cand = lines[M][q];
          if (used[M][q] || cand.u1 < seg.u0 || cand.u0 > seg.u1) continue;
          const sx = forward ? cand.bx : cand.ax, sy = forward ? cand.by : cand.ay;
          if (segmentInside(f, endX, endY, sx, sy, level)) { next = q; break; }
        }
        if (next < 0) break;
        used[M][next] = true;
        seg = lines[M][next];
        forward = !forward;
        if (forward) pts.push(seg.ax, seg.ay, seg.bx, seg.by);
        else pts.push(seg.bx, seg.by, seg.ax, seg.ay);
      }
      chains.push(pts);
    }
  }
  return chains;
}

/* ───────── G-kod ───────── */

export function pocketStrategyGcode(job: PocketJob): string {
  const st: PocketStrategy = job.strategy ?? { ...defaultPocketStrategy('fast'), entry: 'plunge' };
  const p = job.post;
  const f = (n: number) => formatNumber(n, p.decimals);
  const r = job.toolDiameter / 2;
  const step = Math.max(0.05, job.toolDiameter * job.stepOver);
  const finish = st.finishPass && (st.wallAllowance > 0 || st.floorAllowance > 0);
  const wall = finish ? Math.max(0, st.wallAllowance) : 0;
  const floor = finish ? Math.min(Math.max(0, st.floorAllowance), job.cutDepth * 0.5) : 0;
  const roughDepth = Math.max(0.01, job.cutDepth - floor);
  const tanA = Math.tan((Math.max(1, Math.min(45, st.rampAngle)) * Math.PI) / 180);

  const field = buildDistanceField(job.groups, { margin: 1 });
  if (!field) throw new Error('NO_CLOSED');
  const roughLevel = -(r + wall);
  const cache = new Map<string, unknown>();
  const cached = <T>(key: string, make: () => T): T => {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key) as T;
  };
  const offsetRings = (base: number) => cached(`rings:${base}`, () => {
    const rings: number[][][] = [];
    for (let k = 0; k < 5000; k++) {
      const loops = isolines(field, base - k * step, 0.01).filter((l) => loopLength(l) > step * 0.5);
      if (!loops.length) break;
      rings.push(loops);
    }
    return rings.reverse(); // inifrån och ut
  });
  const wallLoops = (level: number) => cached(`wall:${level}`, () => isolines(field, level, 0.01).filter((l) => loopLength(l) > 0.1));
  if (!wallLoops(roughLevel).length) throw new Error('TOOL_TOO_LARGE');

  const out: string[] = [
    `; desktopCAM pocket (${st.pattern}${st.pattern === 'raster' ? ` ${st.rasterAngle}°` : ''}, ${finish ? `rough + finish, wall ${wall} mm, floor ${floor} mm` : 'single'}, ${st.entry})`,
    ...p.header,
    'G21',
    'G90',
    `M3 S${Math.round(job.spindleRpm)}`,
    `G0 Z${f(p.safeZ)}`,
  ];
  let lastF = -1;
  let cur = { x: NaN, y: NaN, z: p.safeZ };
  const feed = (v: number) => (v === lastF ? '' : ((lastF = v), ` F${f(v)}`));
  const g1 = (x: number, y: number, z: number, rate: number) => {
    if (Math.abs(x - cur.x) < 1e-9 && Math.abs(y - cur.y) < 1e-9 && Math.abs(z - cur.z) < 1e-9) return;
    out.push(`G1 X${f(x)} Y${f(y)} Z${f(z)}${feed(rate)}`);
    cur = { x, y, z };
  };
  const travel = (x: number, y: number, top: number) => {
    out.push(`G0 Z${f(p.safeZ)}`, `G0 X${f(x)} Y${f(y)}`, `G0 Z${f(top + 0.5)}`);
    cur = { x, y, z: top + 0.5 };
  };

  /**
   * Går ner från zTop till z vid (x, y), där banan sedan börjar. Spiral om
   * det finns plats, annars ramp längs banan (rampPath), annars rakt ner.
   */
  const enter = (x: number, y: number, zTop: number, z: number, level: number, rampPath: Track | null) => {
    const drop = zTop - z;
    if (drop <= 1e-6) return g1(x, y, z, job.plungeRate);
    if (st.entry === 'helix') {
      const h = Math.max(0.2, r * 0.6);
      // Spiralen ska rymmas i området: mitten minst h innanför verktygsbanans gräns.
      if (sample(field, x, y) <= level - h && segmentInside(field, x - h, y, x + h, y, level) && segmentInside(field, x, y - h, x, y + h, level)) {
        const perTurn = 2 * Math.PI * h * tanA;
        const turns = Math.max(1, Math.ceil(drop / perTurn));
        const n = turns * 24;
        g1(x + h, y, zTop, job.plungeRate);
        for (let k = 1; k <= n; k++) {
          const a = (k / 24) * 2 * Math.PI;
          g1(x + h * Math.cos(a), y + h * Math.sin(a), zTop - (drop * k) / n, job.plungeRate);
        }
        for (let k = 1; k <= 24; k++) {
          const a = (k / 24) * 2 * Math.PI;
          g1(x + h * Math.cos(a), y + h * Math.sin(a), z, job.feedRate);
        }
        return g1(x, y, z, job.feedRate);
      }
    }
    if ((st.entry === 'ramp' || st.entry === 'helix') && rampPath && rampPath.length > 0.5) {
      // Fram och tillbaka längs banans början tills djupet är nått.
      const total = drop / tanA;
      const span = Math.min(rampPath.length, Math.max(2 * r, total / 2));
      let s = 0, dir = 1, walked = 0;
      while (walked < total - 1e-9) {
        const stepLen = Math.min(span, total - walked);
        const s1 = s + dir * stepLen;
        const k = Math.max(1, Math.ceil(stepLen / 0.5));
        for (let i = 1; i <= k; i++) {
          const [px, py] = rampPath.at(s + ((s1 - s) * i) / k);
          g1(px, py, zTop - (drop * (walked + (stepLen * i) / k)) / total, job.plungeRate);
        }
        walked += stepLen;
        s = s1;
        dir = -dir;
      }
      // Tillbaka till banans början på rätt djup.
      if (Math.abs(s) > 1e-6) {
        const k = Math.max(1, Math.ceil(Math.abs(s) / 0.5));
        for (let i = 1; i <= k; i++) {
          const [px, py] = rampPath.at(s - (s * i) / k);
          g1(px, py, z, job.feedRate);
        }
      }
      return g1(x, y, z, job.feedRate);
    }
    g1(x, y, z, job.plungeRate);
  };

  /** Kör en sluten ring på djupet z (inklusive nedgång). */
  const cutLoop = (loop: number[], zTop: number, z: number, level: number, rate: number) => {
    travel(loop[0], loop[1], zTop);
    enter(loop[0], loop[1], zTop, z, level, new Track(loop, true));
    for (let i = 2; i <= loop.length; i += 2) {
      const k = i % loop.length;
      g1(loop[k], loop[k + 1], z, rate);
    }
    out.push(`G0 Z${f(p.safeZ)}`);
    cur = { ...cur, z: p.safeZ };
  };

  /** Kör en öppen kedja (raster) på djupet z. */
  const cutChain = (pts: number[], zTop: number, z: number, level: number, rate: number) => {
    travel(pts[0], pts[1], zTop);
    enter(pts[0], pts[1], zTop, z, level, new Track(pts, false));
    for (let i = 2; i < pts.length; i += 2) g1(pts[i], pts[i + 1], z, rate);
    out.push(`G0 Z${f(p.safeZ)}`);
    cur = { ...cur, z: p.safeZ };
  };

  /** Rensar området (ringar eller raster) på ett djup, med `level` som gräns mot väggen. */
  const clear = (zTop: number, z: number, level: number, rate: number, dir: typeof st.direction) => {
    if (st.pattern === 'raster') {
      for (const chain of cached(`raster:${level}`, () => rasterChains(field, level, step, st.rasterAngle))) cutChain(chain, zTop, z, level, rate);
      // Ett varv längs väggen tar bort rasterns trappsteg.
      for (const loop of wallLoops(level)) cutLoop(orient(loop, 'inside', dir), zTop, z, level, rate);
    } else {
      for (const loops of offsetRings(level)) for (const loop of loops) cutLoop(orient(loop, 'inside', dir), zTop, z, level, rate);
    }
  };

  // Grovpass: lager för lager.
  let zPrev = 0;
  for (const depth of depthPasses(roughDepth, job.stepDown)) {
    clear(zPrev, -depth, roughLevel, job.feedRate, st.direction);
    zPrev = -depth;
  }

  if (finish) {
    const rate = job.feedRate * Math.max(0.2, Math.min(1.5, st.finishFeedFactor));
    if (floor > 0) {
      out.push('; finish floor');
      clear(zPrev, -job.cutDepth, roughLevel, rate, st.finishDirection);
    }
    if (wall > 0) {
      out.push('; finish walls');
      // Väggarna i få, djupa steg – huden är tunn.
      let zw = 0;
      for (const depth of depthPasses(job.cutDepth, Math.max(job.stepDown * 3, job.cutDepth / 3))) {
        for (const loop of wallLoops(-r)) cutLoop(orient(loop, 'inside', st.finishDirection), zw, -depth, -r, rate);
        zw = -depth;
      }
    }
  }
  out.push('M5', ...p.footer);
  return out.join('\n') + '\n';
}
