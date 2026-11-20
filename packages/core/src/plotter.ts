/**
 * Penplotter: en penna i stället för fräs. Pennan lyfts och sänks med
 * Z-axeln (pennhållare på t.ex. MPCNC) och ritar när den är nere.
 *
 *  - Rita: pennan följer formernas linjer, öppna som slutna.
 *  - Fyllning: slutna former fylls med parallella linjer, korsskraffering
 *    eller konturer som följer formen.
 *
 * Det viktigaste för en plotter är ordningen: förflyttningar med pennan
 * uppe tar ofta längre tid än själva ritandet. Linjerna ordnas därför så
 * att nästa linje alltid börjar närmast där förra slutade (och vänds om det
 * är närmare), och linjer vars ändar möts ritas utan att pennan lyfts.
 */
import { formatNumber } from './gcode';
import type { PostprocessorConfig } from './types';
import type { PolylineInput } from './protocol';
import { buildDistanceField, isolines } from './sdf';

export interface PlotterSettings {
  /** Z med pennan uppe (mm över papperet). */
  penUp: number;
  /** Z med pennan nere (0 = papperets yta, lite under ger tryck med fjädrande hållare). */
  penDown: number;
  /** Väntetid efter att pennan sänkts, så att bläcket hinner fästa (sekunder). */
  penDelay: number;
}

export const defaultPlotterSettings = (): PlotterSettings => ({ penUp: 3, penDown: -0.5, penDelay: 0.05 });

export interface PlotterJob {
  /** Linjerna som ska ritas, [x0, y0, x1, y1, …]. */
  paths: PolylineInput[];
  /** Ordna linjerna för kortast förflyttning (annars i given ordning). */
  optimize: boolean;
  settings: PlotterSettings;
  /** Ritfart (mm/min). */
  feedRate: number;
  /** Fart när pennan sänks (mm/min). */
  plungeRate: number;
  post: PostprocessorConfig;
}

/* ───────── Ordning ───────── */

type Stroke = number[];

const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;

/** Sluten linje som en öppen följd som börjar och slutar i samma punkt, med start i punkt k. */
function closedFrom(pts: number[], k: number): Stroke {
  const n = pts.length / 2;
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const j = (k + i) % n;
    out.push(pts[2 * j], pts[2 * j + 1]);
  }
  return out;
}

function reverse(s: Stroke): Stroke {
  const out: number[] = [];
  for (let i = s.length - 2; i >= 0; i -= 2) out.push(s[i], s[i + 1]);
  return out;
}

/**
 * Ordnar linjerna: girig närmaste granne från (sx, sy). Öppna linjer kan
 * vändas, slutna kan börja i valfri punkt. Ett rutnät över ändpunkterna
 * gör sökningen snabb även med tiotusentals skrafferingslinjer. `order` får
 * index (i `paths`) för linjerna i den ordning de valdes, `flipped` om en
 * öppen linje körs baklänges.
 */
