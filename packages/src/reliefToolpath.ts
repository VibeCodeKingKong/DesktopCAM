/**
 * 3D-banor för reliefer med "drop cutter": för varje position sänks verktyget
 * tills det nuddar ytan, med hänsyn till verktygets form (kula, plan, V).
 * Samma algoritm finns i crates/cam-engine/src/relief.rs.
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

/** Rader i sicksack över reliefen; z beräknas av zAt. */
function rasterRows(job: ReliefJob, stepOver: number, zAt: (x: number, y: number) => number): Pt3[][] {
  const { x: ox, y: oy, width, height, nx, ny } = job;
  const alongX = job.direction === 'x';
  const across = alongX ? height : width;
  const alongN = alongX ? nx : ny;
  const along = alongX ? width : height;
  const rows = Math.max(1, Math.ceil(across / stepOver - 1e-9)) + 1;
  const out: Pt3[][] = [];
  for (let k = 0; k < rows; k++) {
    const c = Math.min(k * stepOver, across);
    const row: Pt3[] = [];
    for (let i = 0; i < alongN; i++) {
      const a = (along * i) / (alongN - 1);
      const px = alongX ? ox + a : ox + c;
      const py = alongX ? oy + c : oy + a;
      row.push([px, py, zAt(px, py)]);
    }
    if (k % 2 === 1) row.reverse();
    out.push(simplify(row, 0.005));
  }
  return out;
}

export function reliefGcode(job: ReliefJob): string {
  const p = job.post;
  const f = (n: number) => formatNumber(n, p.decimals);
  const drop = createDropCutter(job);
  const out: string[] = ['; desktopCAM relief', ...p.header, 'G21', 'G90', `M3 S${Math.round(job.spindleRpm)}`, `G0 Z${f(p.safeZ)}`];

  const passes: { rows: Pt3[][] }[] = [];
  if (job.roughing) {
    const levels = depthLevels(job.depth, job.stepDown);
    for (const level of levels) {
      passes.push({ rows: rasterRows(job, job.roughStepOverMm, (x, y) => Math.max(drop(x, y) + job.allowance, -level)) });
    }
  }
  passes.push({ rows: rasterRows(job, job.stepOverMm, drop) });

  let last: Pt3 = [0, 0, 0];
  for (const pass of passes) {
    let first = true;
    for (const row of pass.rows) {
      if (!row.length) continue;
      const [x0, y0, z0] = row[0];
      if (first) {
        out.push(`G0 X${f(x0)} Y${f(y0)}`, `G1 Z${f(z0)} F${f(job.plungeRate)}`);
        first = false;
      } else {
        // Länk till nästa rad: lyft till den högsta av ändpunkterna och mitten så att inget skärs sönder.
        const prev = last;
        const lift = Math.max(prev[2], z0, drop((prev[0] + x0) / 2, (prev[1] + y0) / 2));
        if (lift > prev[2] + 1e-9) out.push(`G1 Z${f(lift)}`);
        out.push(`G1 X${f(x0)} Y${f(y0)}`);
        if (Math.abs(z0 - lift) > 1e-9) out.push(`G1 Z${f(z0)}`);
      }
      row.forEach((q, i) => {
        if (i === 0) return;
        out.push(`G1 X${f(q[0])} Y${f(q[1])} Z${f(q[2])}${i === 1 ? ` F${f(job.feedRate)}` : ''}`);
      });
      last = row[row.length - 1];
    }
    out.push(`G0 Z${f(p.safeZ)}`);
  }
  out.push('M5', ...p.footer);
  return out.join('\n') + '\n';
}
