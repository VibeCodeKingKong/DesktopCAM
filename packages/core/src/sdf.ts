/**
 * Robust offset via avståndsfält (signed distance field).
 *
 * Formerna rastreras på ett fint rutnät, avståndet till kanten beräknas för
 * varje ruta (exakt euklidiskt avståndstransform) och konturerna för valfritt
 * avstånd plockas ut med marching squares. Det klarar konkava former, hål,
 * öar och överlappande former utan specialfall – och samma fält ger alla
 * offset-nivåer för en ficka på en gång. Noggrannheten är ungefär en halv
 * ruta (0,02–0,1 mm beroende på storlek).
 */
import type { PolylineInput } from './protocol';

export interface DistanceField {
  nx: number;
  ny: number;
  x0: number;
  y0: number;
  cell: number;
  /** Negativt inuti formerna, positivt utanför (mm). */
  d: Float32Array;
}

const INF = 1e20;

/** Exakt 1D kvadratiskt avståndstransform (Felzenszwalb & Huttenlocher). */
function edt1d(f: Float64Array, n: number, out: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    out[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Avstånd (i rutor) från varje ruta till närmaste ruta där mask = target. */
function edt2d(mask: Uint8Array, nx: number, ny: number, target: number): Float32Array {
  const n = Math.max(nx, ny);
  const f = new Float64Array(n);
  const out = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const tmp = new Float64Array(nx * ny);
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) f[y] = mask[y * nx + x] === target ? 0 : INF;
    edt1d(f, ny, out, v, z);
    for (let y = 0; y < ny; y++) tmp[y * nx + x] = out[y];
  }
  const res = new Float32Array(nx * ny);
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) f[x] = tmp[y * nx + x];
    edt1d(f, nx, out, v, z);
    for (let x = 0; x < nx; x++) res[y * nx + x] = Math.sqrt(out[x]);
  }
  return res;
}

export interface FieldOptions {
  /** Hur långt utanför formerna fältet ska räcka (mm). */
  margin: number;
  /** Rutstorlek (mm). Standard: anpassas efter storleken, 0,02–0,15 mm. */
  cell?: number;
  /** Max antal rutor (minne/tid). */
  maxCells?: number;
}

/**
 * Bygger avståndsfältet. Varje grupp är en form: dess slutna banor fylls med
 * jämn-udda-regeln (hål blir hål), och formerna slås sedan ihop (union).
 */
export function buildDistanceField(groups: PolylineInput[][], opts: FieldOptions): DistanceField | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const g of groups) for (const p of g) {
    if (!p.closed) continue;
    for (let i = 0; i + 1 < p.points.length; i += 2) {
      const x = p.points[i], y = p.points[i + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) return null;
  const maxCells = opts.maxCells ?? 4_000_000;
  const w = maxX - minX + 2 * opts.margin;
  const h = maxY - minY + 2 * opts.margin;
  let cell = opts.cell ?? Math.min(0.15, Math.max(0.02, Math.max(w, h) / 2000));
  if ((w / cell) * (h / cell) > maxCells) cell = Math.sqrt((w * h) / maxCells);
  const pad = 3;
  const nx = Math.ceil(w / cell) + 2 * pad;
  const ny = Math.ceil(h / cell) + 2 * pad;
  const x0 = minX - opts.margin - pad * cell;
  const y0 = minY - opts.margin - pad * cell;

  // Rastrera: rutans mittpunkt är inuti om den ligger inuti någon form.
  const mask = new Uint8Array(nx * ny);
  const xs: number[] = [];
  const row = new Uint8Array(nx);
  for (let j = 0; j < ny; j++) {
    const y = y0 + (j + 0.5) * cell;
    row.fill(0);
    for (const g of groups) {
      xs.length = 0;
      for (const p of g) {
        if (!p.closed) continue;
        const pts = p.points;
        const n = pts.length / 2;
        for (let k = 0; k < n; k++) {
          const ax = pts[2 * k], ay = pts[2 * k + 1];
          const b = (k + 1) % n;
          const bx = pts[2 * b], by = pts[2 * b + 1];
          if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k] - x0) / cell - 0.5));
        const i1 = Math.min(nx - 1, Math.floor((xs[k + 1] - x0) / cell - 0.5));
        for (let i = i0; i <= i1; i++) row[i] = 1;
      }
    }
    mask.set(row, j * nx);
  }

  const toInside = edt2d(mask, nx, ny, 1);
  const toOutside = edt2d(mask, nx, ny, 0);
  const d = new Float32Array(nx * ny);
  for (let k = 0; k < d.length; k++) {
    // Kanten ligger mitt emellan två rutor → halv ruta korrigering.
    d[k] = mask[k] ? -(toOutside[k] - 0.5) * cell : (toInside[k] - 0.5) * cell;
  }
  return { nx, ny, x0, y0, cell, d };
}

