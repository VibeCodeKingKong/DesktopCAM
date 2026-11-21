/**
 * Spårning av bilder till vektorer (Smart Trace): papperets hörn, perspektiv-
 * korrigering, objekt och skisser till konturer, och linjer till mittlinjer.
 *
 * Egen kod, inga beroenden. Metoderna är klassiska och allmänt publicerade:
 * Otsus tröskel (1979), sammanhängande komponenter, marching squares
 * (via isolines i sdf.ts), Douglas–Peucker (1973), konvext hölje (Andrews
 * monotona kedja), homografi med fyra punkter (DLT) och Zhang–Suens
 * uttunning (1984). Potrace (GPL) används inte.
 *
 * Koordinater i pixlar med origo uppe till vänster (bildens), om inget annat
 * sägs. Omvandlingen till mm sker i traceToMm.
 */
import { isolines, simplifyClosed, type DistanceField } from './sdf';
import { flattenBackground, otsuThreshold } from './imageRelief';

export type P2 = [number, number];

/* ───────── Hjälpfunktioner ───────── */

/** Boxoskärpa i två pass (separabel), radie r. */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src;
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    const row = y * w;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / (2 * r + 1);
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1);
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** Sammanhängande komponenter (8-grannar) i en mask. Returnerar etikett per pixel (0 = ingen). */
function label(mask: Uint8Array, w: number, h: number): { labels: Int32Array; count: number; area: number[]; touches: boolean[] } {
  const labels = new Int32Array(w * h);
  const area = [0], touches = [false];
  let count = 0;
  const stack: number[] = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || labels[s]) continue;
    count++;
    let a = 0, edge = false;
    labels[s] = count;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      a++;
      const x = i % w, y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w || (!dx && !dy)) continue;
          const j = yy * w + xx;
          if (mask[j] && !labels[j]) {
            labels[j] = count;
            stack.push(j);
          }
        }
      }
    }
    area.push(a);
    touches.push(edge);
  }
  return { labels, count, area, touches };
}

/** Morfologisk öppning/stängning med kvadratiskt element (radie r) – tar bort brus och sluter små glipor. */
function morph(mask: Uint8Array, w: number, h: number, r: number, op: 'open' | 'close'): Uint8Array {
  if (r < 1) return mask;
  const f = new Float32Array(mask.length);
  for (let i = 0; i < f.length; i++) f[i] = mask[i];
  // Erosion = alla grannar satta (medel ≈ 1), dilation = någon granne satt (medel > 0).
  const erode = (m: Float32Array) => boxBlur(m, w, h, r).map((v) => (v > 0.999 ? 1 : 0));
  const dilate = (m: Float32Array) => boxBlur(m, w, h, r).map((v) => (v > 0.001 ? 1 : 0));
  const res = op === 'open' ? dilate(erode(f)) : erode(dilate(f));
  return Uint8Array.from(res);
}

/* ───────── Papper och perspektiv ───────── */

