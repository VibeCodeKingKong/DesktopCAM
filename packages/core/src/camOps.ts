/**
 * Ficka och borrning. Geometrin (offsetkonturer) beräknas med avståndsfältet,
 * G-koden skrivs här. Körs i workern.
 */
import { formatNumber } from './gcode';
import type { PolylineInput, PocketJob, DrillJob, FacingJob } from './protocol';
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

/**
 * Planfräsning: parallella rader över ytan. Raderna börjar och slutar med
 * verktyget helt utanför ytan (radie + överhäng), så att nedgången sker i
 * luften och kanterna blir rena. Yttersta raderna har verktygets mitt på
 * ytans kant, så att hela ytan täcks.
 */
export function facingGcode(job: FacingJob): string {
  const p = job.post;
  const f = (n: number) => formatNumber(n, p.decimals);
  const r = job.toolDiameter / 2;
  if (!(r > 0) || !(job.depth > 0)) throw new Error('NO_SHAPES');
  const alongX = job.direction === 'x';
  // a = längs raderna, b = tvärs raderna.
  const [a0, a1, b0, b1] = alongX ? [job.x0, job.x1, job.y0, job.y1] : [job.y0, job.y1, job.x0, job.x1];
  if (!(a1 > a0) || !(b1 > b0)) throw new Error('NO_SHAPES');
  const step = Math.max(0.05, job.toolDiameter * Math.min(0.95, Math.max(0.05, job.stepOver)));
  const n = Math.max(1, Math.ceil((b1 - b0) / step - 1e-9));
  const rows = Array.from({ length: n + 1 }, (_, i) => b0 + ((b1 - b0) * i) / n);
  const start = a0 - r - Math.max(0, job.overhang);
  const end = a1 + r + Math.max(0, job.overhang);
  const xy = (a: number, b: number) => (alongX ? `X${f(a)} Y${f(b)}` : `X${f(b)} Y${f(a)}`);

  const out: string[] = ['; desktopCAM facing', ...p.header, 'G21', 'G90', `M3 S${Math.round(job.spindleRpm)}`, `G0 Z${f(p.safeZ)}`];
  const passes = depthPasses(job.depth, job.stepDown);
  passes.forEach((depth, k) => {
    // Returen i enkelriktat läge går 1 mm över förra passets nivå (ännu ej planad yta).
    const lift = Math.min(p.safeZ, -(k > 0 ? passes[k - 1] : 0) + 1);
    out.push(`G0 ${xy(start, rows[0])}`, `G1 Z${f(-depth)} F${f(job.plungeRate)}`);
    rows.forEach((b, i) => {
      if (job.pattern === 'zigzag') {
        const forward = i % 2 === 0;
        // Byte av rad sker utanför ytan, på djupet.
        if (i > 0) out.push(`G1 ${xy(forward ? start : end, b)}`);
        out.push(`G1 ${xy(forward ? end : start, b)}${i === 0 ? ` F${f(job.feedRate)}` : ''}`);
      } else {
        if (i > 0) out.push(`G0 Z${f(lift)}`, `G0 ${xy(start, b)}`, `G1 Z${f(-depth)} F${f(job.plungeRate)}`);
        out.push(`G1 ${xy(end, b)} F${f(job.feedRate)}`);
      }
    });
    out.push(`G0 Z${f(p.safeZ)}`);
  });
  out.push('M5', ...p.footer);
  return out.join('\n') + '\n';
}