export function orderPaths(paths: PolylineInput[], sx = 0, sy = 0, order?: number[], flipped?: boolean[]): Stroke[] {
  const src: number[] = [];
  paths.forEach((p, i) => p.points.length >= 4 && src.push(i));
  const items = src.map((i) => paths[i]);
  const n = items.length;
  if (!n) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of items) for (let i = 0; i < p.points.length; i += 2) {
    minX = Math.min(minX, p.points[i]); maxX = Math.max(maxX, p.points[i]);
    minY = Math.min(minY, p.points[i + 1]); maxY = Math.max(maxY, p.points[i + 1]);
  }
  const size = Math.max(1e-6, Math.max(maxX - minX, maxY - minY) / Math.max(1, Math.sqrt(n)));
  const gx = Math.max(1, Math.ceil((maxX - minX) / size) + 1), gy = Math.max(1, Math.ceil((maxY - minY) / size) + 1);
  // Kandidatpunkter: öppna linjer har två ändar; slutna alla sina hörn (gles ut långa).
  const cand: { item: number; vertex: number }[][] = Array.from({ length: gx * gy }, () => []);
  const cellOf = (x: number, y: number) => Math.min(gy - 1, Math.floor((y - minY) / size)) * gx + Math.min(gx - 1, Math.floor((x - minX) / size));
  items.forEach((p, i) => {
    const m = p.points.length / 2;
    const verts = p.closed ? Array.from({ length: m }, (_, k) => k).filter((k) => m <= 64 || k % Math.ceil(m / 64) === 0) : [0, m - 1];
    for (const v of verts) cand[cellOf(p.points[2 * v], p.points[2 * v + 1])].push({ item: i, vertex: v });
  });
  const used = new Uint8Array(n);
  const out: Stroke[] = [];
  let x = sx, y = sy;
  for (let done = 0; done < n; done++) {
    // Sök i växande ringar runt nuvarande punkt tills en kandidat hittats och ringen är längre bort än den.
    const ci = Math.min(gx - 1, Math.max(0, Math.floor((x - minX) / size)));
    const cj = Math.min(gy - 1, Math.max(0, Math.floor((y - minY) / size)));
    let best: { item: number; vertex: number } | null = null;
    let bestD = Infinity;
    for (let r = 0; r <= Math.max(gx, gy); r++) {
      if (best && (r - 1) * size > Math.sqrt(bestD)) break;
      for (let j = cj - r; j <= cj + r; j++) {
        if (j < 0 || j >= gy) continue;
        for (let i = ci - r; i <= ci + r; i++) {
          if (i < 0 || i >= gx || (Math.abs(i - ci) !== r && Math.abs(j - cj) !== r)) continue;
          const list = cand[j * gx + i];
          for (let k = list.length - 1; k >= 0; k--) {
            const c = list[k];
            if (used[c.item]) {
              list[k] = list[list.length - 1];
              list.pop();
              continue;
            }
            const p = items[c.item].points;
            const d = dist2(x, y, p[2 * c.vertex], p[2 * c.vertex + 1]);
            if (d < bestD) {
              bestD = d;
              best = c;
            }
          }
        }
      }
    }
    if (!best) break;
    used[best.item] = 1;
    order?.push(src[best.item]);
    const p = items[best.item];
    let stroke: Stroke;
    if (p.closed) stroke = closedFrom(p.points, best.vertex);
    else stroke = best.vertex === 0 ? p.points.slice() : reverse(p.points);
    flipped?.push(!p.closed && best.vertex !== 0);
    out.push(stroke);
    x = stroke[stroke.length - 2];
    y = stroke[stroke.length - 1];
  }
  return out;
}

/** Slår ihop linjer där nästa börjar där förra slutade – då behöver pennan inte lyftas. */
export function joinStrokes(strokes: Stroke[], tol = 0.01): Stroke[] {
  const out: Stroke[] = [];
  for (const s of strokes) {
    const last = out[out.length - 1];
    // Inte push(...): en spiral kan ha hundratusentals punkter, fler än stacken klarar som argument.
    if (last && dist2(last[last.length - 2], last[last.length - 1], s[0], s[1]) <= tol * tol) for (let i = 2; i < s.length; i++) last.push(s[i]);
    else out.push(s.slice());
  }
  return out;
}

/** Förflyttningslängd med pennan uppe (för att visa vad ordningen sparar). */
export function travelLength(strokes: Stroke[], sx = 0, sy = 0): number {
  let x = sx, y = sy, l = 0;
  for (const s of strokes) {
    l += Math.hypot(s[0] - x, s[1] - y);
    x = s[s.length - 2];
    y = s[s.length - 1];
  }
  return l;
}

/* ───────── Fyllning ───────── */

/**
 * Parallella linjer över slutna former (jämn–udda: hål lämnas tomma), med
 * avståndet spacing och vinkeln angle (grader, 0 = längs X).
 */