/** Konvext hölje (Andrews monotona kedja), moturs i bildkoordinater. */
function convexHull(pts: P2[]): P2[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [], upper: P2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

const triArea = (a: P2, b: P2, c: P2) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;

/** Ordnar fyra hörn: uppe vänster, uppe höger, nere höger, nere vänster (bildkoordinater). */
export function orderQuad(q: P2[]): P2[] {
  const c: P2 = [q.reduce((s, p) => s + p[0], 0) / 4, q.reduce((s, p) => s + p[1], 0) / 4];
  const sorted = [...q].sort((a, b) => Math.atan2(a[1] - c[1], a[0] - c[0]) - Math.atan2(b[1] - c[1], b[0] - c[0]));
  // Börja i hörnet närmast uppe till vänster (minst x + y).
  let k = 0;
  sorted.forEach((p, i) => p[0] + p[1] < sorted[k][0] + sorted[k][1] && (k = i));
  return [0, 1, 2, 3].map((i) => sorted[(k + i) % 4]);
}

/**
 * Hittar ett ljust papper (största ljusa ytan) och dess fyra hörn. Fungerar
 * bäst med papperet på en mörkare yta. Returnerar null om inget hittas.
 */
export function detectPaper(gray: Uint8Array, w: number, h: number): P2[] | null {
  const t = otsuThreshold(gray);
  let mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) mask[i] = gray[i] > t ? 1 : 0;
  mask = morph(mask, w, h, Math.max(1, Math.round(Math.min(w, h) / 200)), 'open');
  const { labels, count, area } = label(mask, w, h);
  if (!count) return null;
  let best = 1;
  for (let l = 2; l <= count; l++) if (area[l] > area[best]) best = l;
  if (area[best] < w * h * 0.05) return null;
  // Höljet runt papperets kantpixlar (räcker med pixlar som har en granne utanför).
  const pts: P2[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (labels[i] !== best) continue;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || labels[i - 1] !== best || labels[i + 1] !== best || labels[i - w] !== best || labels[i + w] !== best) pts.push([x, y]);
    }
  let hull = convexHull(pts);
  if (hull.length < 4) return null;
  // Ta bort det hörn som förlorar minst yta tills fyra återstår.
  while (hull.length > 4) {
    let k = 0, least = Infinity;
    for (let i = 0; i < hull.length; i++) {
      const a = triArea(hull[(i - 1 + hull.length) % hull.length], hull[i], hull[(i + 1) % hull.length]);
      if (a < least) (least = a), (k = i);
    }
    hull.splice(k, 1);
  }
  const quad = refineQuad(orderQuad(hull), pts, Math.max(w, h));
  // Rimlighet: fyrhörningen ska täcka större delen av den ljusa ytan.
  const quadArea = triArea(quad[0], quad[1], quad[2]) + triArea(quad[0], quad[2], quad[3]);
  return quadArea > area[best] * 0.8 && quadArea < area[best] * 1.25 ? quad : null;
}

/**
 * Förfinar hörnen: varje sida anpassas som en rät linje till kantpixlarna nära
 * sidan (minsta kvadrat, två varv med bortsortering av avvikare), och hörnen
 * blir skärningspunkterna. Hörn som skurits av i höljet kommer då tillbaka.
 */
function refineQuad(q: P2[], edge: P2[], size: number): P2[] {
  const band = size * 0.02;
  const lines: { n: P2; c: number }[] = [];
  for (let s = 0; s < 4; s++) {
    const a = q[s], b = q[(s + 1) % 4];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let n: P2 = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
    let c = -(n[0] * a[0] + n[1] * a[1]);
    for (let pass = 0; pass < 2; pass++) {
      // Punkter nära linjen och inte nära hörnen (där två sidor möts).
      const sel = edge.filter((p) => {
        const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (len * len);
        return t > 0.08 && t < 0.92 && Math.abs(n[0] * p[0] + n[1] * p[1] + c) < (pass ? band / 4 : band);
      });
      if (sel.length < 10) break;
      // Total minsta kvadrat: linjens riktning = största egenvektorn till kovariansen.
      const mx = sel.reduce((t, p) => t + p[0], 0) / sel.length, my = sel.reduce((t, p) => t + p[1], 0) / sel.length;
      let sxx = 0, sxy = 0, syy = 0;
      for (const p of sel) {
        sxx += (p[0] - mx) ** 2;
        sxy += (p[0] - mx) * (p[1] - my);
        syy += (p[1] - my) ** 2;
      }
      const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
      n = [-Math.sin(ang), Math.cos(ang)];
      c = -(n[0] * mx + n[1] * my);
    }
    lines.push({ n, c });
  }
  const out: P2[] = [];
  for (let s = 0; s < 4; s++) {
    const l1 = lines[(s + 3) % 4], l2 = lines[s];
    const det = l1.n[0] * l2.n[1] - l1.n[1] * l2.n[0];
    if (Math.abs(det) < 1e-9) return q;
    out.push([(-l1.c * l2.n[1] + l2.c * l1.n[1]) / det, (-l2.c * l1.n[0] + l1.c * l2.n[0]) / det]);
  }
  return out;
}

