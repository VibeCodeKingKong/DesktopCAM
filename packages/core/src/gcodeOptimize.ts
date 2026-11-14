/**
 * Gör G-koden mindre utan att ändra banan mer än toleransen:
 *
 * - Punkter som ligger på en rak linje slås ihop till en G1.
 * - Punkter som ligger på en cirkelbåge blir en G2 (medurs) eller G3
 *   (moturs) med I/J relativt startpunkten – som GRBL, Marlin, Mach3,
 *   LinuxCNC och FireControl förstår.
 *
 * Bara följder av rena G1-rörelser i XY på samma Z (och samma F/S) slås
 * ihop; allt annat (Z-rörelser, G0, M-koder, väntetider) lämnas orört.
 * Bågen går exakt genom första och sista punkten (cirkeln läggs genom dem),
 * så radien i början och slutet stämmer – annars ger GRBL "arc radius error".
 */
import { formatNumber } from './gcode';

export interface GcodeOptimizeOptions {
  /** Skriv cirkelbågar som G2/G3. Av = bara raka linjer slås ihop. */
  arcs: boolean;
  /** Största avvikelse från ursprungsbanan (mm). */
  tolerance: number;
  decimals: number;
}

const WORD = /([A-Za-z])\s*([-+]?(?:\d+\.?\d*|\.\d+))/g;
type P = [number, number];

interface Circle {
  cx: number;
  cy: number;
  r: number;
}

function circleThrough(a: P, b: P, c: P): Circle | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a[0] * a[0] + a[1] * a[1], b2 = b[0] * b[0] + b[1] * b[1], c2 = c[0] * c[0] + c[1] * c[1];
  const cx = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
  const cy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
  return { cx, cy, r: Math.hypot(a[0] - cx, a[1] - cy) };
}

const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Ryms punkterna i..j på en linje från i till j? */
function fitsLine(p: P[], i: number, j: number, tol: number): boolean {
  const [ax, ay] = p[i], [bx, by] = p[j];
  const L = Math.hypot(bx - ax, by - ay);
  if (L < 1e-9) return false;
  for (let k = i + 1; k < j; k++) {
    const d = Math.abs((bx - ax) * (ay - p[k][1]) - (ax - p[k][0]) * (by - ay)) / L;
    if (d > tol) return false;
    // Punkten måste ligga mellan ändarna (ingen fram-och-tillbaka-rörelse).
    const t = ((p[k][0] - ax) * (bx - ax) + (p[k][1] - ay) * (by - ay)) / (L * L);
    if (t < -1e-6 || t > 1 + 1e-6) return false;
  }
  return true;
}

/** Ryms punkterna i..j på en båge (åt ett håll, mindre än ett varv)? */
function fitArc(p: P[], i: number, j: number, tol: number): { c: Circle; ccw: boolean } | null {
  const m = (i + j) >> 1;
  const c = circleThrough(p[i], p[m], p[j]);
  if (!c || c.r > 2000 || c.r < tol * 4) return null;
  const turn = cross(p[i], p[m], p[j]);
  const ccw = turn > 0;
  let sweep = 0;
  for (let k = i; k <= j; k++) {
    if (Math.abs(Math.hypot(p[k][0] - c.cx, p[k][1] - c.cy) - c.r) > tol) return null;
    if (k > i) {
      const [x0, y0] = p[k - 1], [x1, y1] = p[k];
      // Kordans mitt får inte ligga för långt från bågen (annars blir t.ex. en sexhörning en cirkel).
      const len = Math.hypot(x1 - x0, y1 - y0);
      const sag = c.r - Math.sqrt(Math.max(0, c.r * c.r - (len / 2) ** 2));
      if (sag > tol) return null;
      const a0 = Math.atan2(y0 - c.cy, x0 - c.cx), a1 = Math.atan2(y1 - c.cy, x1 - c.cx);
      let da = a1 - a0;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      if ((da > 0) !== ccw && Math.abs(da) > 1e-9) return null;
      sweep += da;
    }
  }
  if (Math.abs(sweep) > 2 * Math.PI - 0.05) return null;
  return { c, ccw };
}