export function hatchLines(groups: PolylineInput[][], spacing: number, angle: number): PolylineInput[] {
  const a = (angle * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  const out: PolylineInput[] = [];
  const step = Math.max(0.05, spacing);
  for (const g of groups) {
    // Vrid så att linjerna blir vågräta: (u, v) = R(−a)·(x, y).
    const edges: number[] = [];
    let vMin = Infinity, vMax = -Infinity;
    for (const p of g) {
      if (!p.closed) continue;
      const m = p.points.length / 2;
      for (let k = 0; k < m; k++) {
        const j = (k + 1) % m;
        const x0 = p.points[2 * k], y0 = p.points[2 * k + 1], x1 = p.points[2 * j], y1 = p.points[2 * j + 1];
        const v0 = -s * x0 + c * y0, v1 = -s * x1 + c * y1;
        edges.push(c * x0 + s * y0, v0, c * x1 + s * y1, v1);
        vMin = Math.min(vMin, v0, v1);
        vMax = Math.max(vMax, v0, v1);
      }
    }
    if (!edges.length) continue;
    const xs: number[] = [];
    // Första linjen ett halvt avstånd in, så att den inte ligger på kanten.
    for (let v = Math.ceil((vMin + step / 2) / step) * step - step / 2; v < vMax; v += step) {
      xs.length = 0;
      for (let e = 0; e < edges.length; e += 4) {
        const u0 = edges[e], v0 = edges[e + 1], u1 = edges[e + 2], v1 = edges[e + 3];
        if ((v0 <= v && v1 > v) || (v1 <= v && v0 > v)) xs.push(u0 + ((v - v0) / (v1 - v0)) * (u1 - u0));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        if (xs[k + 1] - xs[k] < 1e-6) continue;
        const back = (u: number) => [c * u - s * v, s * u + c * v];
        out.push({ points: [...back(xs[k]), ...back(xs[k + 1])], closed: false });
      }
    }
  }
  return out;
}

/** Konturer som följer formen inåt med avståndet spacing (som en ficka). */
export function offsetFill(groups: PolylineInput[][], spacing: number, inset: number): PolylineInput[] {
  const field = buildDistanceField(groups, { margin: 1, maxCells: 1_500_000 });
  if (!field) return [];
  const out: PolylineInput[] = [];
  const step = Math.max(0.05, spacing);
  for (let k = 0; k < 5000; k++) {
    const loops = isolines(field, -(inset + k * step), 0.01);
    if (!loops.length) break;
    for (const l of loops) out.push({ points: l, closed: true });
  }
  return out;
}

/* ───────── G-kod ───────── */

export function plotterGcode(job: PlotterJob): string {
  const p = job.post;
  const f = (n: number) => formatNumber(n, p.decimals);
  const st = job.settings;
  let strokes = job.optimize ? orderPaths(job.paths) : job.paths.filter((x) => x.points.length >= 4).map((x) => (x.closed ? closedFrom(x.points, 0) : x.points.slice()));
  strokes = joinStrokes(strokes);
  if (!strokes.length) throw new Error('NO_SHAPES');
  // Marlin läser G4 P som millisekunder men G4 S som sekunder; GRBL läser G4 P som sekunder.
  const dwell = st.penDelay > 0 ? (p.flavor === 'marlin' ? `G4 S${f(st.penDelay)}` : `G4 P${f(st.penDelay)}`) : null;
  const out: string[] = ['; desktopCAM pen plotter', ...p.header, 'G21', 'G90', `G0 Z${f(st.penUp)}`];
  for (const s of strokes) {
    out.push(`G0 X${f(s[0])} Y${f(s[1])}`, `G1 Z${f(st.penDown)} F${f(job.plungeRate)}`);
    if (dwell) out.push(dwell);
    for (let i = 2; i < s.length; i += 2) out.push(`G1 X${f(s[i])} Y${f(s[i + 1])}${i === 2 ? ` F${f(job.feedRate)}` : ''}`);
    out.push(`G0 Z${f(st.penUp)}`);
  }
  out.push(...p.footer);
  return out.join('\n') + '\n';
}