/** Löser A·x = b (Gauss med pivotering). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) throw new Error('SINGULAR');
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/** Homografi (3×3, h33 = 1) som avbildar src[i] på dst[i]. */
export function homography(src: P2[], dst: P2[]): number[] {
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return [...solve(A, b), 1];
}

export const applyHomography = (H: number[], x: number, y: number): P2 => {
  const d = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d];
};

/**
 * Rätar upp fyrhörningen `quad` (i källbilden) till en rektangel outW × outH.
 * Bilinjär interpolation; RGBA in och ut.
 */
export function warpQuad(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, quad: P2[], outW: number, outH: number): Uint8ClampedArray {
  // Från utbild till källbild: homografi från rektangelns hörn till quad.
  const H = homography([[0, 0], [outW - 1, 0], [outW - 1, outH - 1], [0, outH - 1]], quad);
  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let y = 0; y < outH; y++)
    for (let x = 0; x < outW; x++) {
      const [sx, sy] = applyHomography(H, x, y);
      const o = (y * outW + x) * 4;
      if (sx < 0 || sy < 0 || sx > w - 1 || sy > h - 1) {
        out[o] = out[o + 1] = out[o + 2] = 255;
        out[o + 3] = 255;
        continue;
      }
      const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
      const fx = sx - x0, fy = sy - y0;
      for (let c = 0; c < 4; c++) {
        const a = rgba[(y0 * w + x0) * 4 + c], bb = rgba[(y0 * w + x1) * 4 + c], cc = rgba[(y1 * w + x0) * 4 + c], d = rgba[(y1 * w + x1) * 4 + c];
        out[o + c] = (a * (1 - fx) + bb * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy;
      }
    }
  return out;
}

/* ───────── Spårning ───────── */

export interface TraceOptions {
  /** objects: fyllda former (objekt, siluetter). outline: skissens konturer. centerline: skissens linjer som mittlinjer. */
  mode: 'objects' | 'outline' | 'centerline';
  /** Tröskel 0–255; null = automatisk (Otsu). */
  threshold: number | null;
  /** Objekten/strecken är mörkare än bakgrunden. */
  dark: boolean;
  /** Utjämning av konturen (px). */
  smooth: number;
  /** Förenkling: största avvikelse (px). */
  simplify: number;
  /** Minsta yta (px²) för ett objekt eller streck – mindre är brus. */
  minArea: number;
  /** Behåll hål i objekten. */
  holes: boolean;
  /** Hoppa över det som rör bildens kant (t.ex. bordet utanför papperet). */
  ignoreEdge: boolean;
}

export interface TracedObject {
  id: number;
  /** Slutna konturer (yttre + hål), [x, y, …] i pixlar. */
  loops: number[][];
  /** Öppna linjer (mittlinje), [x, y, …] i pixlar. */
  lines: number[][];
  area: number;
  bbox: [number, number, number, number];
}

export interface TraceResult {
  threshold: number;
  objects: TracedObject[];
}

/** Gråskala → mask (1 = objekt/streck). */
export function traceMask(gray: Uint8Array, w: number, h: number, o: Pick<TraceOptions, 'threshold' | 'dark' | 'mode'>): { mask: Uint8Array; threshold: number } {
  // Skisser: jämna ut belysningen först (skuggor, vinjettering). Objekt: inte –
  // utjämningen tar stora mörka ytor för skugga och gör hål i dem.
  const flat = o.mode === 'objects' ? gray : flattenBackground(gray, w, h, o.dark);
  const t = o.threshold ?? otsuThreshold(flat);
  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) mask[i] = (o.dark ? flat[i] <= t : flat[i] > t) ? 1 : 0;
  return { mask, threshold: t };
}

