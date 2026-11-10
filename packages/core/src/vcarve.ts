/**
 * V-gravyr och V-inlägg (inlay) med avståndsfält.
 *
 * En V-fräs vars spets går på konturen på avståndet d från kanten, på djupet
 * d / tan(α/2), nuddar exakt kanten med sin kona. Genom att köra konturer på
 * stigande avstånd byggs hela V-ytan upp – raka väggar blir exakta oavsett
 * konturavstånd, och mittlinjen (medial axis) uppstår av sig själv där
 * konturerna tar slut. Därför behövs ingen separat mediallinjeberäkning.
 *
 * Inlägg (som "V-Inlay" i Vectric VCarve):
 *   Ficka:  V-gravyr av formen, valfritt plant botten på fickdjupet.
 *   Plugg:  formen spegelvänd, V-gravyr runt utsidan med ett startdjup S.
 *           Väggen skär Z = −S exakt på formens kant, så pluggen sjunker ner
 *           S i fickan. Limspalt = fickdjup − S, överskott = pluggdjup − S.
 */
import { formatNumber } from './gcode';
import type { PostprocessorConfig } from './types';
import type { PolylineInput } from './protocol';
import { depthPasses } from './referenceEngine';
import { buildDistanceField, isolines } from './sdf';

export interface VCarveJob {
  groups: PolylineInput[][];
  mode: 'pocket' | 'plug';
  /** V-fräsens spetsvinkel (hela vinkeln), grader. */
  angle: number;
  /** Ficka: största djup (plan botten). Plugg: total fräsdjup runt pluggen. */
  maxDepth: number;
  /** Plugg: djupet där väggen träffar formens kant. */
  startDepth: number;
  /** Plugg: hur brett område runt pluggen som fräses bort (mm). */
  margin: number;
  /** Avstånd mellan konturerna (mm). */
  contourStep: number;
  stepDown: number;
  feedRate: number;
  plungeRate: number;
  spindleRpm: number;
  post: PostprocessorConfig;
}

interface Ring {
  depth: number;
  loops: number[][];
}

/** Konturer och deras djup, från kanten och inåt (ficka) eller utåt (plugg). */
export function vcarveRings(job: VCarveJob): Ring[] {
  const tanA = Math.tan(((job.angle || 60) * Math.PI) / 360);
  const D = job.maxDepth;
  const step = Math.max(0.02, job.contourStep);
  // Plant område: V-fräsen skär 2·D·tan(α/2) brett där – stega tätare än så.
  const flatStep = Math.max(0.02, Math.min(step, 1.6 * D * tanA));
  const rings: Ring[] = [];

  if (job.mode === 'pocket') {
    const field = buildDistanceField(job.groups, { margin: 1, maxCells: 1_500_000 });
    if (!field) return [];
    const dFlat = D * tanA;
    let d = Math.min(step, dFlat > 0 ? dFlat : step);
    let good = 0;
    for (let k = 0; k < 20000; k++) {
      const loops = isolines(field, -d, 0.01);
      if (!loops.length) break;
      rings.push({ depth: Math.min(D, d / tanA), loops });
      good = d;
      d += d < dFlat ? Math.min(step, Math.max(0.02, dFlat - d)) : flatStep;
    }
    // Finputsa mittlinjen: halvera intervallet mot där konturerna försvinner,
    // så att åsen i botten av smala partier blir högst steg/16 hög.
    let bad = d;
    for (let k = 0; k < 4 && good > 0; k++) {
      const mid = (good + bad) / 2;
      const loops = isolines(field, -mid, 0.01);
      if (loops.length) {
        rings.push({ depth: Math.min(D, mid / tanA), loops });
        good = mid;
      } else bad = mid;
    }
    return rings;
  }

  const S = job.startDepth;
  const field = buildDistanceField(job.groups, { margin: job.margin + 1, maxCells: 1_500_000 });
  if (!field) return [];
  const sStart = -S * tanA;
  const sFlat = (D - S) * tanA;
  let s = sStart + step;
  for (let k = 0; k < 20000 && s <= job.margin + 1e-9; k++) {
    const loops = isolines(field, s, 0.01);
    if (loops.length) rings.push({ depth: Math.min(D, S + s / tanA), loops });
    s += s < sFlat ? Math.min(step, Math.max(0.02, sFlat - s)) : flatStep;
  }
  return rings;
}

export function vcarveGcode(job: VCarveJob): string {
  const p = job.post;
  const f = (n: number) => formatNumber(n, p.decimals);
  const rings = vcarveRings(job);
  if (!rings.length) throw new Error('NO_CLOSED');
  const deepest = Math.max(...rings.map((r) => r.depth));
  const out: string[] = [
    `; desktopCAM ${job.mode === 'pocket' ? 'v-carve pocket' : 'v-inlay plug'} (${job.angle}° V-bit)`,
    ...p.header,
    'G21',
    'G90',
    `M3 S${Math.round(job.spindleRpm)}`,
    `G0 Z${f(p.safeZ)}`,
  ];
  let prev = 0;
  for (const level of depthPasses(deepest, job.stepDown)) {
    for (const ring of rings) {
      if (ring.depth <= prev + 1e-6) continue; // redan klar på ett tidigare lager
      const z = -Math.min(ring.depth, level);
      for (const loop of ring.loops) {
        out.push(`G0 X${f(loop[0])} Y${f(loop[1])}`, `G1 Z${f(z)} F${f(job.plungeRate)}`);
        for (let i = 2; i <= loop.length; i += 2) {
          const k = i % loop.length;
          out.push(`G1 X${f(loop[k])} Y${f(loop[k + 1])}${i === 2 ? ` F${f(job.feedRate)}` : ''}`);
        }
        out.push(`G0 Z${f(p.safeZ)}`);
      }
    }
    prev = level;
  }
  out.push('M5', ...p.footer);
  return out.join('\n') + '\n';
}

/** Mått för inläggets passning (mm). */
export function inlayFit(pocketDepth: number, startDepth: number, plugDepth: number) {
  return { glueGap: pocketDepth - startDepth, protrusion: plugDepth - startDepth };
}
