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
import { buildDistanceField, isolines, type DistanceField } from './sdf';
import { orderPaths } from './plotter';
import { distanceToEdges, medialAxisPaths } from './medialAxis';

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
  /**
   * Högsta tillåtna ås mellan passen på den plana botten (mm). Saknas den
   * stegas lika tätt som konturerna. Inläggets ficka och pluggens spillyta
   * syns inte efteråt och kan stegas glesare.
   */
  flatRidge?: number;
  /**
   * Ficka: 'centerline' låter fräsen följa formens mittlinje med varierande
   * djup (snabbt, som Vectric). 'contours' (standard) fräser konturer inåt.
   */
  strategy?: 'contours' | 'centerline';
  stepDown: number;
  feedRate: number;
  plungeRate: number;
  spindleRpm: number;
  post: PostprocessorConfig;
}

interface Ring {
  depth: number;
  loops: number[][];
  /** Avstånd från formens kant (mm, ficka). */
  dist?: number;
}

/** Bilinjärt värde i avståndsfältet. */
function sampleField(f: DistanceField, x: number, y: number): number {
  const gx = Math.min(f.nx - 1.001, Math.max(0, (x - f.x0) / f.cell - 0.5));
  const gy = Math.min(f.ny - 1.001, Math.max(0, (y - f.y0) / f.cell - 0.5));
  const i = Math.floor(gx), j = Math.floor(gy), tx = gx - i, ty = gy - j;
  const k = j * f.nx + i;
  const a = f.d[k] + (f.d[k + 1] - f.d[k]) * tx;
  const b = f.d[k + f.nx] + (f.d[k + f.nx + 1] - f.d[k + f.nx]) * tx;
  return a + (b - a) * ty;
}

/**
 * Tar bort det som en djupare kontur ändå fräser. En V-fräs som går längs
 * konturen på avståndet d+H, på djupet (d+H)/tan, har konen exakt i väggens
 * lutning – den fräser allt ut till kanten, även konturen på avståndet d.
 * En punkt på konturen d behövs alltså bara där det inte finns någon kontur
 * d+H rakt innanför (nära mittlinjen och i hörnen). Kvar blir korta bitar
 * längs mittlinjen i stället för hundratals hela konturer.
 */
interface CutRing {
  depth: number;
  dist?: number;
  /** Det som behövs på fullt djup (efter rensningen). */
  paths: PolylineInput[];
  /** Hela konturerna (för mellanlagren). */
  loops: number[][];
}

function pruneRings(rings: Ring[], field: DistanceField, dFlat: number): CutRing[] {
  const H = Math.max(0.5, 4 * field.cell);
  const tol = Math.max(0.25 * H, field.cell);
  const h = field.cell;
  return rings.map((ring) => {
    const d = ring.dist ?? 0;
    // Nära den plana botten fräser den djupaste konturen inte hela väggen – behåll allt.
    if (ring.dist === undefined || d + H > dFlat) return { depth: ring.depth, dist: ring.dist, loops: ring.loops, paths: ring.loops.map((points) => ({ points, closed: true })) };
    const paths: PolylineInput[] = [];
    for (const loop of ring.loops) {
      const n = loop.length / 2;
      const need = new Uint8Array(n);
      for (let k = 0; k < n; k++) {
        const x = loop[2 * k], y = loop[2 * k + 1];
        const gx = sampleField(field, x + h, y) - sampleField(field, x - h, y);
        const gy = sampleField(field, x, y + h) - sampleField(field, x, y - h);
        const len = Math.hypot(gx, gy) / (2 * h);
        if (len < 0.6) {
          need[k] = 1; // mittlinjen: lutningen är odefinierad
          continue;
        }
        const nx = -gx / (2 * h * len), ny = -gy / (2 * h * len);
        if (sampleField(field, x + nx * H, y + ny * H) > -(d + H) + tol) need[k] = 1;
      }
      // Lite marginal på var sida om de bitar som behövs.
      const keep = new Uint8Array(n);
      for (let k = 0; k < n; k++) if (need[k]) for (let m = -2; m <= 2; m++) keep[(k + m + n) % n] = 1;
      if (keep.every((v) => v)) {
        paths.push({ points: loop, closed: true });
        continue;
      }
      const start = keep.findIndex((v) => !v);
      if (start < 0) continue;
      let run: number[] = [];
      for (let m = 1; m <= n; m++) {
        const k = (start + m) % n;
        if (keep[k]) run.push(loop[2 * k], loop[2 * k + 1]);
        else if (run.length) {
          if (run.length >= 4) paths.push({ points: run, closed: false });
          run = [];
        }
      }
      if (run.length >= 4) paths.push({ points: run, closed: false });
    }
    return { depth: ring.depth, dist: ring.dist, loops: ring.loops, paths };
  });
}

