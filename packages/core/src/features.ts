/**
 * Kontroll av detaljer som är för små för verktyget (plasma, laser, fräs).
 *
 * Verktyget (snittet eller fräsen) har bredden w. Utskärningen (det som tas
 * bort) analyseras med avståndsfältet: verktygets mitt kan bara stå där det
 * är minst w/2 till detaljen, och det verktyget når är allt inom w/2 från de
 * punkterna (morfologisk öppning). Det som blir kvar når verktyget inte.
 *
 *  - fail: utskärningen är smalare än verktyget – skärs inte.
 *  - poor: plasma/laser – smalare än 2·w, eller hål för litet för plåten – blir dåligt.
 *  - thin: detaljen har partier tunnare än en gräns – kan böjas, brytas eller brännas bort.
 *
 * Restytor i innerhörn (alltid minst verktygets radie) filtreras bort.
 * Egen kod (avståndsfältet i sdf.ts, Felzenszwalb–Huttenlocher).
 */
import type { PolylineInput } from './protocol';
import { buildDistanceField, edt2d, nestGroups } from './sdf';

export type FeatureMachine = 'plasma' | 'laser' | 'router';
export type FeatureSeverity = 'fail' | 'poor' | 'thin';

export interface FeatureIssue {
  severity: FeatureSeverity;
  /** hole: litet hål eller instängd utskärning. gap: smalt spår eller urtag. part: tunn del av detaljen. */
  kind: 'hole' | 'gap' | 'part';
  /** Bredd (spår, del) eller diameter (hål), mm. */
  size: number;
  /** Var markeringen sitter och hur stort området är (mm). */
  x: number;
  y: number;
  r: number;
  /** Områdets halva bredd och höjd (mm), för en avlång markering. */
  hx: number;
  hy: number;
}

export interface FeatureCheckInput {
  groups: PolylineInput[][];
  /** Vilken sida som skärs bort: outside = detaljen är formen, inside = formen tas bort. */
  side: 'outside' | 'inside' | 'on';
  /** Verktygets bredd: snittbredd (plasma, laser) eller fräsens diameter. */
  width: number;
  /** Materialets tjocklek (mm). */
  thickness: number;
  machine: FeatureMachine;
}

/** Minsta hål som blir bra (diameter, mm). */
export function minHoleDiameter(machine: FeatureMachine, width: number, thickness: number): number {
  if (machine === 'plasma') return Math.max(2 * width, 1.5 * thickness);
  if (machine === 'laser') return 2 * width;
  return width;
}

/** Tunnaste del av detaljen som håller (mm). */
export function minPartWidth(machine: FeatureMachine, width: number, thickness: number): number {
  if (machine === 'plasma') return Math.max(1.5, thickness);
  if (machine === 'laser') return Math.max(2 * width, 0.5 * thickness, 0.8);
  return Math.max(1.5, 0.15 * thickness);
}

const MAX_ISSUES = 60;