/**
 * Plockar ut konturerna där fältet = level. Inuti ligger alltid till vänster,
 * så yttre konturer går moturs och hål medurs.
 */
export function isolines(f: DistanceField, level: number, simplifyTol = 0.01): number[][] {
  const { nx, ny, d, x0, y0, cell } = f;
  const inside = (i: number, j: number) => d[j * nx + i] < level;
  const px = (i: number) => x0 + (i + 0.5) * cell;
  const py = (j: number) => y0 + (j + 0.5) * cell;
  // Kant-id: horisontell kant (i,j)-(i+1,j) = 2·(j·nx+i), vertikal (i,j)-(i,j+1) = 2·(j·nx+i)+1
  const H = (i: number, j: number) => 2 * (j * nx + i);
  const V = (i: number, j: number) => 2 * (j * nx + i) + 1;
  const next = new Map<number, number>();

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const bl = inside(i, j), br = inside(i + 1, j), tr = inside(i + 1, j + 1), tl = inside(i, j + 1);
      if (bl === br && br === tr && tr === tl) continue;
      // Kanter moturs: B (bl→br), R (br→tr), T (tr→tl), L (tl→bl)
      const edges = [
        { id: H(i, j), s: bl, t: br },
        { id: V(i + 1, j), s: br, t: tr },
        { id: H(i, j + 1), s: tr, t: tl },
        { id: V(i, j), s: tl, t: bl },
      ].filter((e) => e.s !== e.t);
      if (edges.length === 2) {
        const out = edges.find((e) => e.s)!;
        const inn = edges.find((e) => !e.s)!;
        next.set(out.id, inn.id);
      } else if (edges.length === 4) {
        const c = (d[j * nx + i] + d[j * nx + i + 1] + d[(j + 1) * nx + i + 1] + d[(j + 1) * nx + i]) / 4 < level;
        for (let k = 0; k < 4; k++) {
          if (!edges[k].s) continue;
          const partner = c ? edges[(k + 1) % 4] : edges[(k + 3) % 4];
          next.set(edges[k].id, partner.id);
        }
      }
    }
  }

  const point = (id: number): [number, number] => {
    const horiz = id % 2 === 0;
    const base = id >> 1;
    const i = base % nx;
    const j = (base - i) / nx;
    const a = d[j * nx + i];
    const b = horiz ? d[j * nx + i + 1] : d[(j + 1) * nx + i];
    const t = Math.abs(b - a) < 1e-12 ? 0.5 : (level - a) / (b - a);
    return horiz ? [px(i) + t * cell, py(j)] : [px(i), py(j) + t * cell];
  };

  const loops: number[][] = [];
  const visited = new Set<number>();
  for (const start of next.keys()) {
    if (visited.has(start)) continue;
    const pts: number[] = [];
    let cur: number | undefined = start;
    let guard = 0;
    while (cur !== undefined && !visited.has(cur) && guard++ < 10_000_000) {
      visited.add(cur);
      const [x, y] = point(cur);
      pts.push(x, y);
      cur = next.get(cur);
    }
    if (pts.length >= 6) loops.push(simplifyClosed(pts, simplifyTol));
  }
  return loops.filter((l) => l.length >= 6);
}