/** Konturer runt en komponent (med hål), utjämnade och förenklade. */
function componentLoops(labels: Int32Array, l: number, bbox: [number, number, number, number], w: number, smooth: number, simplify: number, holes: boolean): number[][] {
  const pad = Math.ceil(smooth) + 2;
  const x0 = bbox[0] - pad, y0 = bbox[1] - pad;
  const nx = bbox[2] - bbox[0] + 1 + 2 * pad, ny = bbox[3] - bbox[1] + 1 + 2 * pad;
  const f = new Float32Array(nx * ny);
  const h = labels.length / w;
  for (let y = 0; y < ny; y++)
    for (let x = 0; x < nx; x++) {
      const X = x + x0, Y = y + y0;
      f[y * nx + x] = X >= 0 && Y >= 0 && X < w && Y < h && labels[Y * w + X] === l ? 1 : 0;
    }
  const sm = boxBlur(f, nx, ny, Math.round(smooth / 2)); // två boxpass ≈ utjämning över ±smooth
  // Inuti = fältet < 0: 0,5 − täckning.
  const d = new Float32Array(nx * ny);
  for (let i = 0; i < d.length; i++) d[i] = 0.5 - sm[i];
  const field: DistanceField = { nx, ny, x0: x0 - 0.5, y0: y0 - 0.5, cell: 1, d };
  let loops = isolines(field, 0, 0.05).map((pts) => simplifyClosed(pts, simplify)).filter((pts) => pts.length >= 6);
  if (!holes) {
    // Bara yttre konturer: de med störst yta per sammanhängande del (isolines: yttre moturs).
    loops = loops.filter((pts) => signedArea(pts) > 0);
  }
  return loops;
}

function signedArea(pts: number[]): number {
  let a = 0;
  for (let i = 0, n = pts.length / 2; i < n; i++) {
    const j = (i + 1) % n;
    a += pts[2 * i] * pts[2 * j + 1] - pts[2 * j] * pts[2 * i + 1];
  }
  return a / 2;
}

/* ───────── Mittlinje (uttunning) ───────── */

/** Zhang–Suen: tunnar ut masken till en pixel breda linjer. */
function thin(mask: Uint8Array, w: number, h: number): Uint8Array {
  const m = Uint8Array.from(mask);
  const del: number[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!m[i]) continue;
          const p2 = m[i - w], p3 = m[i - w + 1], p4 = m[i + 1], p5 = m[i + w + 1], p6 = m[i + w], p7 = m[i + w - 1], p8 = m[i - 1], p9 = m[i - w - 1];
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let a = 0;
          for (let k = 0; k < 8; k++) if (!seq[k] && seq[k + 1]) a++;
          if (a !== 1) continue;
          if (pass === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
          del.push(i);
        }
      for (const i of del) m[i] = 0;
      if (del.length) changed = true;
    }
  }
  return m;
}