export function analyzeFeatures(input: FeatureCheckInput): FeatureIssue[] {
  const { width: w, thickness, machine } = input;
  if (input.side === 'on' || !(w > 0)) return [];
  const closed = input.groups.map((g) => g.filter((p) => p.closed && p.points.length >= 6)).filter((g) => g.length);
  if (!closed.length) return [];
  const thinW = minPartWidth(machine, w, thickness);
  const field = buildDistanceField(nestGroups(closed), { margin: Math.max(2 * w, thinW) + 2, cell: Math.min(0.25, Math.max(0.05, Math.min(w, thinW) / 8)), maxCells: 2_000_000 });
  if (!field) return [];
  const { nx, ny, cell, d, x0, y0 } = field;
  const n = nx * ny;
  // s > 0 i det som tas bort, s < 0 i det som blir kvar.
  const s = new Float32Array(n);
  for (let k = 0; k < n; k++) s[k] = input.side === 'outside' ? d[k] : -d[k];
  const cx = (k: number) => x0 + ((k % nx) + 0.5) * cell;
  const cy = (k: number) => y0 + (Math.floor(k / nx) + 0.5) * cell;
  const issues: FeatureIssue[] = [];
  const used = new Uint8Array(n);

  /** Exakt avstånd till närmaste kant (rutnätet underskattar smala partier). */
  const edges = field.edges ?? new Float64Array();
  const edgeDist = (x: number, y: number) => {
    let best = Infinity;
    for (let e = 0; e < edges.length; e += 4) {
      const ax = edges[e], ay = edges[e + 1], bx = edges[e + 2], by = edges[e + 3];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
      const dd = (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
      if (dd < best) best = dd;
    }
    return Math.sqrt(best);
  };
  /** Bredd i ett område: dubbla avståndet till kanten kring den djupaste rutan (exakt, finare sökning). */
  const widthAt = (k: number) => {
    let m = 0;
    for (let a = -1; a <= 1; a += 0.5) for (let b = -1; b <= 1; b += 0.5) m = Math.max(m, edgeDist(cx(k) + a * cell, cy(k) + b * cell));
    return 2 * m;
  };

  /** Rutor i region (sign = 1: borttaget, −1: kvar) som ett verktyg med bredden tw inte når. */
  const unreached = (sign: 1 | -1, tw: number) => {
    const centers = new Uint8Array(n);
    for (let k = 0; k < n; k++) centers[k] = sign * s[k] >= tw / 2 ? 1 : 0;
    const dist = edt2d(centers, nx, ny, 1);
    const out = new Uint8Array(n);
    const reach = tw / 2 / cell + 0.75;
    for (let k = 0; k < n; k++) out[k] = sign * s[k] > 0 && dist[k] > reach ? 1 : 0;
    return out;
  };

  /**
   * Hur långt ett ej nått område sträcker sig in från det verktyget når (mm).
   * Spetsiga hörn ger alltid en kort rest som ingen rund stråle eller fräs når –
   * den räknas inte. Smala spår och tungor sträcker sig längre.
   */
  const depthFrom = (mask: Uint8Array, sign: 1 | -1) => {
    const reached = new Uint8Array(n);
    for (let k = 0; k < n; k++) reached[k] = sign * s[k] > 0 && !mask[k] ? 1 : 0;
    const dist = edt2d(reached, nx, ny, 1);
    return (cells: number[]) => {
      let m = 0;
      for (const k of cells) if (dist[k] > m) m = dist[k];
      return m * cell;
    };
  };

  /** Sammanhängande områden i mask (4-grannar), med största avstånd till kanten. */
  const components = (mask: Uint8Array, sign: 1 | -1, diagonal = false) => {
    const seen = new Uint8Array(n);
    const list: { cells: number[]; area: number; maxS: number; at: number; border: boolean }[] = [];
    const stack: number[] = [];
    for (let k0 = 0; k0 < n; k0++) {
      if (!mask[k0] || seen[k0]) continue;
      const cells: number[] = [];
      let maxS = 0, at = k0, border = false;
      seen[k0] = 1;
      stack.push(k0);
      while (stack.length) {
        const k = stack.pop()!;
        cells.push(k);
        const v = sign * s[k];
        if (v > maxS) (maxS = v), (at = k);
        const i = k % nx, j = (k - i) / nx;
        if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) border = true;
        if (i > 0 && mask[k - 1] && !seen[k - 1]) (seen[k - 1] = 1), stack.push(k - 1);
        if (i < nx - 1 && mask[k + 1] && !seen[k + 1]) (seen[k + 1] = 1), stack.push(k + 1);
        if (j > 0 && mask[k - nx] && !seen[k - nx]) (seen[k - nx] = 1), stack.push(k - nx);
        if (j < ny - 1 && mask[k + nx] && !seen[k + nx]) (seen[k + nx] = 1), stack.push(k + nx);
        if (diagonal)
          for (const q of [i > 0 && j > 0 ? k - nx - 1 : -1, i < nx - 1 && j > 0 ? k - nx + 1 : -1, i > 0 && j < ny - 1 ? k + nx - 1 : -1, i < nx - 1 && j < ny - 1 ? k + nx + 1 : -1])
            if (q >= 0 && mask[q] && !seen[q]) (seen[q] = 1), stack.push(q);
      }
      list.push({ cells, area: cells.length * cell * cell, maxS, at, border });
    }
    return list;
  };

  const extent = (cells: number[]) => {
    let a = Infinity, b = -Infinity, c = Infinity, e = -Infinity;
    for (const k of cells) {
      const x = cx(k), y = cy(k);
      if (x < a) a = x; if (x > b) b = x; if (y < c) c = y; if (y > e) e = y;
    }
    return { x: (a + b) / 2, y: (c + e) / 2, r: Math.max(cell, Math.hypot(b - a, e - c) / 2), hx: Math.max(cell, (b - a) / 2 + cell / 2), hy: Math.max(cell, (e - c) / 2 + cell / 2) };
  };

  // 1. Hål: instängda utskärningar (rör inte fältets kant).
  const removed = new Uint8Array(n);
  for (let k = 0; k < n; k++) removed[k] = s[k] > 0 ? 1 : 0;
  const minHole = minHoleDiameter(machine, w, thickness);
  // Diagonala grannar räknas: en spetsig spets får inte bli ett eget "hål".
  for (const c of components(removed, 1, true)) {
    if (c.border) continue;
    const dia = 2 * Math.sqrt(c.area / Math.PI);
    const inscribed = widthAt(c.at);
    const e = extent(c.cells);
    if (inscribed / dia > 0.7) {
      // Runt (eller nästan): ett hål.
      if (inscribed < w || inscribed < minHole) {
        issues.push({ severity: inscribed < w ? 'fail' : 'poor', kind: 'hole', size: +inscribed.toFixed(2), x: e.x, y: e.y, r: e.r, hx: e.hx, hy: e.hy });
        for (const k of c.cells) used[k] = 1;
      }
    } else if (inscribed < w || (machine !== 'router' && inscribed < 2 * w)) {
      // Avlång instängd utskärning (spår): bredden avgör.
      issues.push({ severity: inscribed < w ? 'fail' : 'poor', kind: 'gap', size: +inscribed.toFixed(2), x: e.x, y: e.y, r: e.r, hx: e.hx, hy: e.hy });
      for (const k of c.cells) used[k] = 1;
    }
  }

  // 2. Smala spår och urtag: delar av utskärningen som verktyget inte når.
  const gaps = (tw: number, severity: FeatureSeverity) => {
    const mask = unreached(1, tw);
    for (let k = 0; k < n; k++) if (used[k]) mask[k] = 0;
    const minArea = 0.6 * (tw / 2) ** 2;
    const depth = depthFrom(mask, 1);
    for (const c of components(mask, 1)) {
      if (c.area < minArea || depth(c.cells) < 1.5 * tw) continue; // rest i ett innerhörn
      const e = extent(c.cells);
      issues.push({ severity, kind: 'gap', size: +widthAt(c.at).toFixed(2), x: e.x, y: e.y, r: e.r, hx: e.hx, hy: e.hy });
      for (const k of c.cells) used[k] = 1;
    }
  };
  if (cell <= w / 2) {
    gaps(w, 'fail');
    if (machine !== 'router') gaps(2 * w, 'poor');
  }

  // 3. Tunna delar av det som blir kvar.
  const thin = unreached(-1, thinW);
  const minArea = 0.6 * (thinW / 2) ** 2;
  const thinDepth = depthFrom(thin, -1);
  for (const c of components(thin, -1)) {
    if (c.area < minArea || thinDepth(c.cells) < 1.5 * thinW) continue; // spetsigt ytterhörn
    const e = extent(c.cells);
    issues.push({ severity: 'thin', kind: 'part', size: +widthAt(c.at).toFixed(2), x: e.x, y: e.y, r: e.r, hx: e.hx, hy: e.hy });
  }

  const rank = { fail: 0, poor: 1, thin: 2 } as const;
  return issues.sort((a, b) => rank[a.severity] - rank[b.severity] || a.size - b.size).slice(0, MAX_ISSUES);
}