/** Douglas–Peucker för slutna polylinjer (platta koordinater). */
export function simplifyClosed(pts: number[], tol: number): number[] {
  const n = pts.length / 2;
  if (n < 4 || tol <= 0) return pts;
  // Starta i punkten längst från den första så att slutpunkten inte blir en hörnartefakt.
  let far = 0, best = -1;
  for (let k = 1; k < n; k++) {
    const dd = (pts[2 * k] - pts[0]) ** 2 + (pts[2 * k + 1] - pts[1]) ** 2;
    if (dd > best) { best = dd; far = k; }
  }
  const keep = new Uint8Array(n + 1);
  const xs = (k: number) => pts[2 * (k % n)];
  const ys = (k: number) => pts[2 * (k % n) + 1];
  const stack: [number, number][] = [[0, far], [far, n]];
  keep[0] = keep[far] = keep[n] = 1;
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = xs(a), ay = ys(a), bx = xs(b), by = ys(b);
    const len = Math.hypot(bx - ax, by - ay) || 1e-12;
    let maxD = -1, idx = -1;
    for (let k = a + 1; k < b; k++) {
      const dist = Math.abs((bx - ax) * (ay - ys(k)) - (ax - xs(k)) * (by - ay)) / len;
      if (dist > maxD) { maxD = dist; idx = k; }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out: number[] = [];
  for (let k = 0; k < n; k++) if (keep[k]) out.push(pts[2 * k], pts[2 * k + 1]);
  return out;
}

/** Offset av en uppsättning former: positivt = utåt, negativt = inåt. */
export function offsetShapes(groups: PolylineInput[][], distance: number): PolylineInput[] {
  if (Math.abs(distance) < 1e-9) return groups.flat();
  const field = buildDistanceField(groups, { margin: Math.max(0, distance) + 1 });
  if (!field) return [];
  return isolines(field, distance).map((points) => ({ points, closed: true }));
}

/**
 * Gör linjer (öppna eller slutna) till slutna konturer med given bredd,
 * med runda ändar och hörn – som att rita linjerna med en rund penna.
 * Används för att göra enkellinjig text fyllbar (ficka, V-gravyr, inlägg).
 */
export function strokeOutline(polylines: PolylineInput[], width: number): number[][] {
  const r = width / 2;
  if (r <= 0) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polylines) for (let i = 0; i + 1 < p.points.length; i += 2) {
    minX = Math.min(minX, p.points[i]); maxX = Math.max(maxX, p.points[i]);
    minY = Math.min(minY, p.points[i + 1]); maxY = Math.max(maxY, p.points[i + 1]);
  }
  if (!Number.isFinite(minX)) return [];
  const margin = r + 0.5;
  const w = maxX - minX + 2 * margin, h = maxY - minY + 2 * margin;
  let cell = Math.min(0.2, Math.max(0.01, Math.min(r / 6, Math.max(w, h) / 2500)));
  if ((w / cell) * (h / cell) > 4_000_000) cell = Math.sqrt((w * h) / 4_000_000);
  const nx = Math.ceil(w / cell) + 2, ny = Math.ceil(h / cell) + 2;
  const x0 = minX - margin - cell, y0 = minY - margin - cell;
  const mask = new Uint8Array(nx * ny);
  const mark = (x: number, y: number) => {
    const i = Math.floor((x - x0) / cell), j = Math.floor((y - y0) / cell);
    if (i >= 0 && j >= 0 && i < nx && j < ny) mask[j * nx + i] = 1;
  };
  for (const p of polylines) {
    const n = p.points.length / 2;
    const segs = p.closed ? n : n - 1;
    if (n === 1) mark(p.points[0], p.points[1]);
    for (let k = 0; k < segs; k++) {
      const ax = p.points[2 * k], ay = p.points[2 * k + 1];
      const b = (k + 1) % n;
      const bx = p.points[2 * b], by = p.points[2 * b + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (cell * 0.4)));
      for (let s = 0; s <= steps; s++) mark(ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps);
    }
  }
  const dist = edt2d(mask, nx, ny, 1);
  const d = new Float32Array(nx * ny);
  // Avståndet mäts mellan rutmittpunkter; en halv ruta är medelfelet för linjens läge.
  for (let k = 0; k < d.length; k++) d[k] = dist[k] * cell;
  return isolines({ nx, ny, x0, y0, cell, d }, r, Math.min(0.01, cell / 2));
}
