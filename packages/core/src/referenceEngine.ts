/**
 * TypeScript-referensmotor. Speglar Rust-motorn rad för rad så att appen
 * fungerar även innan Wasm har byggts, och fungerar som facit i tester.
 */
import type { CamEngine } from './engine';
import { formatNumber } from './gcode';
import { offsetPolygon } from './geometry';
import { reliefGcode } from './reliefToolpath';
import type { ProfileJob, RasterJob } from './protocol';
import type { DitherMethod, Vec2 } from './types';

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function depthPasses(total: number, step: number): number[] {
  if (total <= 0) return [0];
  const s = step > 0 ? step : total;
  const n = Math.ceil(total / s - 1e-9);
  return Array.from({ length: n }, (_, i) => Math.min(total, s * (i + 1)));
}

function toPoints(flat: number[]): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i + 1] });
  return pts;
}

export function createReferenceEngine(): CamEngine {
  return {
    kind: 'typescript',
    version: '0.1.0',

    profileGcode(job: ProfileJob): string {
      const p = job.post;
      const f = (n: number) => formatNumber(n, p.decimals);
      const out: string[] = [
        `; desktopCAM ${job.mode === 'laser' ? 'laser cut' : 'profile'}`,
        ...p.header,
        'G21',
        'G90',
      ];
      const polys = job.polylines.map((pl) => {
        const pts = toPoints(pl.points);
        return { closed: pl.closed, pts: pl.closed ? offsetPolygon(pts, job.offset) : pts };
      });

      if (job.mode === 'router') {
        out.push(`M3 S${Math.round(job.spindleRpm)}`, `G0 Z${f(p.safeZ)}`);
        const depths = depthPasses(job.cutDepth, job.stepDown);
        for (const { closed, pts } of polys) {
          if (pts.length < 2) continue;
          const route = closed ? [...pts.slice(1), pts[0]] : pts.slice(1);
          out.push(`G0 X${f(pts[0].x)} Y${f(pts[0].y)}`);
          depths.forEach((d, i) => {
            if (i > 0 && !closed) {
              out.push(`G0 Z${f(p.safeZ)}`, `G0 X${f(pts[0].x)} Y${f(pts[0].y)}`);
            }
            out.push(`G1 Z${f(-d)} F${f(job.plungeRate)}`);
            route.forEach((q, j) => out.push(`G1 X${f(q.x)} Y${f(q.y)}${j === 0 ? ` F${f(job.feedRate)}` : ''}`));
          });
          out.push(`G0 Z${f(p.safeZ)}`);
        }
        out.push('M5');
      } else {
        out.push(`${p.laserDynamicPower ? 'M4' : 'M3'} S0`);
        const passes = Math.max(1, Math.round(job.passes));
        for (let pass = 0; pass < passes; pass++) {
          for (const { closed, pts } of polys) {
            if (pts.length < 2) continue;
            const route = closed ? [...pts.slice(1), pts[0]] : pts.slice(1);
            out.push(`G0 X${f(pts[0].x)} Y${f(pts[0].y)} S0`);
            route.forEach((q, j) =>
              out.push(`G1 X${f(q.x)} Y${f(q.y)} S${f(job.laserS)}${j === 0 ? ` F${f(job.feedRate)}` : ''}`),
            );
          }
        }
        out.push('M5');
      }
      out.push(...p.footer);
      return out.join('\n') + '\n';
    },

    dither(gray: Uint8Array, width: number, height: number, method: DitherMethod, threshold: number): Uint8Array {
      const out = new Uint8Array(width * height);
      if (method === 'threshold') {
        for (let i = 0; i < out.length; i++) out[i] = gray[i] < threshold ? 1 : 0;
        return out;
      }
      if (method === 'ordered') {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const t = (BAYER4[(y % 4) * 4 + (x % 4)] + 0.5) * 16;
            out[y * width + x] = gray[y * width + x] < t ? 1 : 0;
          }
        }
        return out;
      }
      // Floyd–Steinberg
      const buf = Float32Array.from(gray);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          const old = buf[i];
          const nv = old < threshold ? 0 : 255;
          out[i] = nv === 0 ? 1 : 0;
          const err = old - nv;
          if (x + 1 < width) buf[i + 1] += (err * 7) / 16;
          if (y + 1 < height) {
            if (x > 0) buf[i + width - 1] += (err * 3) / 16;
            buf[i + width] += (err * 5) / 16;
            if (x + 1 < width) buf[i + width + 1] += err / 16;
          }
        }
      }
      return out;
    },

    reliefGcode,

    rasterGcode(bits: Uint8Array, job: RasterJob): string {
      const p = job.post;
      const f = (n: number) => formatNumber(n, p.decimals);
      const { width: w, height: h, pixelSizeMm: ps } = job;
      if (bits.length !== w * h) throw new Error('Bildens storlek stämmer inte med bitmappen');
      const out: string[] = ['; desktopCAM laser raster', ...p.header, 'G21', 'G90', `${p.laserDynamicPower ? 'M4' : 'M3'} S0`];
      let firstFeed = true;
      for (let row = 0; row < h; row++) {
        const y = job.originY + (h - 1 - row) * ps;
        const runs: [number, number][] = [];
        let col = 0;
        while (col < w) {
          if (bits[row * w + col] === 1) {
            const st = col;
            while (col < w && bits[row * w + col] === 1) col++;
            runs.push([st, col]);
          } else col++;
        }
        if (!runs.length) continue;
        const ltr = row % 2 === 0;
        if (!ltr) runs.reverse();
        for (const [a, b] of runs) {
          const xa = job.originX + a * ps;
          const xb = job.originX + b * ps;
          const [from, to] = ltr ? [xa, xb] : [xb, xa];
          out.push(`G0 X${f(from)} Y${f(y)} S0`);
          out.push(`G1 X${f(to)} S${f(job.laserS)}${firstFeed ? ` F${f(job.feedRate)}` : ''}`);
          firstFeed = false;
        }
      }
      out.push('M5', ...p.footer);
      return out.join('\n') + '\n';
    },
  };
}
