/**
 * 3D-banor för reliefer med "drop cutter": för varje position sänks verktyget
 * tills det nuddar ytan, med hänsyn till verktygets form (kula, plan, V).
 * Samma grundalgoritm finns i crates/cam-engine/src/relief.rs (Wasm-motorn är
 * inte byggd) – där saknas uppdelningen i avsnitt, som behöver föras över
 * innan motorn tas i bruk.
 */
import { formatNumber } from './gcode';
import type { ReliefJob } from './protocol';

export function depthLevels(total: number, step: number): number[] {
  if (total <= 0) return [0];
  const s = step > 0 ? step : total;
  const n = Math.ceil(total / s - 1e-9);
  return Array.from({ length: n }, (_, i) => Math.min(total, s * (i + 1)));
}

/** Hur mycket högre verktygsspetsen sitter än en ytpunkt på radiellt avstånd d. */
function profileOffset(kind: string, r: number, angle: number, d: number): number {
  if (kind === 'ballnose') return r - Math.sqrt(Math.max(0, r * r - d * d));
  if (kind === 'vbit') return d / Math.tan(((angle || 90) * Math.PI) / 360);
  return 0;
}

export function createDropCutter(job: ReliefJob) {
  const { nx, ny, heights, x: ox, y: oy, width, height, depth } = job;
  const dx = width / (nx - 1);
  const dy = height / (ny - 1);
  const r = job.tool.diameter / 2;
  const kind = job.tool.kind;
  const angle = job.tool.angle ?? 90;

  return (px: number, py: number): number => {
    let best = -Infinity;
    // Materialet utanför reliefens rektangel står kvar på Z = 0.
    const edge = Math.min(px - ox, ox + width - px, py - oy, oy + height - py);
    if (edge < r) best = -profileOffset(kind, r, angle, Math.max(0, edge));
    const i0 = Math.max(0, Math.ceil((px - r - ox) / dx));
    const i1 = Math.min(nx - 1, Math.floor((px + r - ox) / dx));
    const j0 = Math.max(0, Math.ceil((py - r - oy) / dy));
    const j1 = Math.min(ny - 1, Math.floor((py + r - oy) / dy));
    for (let j = j0; j <= j1; j++) {
      const sy = oy + j * dy;
      const ddy = sy - py;
      for (let i = i0; i <= i1; i++) {
        const sx = ox + i * dx;
        const d = Math.hypot(sx - px, ddy);
        if (d > r) continue;
        const z = (heights[j * nx + i] - 1) * depth - profileOffset(kind, r, angle, d);
        if (z > best) best = z;
      }
    }
    return best === -Infinity ? 0 : Math.min(0, best);
  };
}

type Pt3 = [number, number, number];