const NB: P2[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/**
 * Följer skelettet till polylinjer. Ändpunkter (en granne) och korsningar
 * (minst tre övergångar runt pixeln) är noder; mellan dem följs pixlarna.
 * Korta utstickare (kortare än `spur` px) som slutar fritt tas bort.
 */
function traceSkeleton(sk: Uint8Array, w: number, h: number, spur: number): number[][] {
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? sk[y * w + x] : 0);
  const kind = new Uint8Array(sk.length); // 1 = ändpunkt, 2 = korsning
  for (let i = 0; i < sk.length; i++) {
    if (!sk[i]) continue;
    const x = i % w, y = (i - x) / w;
    let n = 0, trans = 0;
    for (let k = 0; k < 8; k++) {
      const a = at(x + NB[k][0], y + NB[k][1]), b = at(x + NB[(k + 1) % 8][0], y + NB[(k + 1) % 8][1]);
      n += a;
      if (!a && b) trans++;
    }
    if (n <= 1) kind[i] = 1;
    else if (trans >= 3) kind[i] = 2;
  }
  const visited = new Uint8Array(sk.length);
  const lines: { pts: number[]; freeEnds: number }[] = [];
  const walk = (start: number, first: number) => {
    const pts = [start % w, Math.floor(start / w)];
    let cur = first;
    for (;;) {
      pts.push(cur % w, Math.floor(cur / w));
      if (kind[cur] || cur === start) break;
      visited[cur] = 1;
      const x = cur % w, y = (cur - x) / w;
      // Nästa: obesökt grannpixel; raka grannar före diagonala (trappsteg).
      let nxt = -1;
      for (const k of [0, 2, 4, 6, 1, 3, 5, 7]) {
        const xx = x + NB[k][0], yy = y + NB[k][1];
        if (!at(xx, yy)) continue;
        const j = yy * w + xx;
        if (j === start && pts.length > 4) { nxt = j; break; }
        if (!visited[j] && j !== start && (kind[j] || nxt < 0)) {
          nxt = j;
          if (kind[j]) break; // en nod före vanliga pixlar
        }
      }
      if (nxt < 0) break;
      cur = nxt;
    }
    return { pts, end: cur };
  };
  for (let s = 0; s < sk.length; s++) {
    if (!kind[s]) continue;
    const x = s % w, y = (s - x) / w;
    for (const [dx, dy] of NB) {
      const xx = x + dx, yy = y + dy;
      if (!at(xx, yy)) continue;
      const j = yy * w + xx;
      if (visited[j] || (kind[j] && j < s)) continue; // nod–nod en gång
      if (kind[j] && Math.abs(dx) + Math.abs(dy) > 0 && kind[s] === 2 && kind[j] === 2) continue; // inuti en korsning
      const { pts, end } = walk(s, j);
      lines.push({ pts, freeEnds: (kind[s] === 1 ? 1 : 0) + (kind[end] === 1 ? 1 : 0) });
    }
  }
  // Slingor utan noder (t.ex. en ritad ring).
  for (let s = 0; s < sk.length; s++) {
    if (!sk[s] || visited[s] || kind[s]) continue;
    visited[s] = 1;
    const x = s % w, y = (s - x) / w;
    for (const [dx, dy] of NB) {
      const j = (y + dy) * w + (x + dx);
      if (at(x + dx, y + dy) && !visited[j]) {
        const { pts } = walk(s, j);
        lines.push({ pts, freeEnds: 0 });
        break;
      }
    }
  }
  const len = (p: number[]) => {
    let l = 0;
    for (let k = 2; k < p.length; k += 2) l += Math.hypot(p[k] - p[k - 2], p[k + 1] - p[k - 1]);
    return l;
  };
  // Utstickare: en fri ände och kort. Bitar inuti en korsning (≤ 2 px mellan noder) tas också bort.
  return lines.filter((l) => !(l.freeEnds === 1 && len(l.pts) < spur) && !(l.freeEnds === 0 && l.pts.length <= 6 && len(l.pts) <= 2.9)).map((l) => l.pts);
}

