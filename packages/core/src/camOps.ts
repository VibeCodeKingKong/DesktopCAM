/**
 * Ficka och borrning. Geometrin (offsetkonturer) beräknas med avståndsfältet,
 * G-koden skrivs här. Körs i workern.
 */
import { formatNumber } from './gcode';
import type { PolylineInput, PocketJob, DrillJob } from './protocol';
import { buildDistanceField, isolines } from './sdf';
import { depthPasses } from './referenceEngine';

function loopLength(p: number[]) {
  let l = 0;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    l += Math.hypot(p[j] - p[i], p[j + 1] - p[i + 1]);
  }
  return l;
}

/** Konturparallell ficka: ringar från mitten och ut, alla djup i tur och ordning. */
export function pocketLoops(groups: PolylineInput[][], toolRadius: number, stepOver: number): number[][][] {
  const field = buildDistanceField(groups, { margin: 1 });
  if (!field) return [];
  const rings: number[][][] = [];
  const step = Math.max(0.05, stepOver);
  for (let k = 0; k < 5000; k++) {
    const loops = isolines(field, -(toolRadius + k * step), 0.01).filter((l) => loopLength(l) > step * 0.5);
    if (!loops.length) break;
    rings.push(loops);
  }
  return rings.reverse();
}

export function pocketGcode(job: PocketJob): string {
  const p = job.post;
  const f = (n: number) => formatNumber(n, p.decimals);
  const rings = pocketLoops(job.groups, job.toolDiameter / 2, job.toolDiameter * job.stepOver);
  if (!rings.length) throw new Error('TOOL_TOO_LARGE');
  const out: string[] = ['; desktopCAM pocket', ...p.header, 'G21', 'G90', `M3 S${Math.round(job.spindleRpm)}`, `G0 Z${f(p.safeZ)}`];
  for (const depth of depthPasses(job.cutDepth, job.stepDown)) {
    for (const loops of rings) {
      for (const loop of loops) {
        out.push(`G0 X${f(loop[0])} Y${f(loop[1])}`, `G1 Z${f(-depth)} F${f(job.plungeRate)}`);
        for (let i = 2; i <= loop.length; i += 2) {
          const k = i % loop.length;
          out.push(`G1 X${f(loop[k])} Y${f(loop[k + 1])}${i === 2 ? ` F${f(job.feedRate)}` : ''}`);
        }
        out.push(`G0 Z${f(p.safeZ)}`);
      }
    }
  }
  out.push('M5', ...p.footer);
  return out.join('\n') + '\n';
}

export function drillGcode(job: DrillJob): string {
  const p = job.post;
  const f = (n: number) => formatNumber(n, p.decimals);
  if (!job.points.length) throw new Error('NO_HOLES');
  const out: string[] = ['; desktopCAM drill', ...p.header, 'G21', 'G90', `M3 S${Math.round(job.spindleRpm)}`, `G0 Z${f(p.safeZ)}`];
  const pecks = depthPasses(job.depth, job.peckDepth > 0 ? job.peckDepth : job.depth);
  for (const pt of job.points) {
    out.push(`G0 X${f(pt.x)} Y${f(pt.y)}`, 'G0 Z0.5');
    pecks.forEach((d, i) => {
      if (i > 0) out.push(`G0 Z${f(-pecks[i - 1] + 0.3)}`);
      out.push(`G1 Z${f(-d)} F${f(job.plungeRate)}`);
      // Lyft ur hålet mellan hacken för att få bort spånen.
      out.push(i < pecks.length - 1 ? 'G0 Z0.5' : `G0 Z${f(p.safeZ)}`);
    });
  }
  out.push('M5', ...p.footer);
  return out.join('\n') + '\n';
}