/** Komprimerar en följd punkter (p[0] = startläget före följden). */
function compressRun(p: P[], o: GcodeOptimizeOptions, tail: string, firstExtra: string): string[] {
  const f = (n: number) => formatNumber(n, o.decimals);
  const out: string[] = [];
  let extra = firstExtra;
  const MAX = 400;
  let i = 0;
  while (i < p.length - 1) {
    // Längsta raka linje.
    let lineEnd = i + 1;
    while (lineEnd + 1 < p.length && lineEnd + 1 - i <= MAX && fitsLine(p, i, lineEnd + 1, o.tolerance)) lineEnd++;
    // Längsta båge (minst 3 delsträckor).
    let arcEnd = -1;
    let arc: ReturnType<typeof fitArc> = null;
    if (o.arcs && i + 3 < p.length) {
      let j = i + 3;
      let fit = fitArc(p, i, j, o.tolerance);
      while (fit && j - i <= MAX) {
        arcEnd = j;
        arc = fit;
        if (j + 1 >= p.length) break;
        fit = fitArc(p, i, j + 1, o.tolerance);
        if (fit) j++;
      }
    }
    if (arc && arcEnd > lineEnd) {
      const [x, y] = p[arcEnd];
      out.push(`${arc.ccw ? 'G3' : 'G2'} X${f(x)} Y${f(y)} I${f(arc.c.cx - p[i][0])} J${f(arc.c.cy - p[i][1])}${tail}${extra}`);
      i = arcEnd;
    } else {
      const [x, y] = p[lineEnd];
      out.push(`G1 X${f(x)} Y${f(y)}${tail}${extra}`);
      i = lineEnd;
    }
    extra = '';
  }
  return out;
}

export function optimizeGcode(src: string, o: GcodeOptimizeOptions): string {
  const lines = src.split('\n');
  const out: string[] = [];
  let x = 0, y = 0, z = 0;
  let mode = 0;
  // Pågående följd av rena G1-rörelser i XY.
  let run: { pts: P[]; z: number; s: string | null; first: string; raw: string[] } | null = null;

  const flush = () => {
    if (!run) return;
    if (run.pts.length > 2) out.push(...compressRun(run.pts, o, run.s !== null ? ` S${run.s}` : '', run.first));
    else out.push(...run.raw);
    run = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    const code = line.split(';')[0].trim();
    const words: Record<string, string> = {};
    let other = false;
    let gCount = 0;
    if (code && !code.startsWith('(')) {
      WORD.lastIndex = 0;
      let m: RegExpExecArray | null;
      let rest = code;
      while ((m = WORD.exec(code))) {
        const L = m[1].toUpperCase();
        if (L === 'G') gCount++;
        if (words[L] !== undefined && L !== 'G') other = true;
        words[L] = m[2];
        rest = rest.replace(m[0], '');
      }
      if (rest.trim()) other = true;
    }
    const g = words.G !== undefined ? parseFloat(words.G) : null;
    if (g === 0 || g === 1) mode = g;
    const nx = words.X !== undefined ? parseFloat(words.X) : x;
    const ny = words.Y !== undefined ? parseFloat(words.Y) : y;
    const nz = words.Z !== undefined ? parseFloat(words.Z) : z;
    const onlyMotion = Object.keys(words).every((k) => ['G', 'X', 'Y', 'Z', 'F', 'S'].includes(k));
    const simple = !!code && !other && gCount <= 1 && (g === 1 || (g === null && mode === 1)) && onlyMotion && (words.X !== undefined || words.Y !== undefined) && Math.abs(nz - z) < 1e-9;

    if (simple) {
      const s = words.S ?? null;
      // En ny matning eller effekt bryter följden; F får bara stå på första raden.
      if (run && (words.F !== undefined || s !== run.s)) flush();
      if (!run) run = { pts: [[x, y]], z, s, first: words.F !== undefined ? ` F${words.F}` : '', raw: [] };
      run.pts.push([nx, ny]);
      run.raw.push(raw);
    } else {
      flush();
      out.push(raw);
    }
    // G92 sätter om koordinaten utan rörelse.
    if (g === 92) {
      if (words.Z !== undefined) z = nz;
      continue;
    }
    if (g === null || g === 0 || g === 1 || g === 2 || g === 3 || (g !== null && g >= 38 && g < 39)) {
      x = nx;
      y = ny;
      z = nz;
    }
  }
  flush();
  return out.join('\n');
}

/**
 * Punkter längs en G2/G3-båge från (x0,y0) till (x1,y1) med centrum (x0+i,y0+j),
 * för förhandsvisning och simulering. Returnerar punkterna efter startpunkten.
 */
export function arcPoints(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, i: number, j: number, cw: boolean, maxSeg = 0.5): [number, number, number][] {
  const cx = x0 + i, cy = y0 + j;
  const r = Math.hypot(i, j);
  const a0 = Math.atan2(y0 - cy, x0 - cx);
  let a1 = Math.atan2(y1 - cy, x1 - cx);
  if (cw) {
    if (a1 >= a0 - 1e-9) a1 -= 2 * Math.PI;
  } else if (a1 <= a0 + 1e-9) a1 += 2 * Math.PI;
  const sweep = a1 - a0;
  const n = Math.max(2, Math.ceil((Math.abs(sweep) * r) / maxSeg));
  const out: [number, number, number][] = [];
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const a = a0 + sweep * t;
    out.push(k === n ? [x1, y1, z1] : [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z0 + (z1 - z0) * t]);
  }
  return out;
}