/** Douglas–Peucker för öppna polylinjer. */
function simplifyOpen(pts: number[], tol: number): number[] {
  const n = pts.length / 2;
  if (n <= 2 || tol <= 0) return pts;
  // Sluten slinga (start = slut): dela vid punkten längst bort och förenkla halvorna.
  if (n > 3 && Math.hypot(pts[0] - pts[2 * n - 2], pts[1] - pts[2 * n - 1]) < 1.5) {
    let far = 1, fd = -1;
    for (let k = 1; k < n - 1; k++) {
      const d = Math.hypot(pts[2 * k] - pts[0], pts[2 * k + 1] - pts[1]);
      if (d > fd) (fd = d), (far = k);
    }
    const a = simplifyOpen(pts.slice(0, 2 * far + 2), tol), b = simplifyOpen(pts.slice(2 * far), tol);
    return [...a, ...b.slice(2)];
  }
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = pts[2 * a], ay = pts[2 * a + 1], dx = pts[2 * b] - ax, dy = pts[2 * b + 1] - ay;
    const L = Math.hypot(dx, dy) || 1;
    let far = -1, fd = tol;
    for (let k = a + 1; k < b; k++) {
      const d = Math.abs((pts[2 * k] - ax) * dy - (pts[2 * k + 1] - ay) * dx) / L;
      if (d > fd) (fd = d), (far = k);
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  const out: number[] = [];
  for (let k = 0; k < n; k++) if (keep[k]) out.push(pts[2 * k], pts[2 * k + 1]);
  return out;
}

/** Spårar bilden (gråskala) enligt inställningarna. */
export function traceImage(gray: Uint8Array, w: number, h: number, o: TraceOptions): TraceResult {
  const { mask: raw, threshold } = traceMask(gray, w, h, o);
  // Brus bort och små glipor slutna (skisser: bara stängning, så tunna streck finns kvar).
  let mask = o.mode === 'objects' ? morph(morph(raw, w, h, 1, 'open'), w, h, 1, 'close') : morph(raw, w, h, 1, 'close');
  const { labels, count, area, touches } = label(mask, w, h);
  const bboxes: [number, number, number, number][] = Array.from({ length: count + 1 }, () => [w, h, -1, -1]);
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i];
    if (!l) continue;
    const x = i % w, y = (i - x) / w, b = bboxes[l];
    if (x < b[0]) b[0] = x;
    if (y < b[1]) b[1] = y;
    if (x > b[2]) b[2] = x;
    if (y > b[3]) b[3] = y;
  }
  const keep = (l: number) => area[l] >= o.minArea && !(o.ignoreEdge && touches[l]);
  const objects: TracedObject[] = [];
  if (o.mode === 'centerline') {
    // Bara de komponenter som behålls, uttunnade tillsammans.
    mask = new Uint8Array(mask.length);
    for (let i = 0; i < labels.length; i++) if (labels[i] && keep(labels[i])) mask[i] = 1;
    const sk = thin(mask, w, h);
    // Streckbredd ≈ yta / skelettlängd – utstickare kortare än ~1,5 streckbredd tas bort.
    let skLen = 0, inkArea = 0;
    for (let i = 0; i < sk.length; i++) {
      skLen += sk[i];
      inkArea += mask[i];
    }
    const width = skLen ? inkArea / skLen : 2;
    const lines = traceSkeleton(sk, w, h, Math.max(3, 1.5 * width)).map((p) => simplifyOpen(p, Math.max(0.5, o.simplify)));
    // En "objekt"-post per komponent, så att användaren kan välja bort delar.
    const byLabel = new Map<number, number[][]>();
    for (const p of lines) {
      const l = labels[Math.round(p[1]) * w + Math.round(p[0])] || labels[Math.round(p[p.length - 1]) * w + Math.round(p[p.length - 2])];
      if (!l) continue;
      if (!byLabel.has(l)) byLabel.set(l, []);
      byLabel.get(l)!.push(p);
    }
    for (const [l, ls] of byLabel) objects.push({ id: l, loops: [], lines: ls, area: area[l], bbox: bboxes[l] });
  } else {
    for (let l = 1; l <= count; l++) {
      if (!keep(l)) continue;
      const loops = componentLoops(labels, l, bboxes[l], w, o.smooth, Math.max(0.3, o.simplify), o.holes);
      if (loops.length) objects.push({ id: l, loops, lines: [], area: area[l], bbox: bboxes[l] });
    }
  }
  objects.sort((a, b) => b.area - a.area);
  return { threshold, objects };
}

/**
 * Pixlar → mm: x åt höger, y uppåt (som ritningen), med bildens nedre vänstra
 * hörn i (0, 0). `mmPerPx` från kalibreringen.
 */
export function traceToMm(pts: number[], mmPerPx: number, heightPx: number): number[] {
  const out = new Array<number>(pts.length);
  for (let i = 0; i < pts.length; i += 2) {
    out[i] = pts[i] * mmPerPx;
    out[i + 1] = (heightPx - pts[i + 1]) * mmPerPx;
  }
  return out;
}