/** Tar bort punkter som ligger på en rät linje (inom tol i Z). */
function simplify(pts: Pt3[], tol: number): Pt3[] {
  if (pts.length < 3) return pts;
  const out: Pt3[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1];
    const b = pts[i + 1];
    const p = pts[i];
    const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const t = span > 0 ? Math.hypot(p[0] - a[0], p[1] - a[1]) / span : 0;
    if (Math.abs(p[2] - (a[2] + (b[2] - a[2]) * t)) > tol) out.push(p);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Rader i sicksack över reliefen, uppdelade i avsnitt där det finns något att
 * skära (need). z beräknas av zAt. Avsnitten förlängs en punkt åt varje håll
 * så att övergångarna blir mjuka.
 */
function rasterRuns(job: ReliefJob, stepOver: number, zAt: (x: number, y: number) => number, need: (x: number, y: number, z: number) => boolean): Pt3[][][] {
  const { x: ox, y: oy, width, height, nx, ny } = job;
  const alongX = job.direction === 'x';
  const across = alongX ? height : width;
  const alongN = alongX ? nx : ny;
  const along = alongX ? width : height;
  const rows = Math.max(1, Math.ceil(across / stepOver - 1e-9)) + 1;
  const out: Pt3[][][] = [];
  for (let k = 0; k < rows; k++) {
    const c = Math.min(k * stepOver, across);
    const pts: Pt3[] = [];
    const on: boolean[] = [];
    for (let i = 0; i < alongN; i++) {
      const a = (along * i) / (alongN - 1);
      const px = alongX ? ox + a : ox + c;
      const py = alongX ? oy + c : oy + a;
      const z = zAt(px, py);
      pts.push([px, py, z]);
      on.push(need(px, py, z));
    }
    const keep = on.map((v, i) => v || on[i - 1] || on[i + 1]);
    let runs: Pt3[][] = [];
    let run: Pt3[] = [];
    pts.forEach((q, i) => {
      if (keep[i]) run.push(q);
      else if (run.length) (runs.push(run), (run = []));
    });
    if (run.length) runs.push(run);
    runs = runs.filter((r) => r.length > 1).map((r) => simplify(r, 0.005));
    if (k % 2 === 1) runs = runs.reverse().map((r) => r.reverse());
    out.push(runs);
  }
  return out;
}

/**
 * Ordnar avsnitten så att närliggande tas i följd (närmaste granne, avsnitt
 * får köras baklänges) – ett område görs klart innan nästa påbörjas.
 */
function orderRuns(runs: Pt3[][]): Pt3[][] {
  const left = runs.slice();
  const out: Pt3[][] = [];
  let at: Pt3 | null = null;
  while (left.length) {
    let best = 0, bestD = Infinity, flip = false;
    if (at) {
      for (let i = 0; i < left.length; i++) {
        const r = left[i];
        const a = r[0], b = r[r.length - 1];
        const da = (a[0] - at[0]) ** 2 + (a[1] - at[1]) ** 2;
        const db = (b[0] - at[0]) ** 2 + (b[1] - at[1]) ** 2;
        if (da < bestD) (bestD = da), (best = i), (flip = false);
        if (db < bestD) (bestD = db), (best = i), (flip = true);
      }
    }
    const r = left.splice(best, 1)[0];
    const run = flip ? r.slice().reverse() : r;
    out.push(run);
    at = run[run.length - 1];
  }
  return out;
}

export function reliefGcode(job: ReliefJob): string {
  const p = job.post;
  const f = (n: number) => formatNumber(n, p.decimals);
  const drop = createDropCutter(job);
  const out: string[] = ['; desktopCAM relief', ...p.header, 'G21', 'G90', `M3 S${Math.round(job.spindleRpm)}`, `G0 Z${f(p.safeZ)}`];
  /** Korta förflyttningar mellan avsnitt sker strax ovanför materialet (inget sticker upp över Z 0). */
  const hopZ = Math.min(p.safeZ, 1);
  const EPS = 0.01;

  // Grovbearbetning: på varje nivå bara där det finns material kvar under
  // förra nivån – inte i luften över redan färdiga eller orörda partier.
  const passes: { runs: Pt3[][]; top: number }[] = [];
  if (job.roughing) {
    let prev = 0;
    for (const level of depthLevels(job.depth, job.stepDown)) {
      const top = -prev;
      const rows = rasterRuns(
        job,
        job.roughStepOverMm,
        (x, y) => Math.min(0, Math.max(drop(x, y) + job.allowance, -level)),
        (_x, _y, z) => z < top - EPS,
      );
      passes.push({ runs: orderRuns(rows.flat()), top });
      prev = level;
    }
  }
  // Finpass: hela ytan utom platta partier som redan ligger på materialets ovansida.
  // Efter grovbearbetningen ligger materialet högst tillägget över ytan.
  const finishRows = rasterRuns(job, job.stepOverMm, (x, y) => Math.min(0, drop(x, y)), (_x, _y, z) => z < -EPS);
  passes.push({ runs: orderRuns(finishRows.flat()), top: job.roughing ? NaN : 0 });

  /** Högsta ytan längs en sträcka (verktygets spets), i steg om ~0,5 mm. */
  const highest = (a: Pt3, b: Pt3) => {
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5));
    let m = Math.max(a[2], b[2]);
    for (let i = 1; i < n; i++) m = Math.max(m, drop(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n));
    return Math.min(0, m);
  };

  let last: Pt3 | null = null;
  for (const pass of passes) {
    for (const run of pass.runs) {
      const [x0, y0, z0] = run[0];
      // Snabbt ner till strax ovanför materialet, sista biten med nedmatning.
      const above = Math.min(hopZ, (Number.isNaN(pass.top) ? Math.min(0, z0 + job.allowance) : pass.top) + 0.5);
      if (!last) {
        out.push(`G0 X${f(x0)} Y${f(y0)}`, `G0 Z${f(above)}`, `G1 Z${f(z0)} F${f(job.plungeRate)}`);
      } else {
        const gap = Math.hypot(x0 - last[0], y0 - last[1]);
        if (gap <= 2 * job.roughStepOverMm + 1e-6) {
          // Nära (nästa rad): lyft till ytans högsta punkt längs länken och gå direkt dit.
          const lift = highest(last, run[0]);
          if (lift > last[2] + 1e-9) out.push(`G1 Z${f(lift)}`);
          out.push(`G1 X${f(x0)} Y${f(y0)}`);
          if (Math.abs(z0 - lift) > 1e-9) out.push(`G1 Z${f(z0)}`);
        } else {
          // Längre bort: kort lyft över materialet, snabbförflyttning, ner igen.
          out.push(`G0 Z${f(hopZ)}`, `G0 X${f(x0)} Y${f(y0)}`, `G0 Z${f(above)}`, `G1 Z${f(z0)} F${f(job.plungeRate)}`);
        }
      }
      run.forEach((q, i) => {
        if (i === 0) return;
        out.push(`G1 X${f(q[0])} Y${f(q[1])} Z${f(q[2])}${i === 1 ? ` F${f(job.feedRate)}` : ''}`);
      });
      last = run[run.length - 1];
    }
  }
  out.push(`G0 Z${f(p.safeZ)}`);
  out.push('M5', ...p.footer);
  return out.join('\n') + '\n';
}