/** Konturer och deras djup, från kanten och inåt (ficka) eller utåt (plugg). */
export function vcarveRings(job: VCarveJob, out?: { field?: DistanceField; dFlat?: number }): Ring[] {
  const tanA = Math.tan(((job.angle || 60) * Math.PI) / 360);
  const D = job.maxDepth;
  const step = Math.max(0.02, job.contourStep);
  // Plant område: V-fräsen skär 2·D·tan(α/2) brett där – stega tätare än så.
  // Åsen mellan två pass med V-fräs på avståndet s är s/(2·tan) hög.
  const ridgeStep = job.flatRidge ? 2 * job.flatRidge * tanA : step;
  const flatStep = Math.max(0.02, Math.min(Math.max(step, ridgeStep), 1.6 * D * tanA));
  const rings: Ring[] = [];

  if (job.mode === 'pocket') {
    const field = buildDistanceField(job.groups, { margin: 1, maxCells: 1_500_000 });
    if (!field) return [];
    const dFlat = D * tanA;
    if (out) Object.assign(out, { field, dFlat });
    let d = Math.min(step, dFlat > 0 ? dFlat : step);
    let good = 0;
    for (let k = 0; k < 20000; k++) {
      const loops = isolines(field, -d, 0.01);
      if (!loops.length) break;
      rings.push({ depth: Math.min(D, d / tanA), loops, dist: d });
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
        rings.push({ depth: Math.min(D, mid / tanA), loops, dist: mid });
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
  // Öar: områden som marginalen runt formerna stänger in (t.ex. mellan
  // bokstäver vars serifer möts) ligger längre bort än marginalen och skulle
  // stå kvar ofrästa. De sitter fast i pluggen och hindrar den från att gå
  // ner i fickan – fräs bort dem också, på pluggdjupet.
  // En ö är rutor längre bort än marginalen som inte nås från fältets kant
  // utan att passera marginalen. Allt annat räknas som "inuti" i ett eget
  // fält, så att konturerna bara går runt öarna – bortom fältets kant blir
  // konturerna i det vanliga fältet meningslösa.
  const { nx, ny, d } = field;
  const outside = new Uint8Array(nx * ny);
  const stack: number[] = [];
  for (let i = 0; i < nx; i++) stack.push(i, (ny - 1) * nx + i);
  for (let j = 0; j < ny; j++) stack.push(j * nx, j * nx + nx - 1);
  while (stack.length) {
    const k = stack.pop()!;
    if (outside[k] || d[k] <= job.margin) continue;
    outside[k] = 1;
    const i = k % nx, j = (k - i) / nx;
    if (i > 0) stack.push(k - 1);
    if (i < nx - 1) stack.push(k + 1);
    if (j > 0) stack.push(k - nx);
    if (j < ny - 1) stack.push(k + nx);
  }
  let islands = false;
  const islandField = { ...field, d: Float32Array.from(d, (v, k) => (outside[k] ? -1 : v)) };
  for (let k = 0; k < d.length; k++) if (!outside[k] && d[k] > job.margin) islands = true;
  if (islands) {
    for (let k = 0; k < 20000; k++) {
      const loops = isolines(islandField, s, 0.01);
      if (!loops.length) break;
      rings.push({ depth: D, loops });
      s += flatStep;
    }
  }
  return rings;
}

export function vcarveGcode(job: VCarveJob): string {
  const p = job.post;
  const f = (n: number) => formatNumber(n, p.decimals);
  const info: { field?: DistanceField; dFlat?: number } = {};
  const raw = vcarveRings(job, info);
  if (!raw.length) throw new Error('NO_CLOSED');
  const centerline = job.mode === 'pocket' && job.strategy === 'centerline' && !!info.field;
  const tanA = Math.tan(((job.angle || 60) * Math.PI) / 360);
  // Mittlinjen: bara den plana botten fräses med konturer, resten följer mittlinjen.
  const rings: CutRing[] = centerline
    ? raw.filter((r) => r.depth >= job.maxDepth - 1e-6).map((r) => ({ depth: r.depth, dist: r.dist, loops: r.loops, paths: r.loops.map((points) => ({ points, closed: true })) }))
    : info.field
      ? pruneRings(raw, info.field, info.dFlat ?? 0)
      : raw.map((r) => ({ depth: r.depth, dist: r.dist, loops: r.loops, paths: r.loops.map((points) => ({ points, closed: true })) }));
  // Mittlinjen med djupet i varje punkt: avståndet till kanten / tan(α/2), högst plana djupet.
  const axis = centerline
    ? medialAxisPaths(job.groups).flatMap((pts) => {
        // Där mittlinjen når plana djupet rensar de plana passen redan – dela upp kedjan där.
        const zs = distanceToEdges(job.groups, pts).map((r) => Math.min(job.maxDepth, r / tanA));
        const flat = (i: number) => zs[i] >= job.maxDepth - 1e-6;
        const parts: { pts: number[]; zs: number[] }[] = [];
        let cur: { pts: number[]; zs: number[] } | null = null;
        for (let i = 0; i < zs.length; i++) {
          // Behåll en punkt in i det plana så att övergången fräses.
          const keep = !flat(i) || (i > 0 && !flat(i - 1)) || (i + 1 < zs.length && !flat(i + 1));
          if (keep) {
            cur ??= { pts: [], zs: [] };
            cur.pts.push(pts[2 * i], pts[2 * i + 1]);
            cur.zs.push(zs[i]);
          } else if (cur) {
            parts.push(cur);
            cur = null;
          }
        }
        if (cur) parts.push(cur);
        return parts.filter((q) => q.zs.length >= 2);
      })
    : [];
  if (centerline && !axis.length && !rings.length) throw new Error('NO_CLOSED');
  const deepest = Math.max(0, ...rings.map((r) => r.depth), ...axis.map((a) => Math.max(...a.zs)));
  const out: string[] = [
    `; desktopCAM ${job.mode === 'pocket' ? 'v-carve pocket' : 'v-inlay plug'} (${job.angle}° V-bit)`,
    ...p.header,
    'G21',
    'G90',
    `M3 S${Math.round(job.spindleRpm)}`,
    `G0 Z${f(p.safeZ)}`,
  ];
  let prev = 0;
  let x = 0, y = 0;
  const levels = depthPasses(deepest, job.stepDown);
  for (const level of levels) {
    // Allt som fräses på det här lagret, i närmaste-granne-ordning (kortare förflyttningar).
    const items: { path: PolylineInput; z: number; zs?: number[] }[] = [];
    // Mittlinjen på varje lager, med djupet begränsat till lagret.
    for (const a of axis) if (Math.max(...a.zs) > prev + 1e-6) items.push({ path: { points: a.pts, closed: false }, z: 0, zs: a.zs.map((v) => -Math.min(v, level)) });
    // Konturer som är djupare än lagret fräses här bara plant på lagrets djup.
    // Där räcker ett glesare urval (V-fräsen är 2·djup·tan bred där) – det
    // som står kvar tas av nästa lager, och sista lagret fräser allt.
    const spacing = Math.max(job.contourStep, 1.4 * level * tanA);
    let lastDist = -Infinity;
    for (const ring of [...rings].sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0))) {
      if (ring.depth <= prev + 1e-6) continue; // redan klar på ett tidigare lager
      if (ring.depth <= level + 1e-6) {
        for (const path of ring.paths) items.push({ path, z: -ring.depth });
        continue;
      }
      if (ring.dist !== undefined && ring.dist - lastDist < spacing) continue;
      lastDist = ring.dist ?? lastDist;
      for (const points of ring.loops) items.push({ path: { points, closed: true }, z: -level });
    }
    const order: number[] = [];
    const flipped: boolean[] = [];
    const strokes = orderPaths(items.map((it) => it.path), x, y, order, flipped);
    strokes.forEach((st, k) => {
      const it = items[order[k]];
      // Mittlinjen: djup per punkt (vänd om linjen kördes baklänges).
      let zs = it.zs;
      if (zs && flipped[k]) zs = [...zs].reverse();
      const z0 = zs ? zs[0] : it.z;
      // Snabbt ner till strax ovanför ytan, sedan matning (spåren under är redan fräsade).
      out.push(`G0 X${f(st[0])} Y${f(st[1])}`, `G0 Z${f(Math.min(p.safeZ, 0.5))}`, `G1 Z${f(z0)} F${f(job.plungeRate)}`);
      for (let i = 2; i < st.length; i += 2) out.push(`G1 X${f(st[i])} Y${f(st[i + 1])}${zs ? ` Z${f(zs[i / 2])}` : ''}${i === 2 ? ` F${f(job.feedRate)}` : ''}`);
      out.push(`G0 Z${f(p.safeZ)}`);
      x = st[st.length - 2];
      y = st[st.length - 1];
    });
    prev = level;
  }
  out.push('M5', ...p.footer);
  return out.join('\n') + '\n';
}

/** Mått för inläggets passning (mm). */
export function inlayFit(pocketDepth: number, startDepth: number, plugDepth: number) {
  return { glueGap: pocketDepth - startDepth, protrusion: plugDepth - startDepth };
}
