/**
 * Mittlinjen (medial axis) för V-gravyr: fräsen följer mittlinjen och går
 * djupare där formen är bredare, så att konen formar väggarna ut till kanten.
 *
 * Mittlinjen beräknas av flo-mat (MIT, Floris Steenkamp), som räknar fram
 * den exakta medial axis transform för former av linjer och bezierkurvor –
 * även med hål. Här blir den polylinjer; djupet sätts av anroparen.
 */
import './polyfills';
import { findMats, getMatCurveToNext, isTerminating, traverseEdges } from 'flo-mat';
import type { PolylineInput } from './protocol';
import { simplifyClosed } from './sdf';

/** Udda antal korsningar = punkten ligger inuti den slutna banan. */
function inside(x: number, y: number, pts: number[]): boolean {
  let c = false;
  const n = pts.length / 2;
  for (let k = 0, m = n - 1; k < n; m = k++) {
    const ax = pts[2 * k], ay = pts[2 * k + 1], bx = pts[2 * m], by = pts[2 * m + 1];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) c = !c;
  }
  return c;
}

const area = (pts: number[]) => {
  let a = 0;
  for (let i = 0, n = pts.length / 2; i < n; i++) {
    const j = (i + 1) % n;
    a += pts[2 * i] * pts[2 * j + 1] - pts[2 * j] * pts[2 * i + 1];
  }
  return a / 2;
};

/** Punkt på en bezier (2–4 kontrollpunkter) vid t. */
function bezierAt(ps: number[][], t: number): [number, number] {
  let pts = ps.map((p) => [p[0], p[1]]);
  while (pts.length > 1) pts = pts.slice(1).map((p, i) => [pts[i][0] + (p[0] - pts[i][0]) * t, pts[i][1] + (p[1] - pts[i][1]) * t]);
  return [pts[0][0], pts[0][1]];
}

/**
 * Mittlinjen för formerna som öppna polylinjer [x, y, x, y, …]. Varje grupp
 * fylls med jämn-udda-regeln (hål blir hål) och grupperna slås ihop.
 * `step` är ungefärligt avstånd mellan punkterna (mm).
 */
export function medialAxisPaths(groups: PolylineInput[][], step = 0.25): number[][] {
  // Riktning: ytterkonturer moturs, hål medurs (flo-mat använder nonzero-regeln).
  const loops: number[][][][] = [];
  for (const g of groups) {
    const closed = g.filter((p) => p.closed && p.points.length >= 6).map((p) => simplifyClosed(p.points, 0.005));
    for (const pts of closed) {
      if (pts.length < 6 || Math.abs(area(pts)) < 1e-6) continue;
      let depth = 0;
      for (const other of closed) if (other !== pts && inside(pts[0], pts[1], other)) depth++;
      const ccw = area(pts) > 0;
      const want = depth % 2 === 0;
      const p = ccw === want ? pts : reversed(pts);
      const n = p.length / 2;
      loops.push(Array.from({ length: n }, (_, i) => [[p[2 * i], p[2 * i + 1]], [p[2 * ((i + 1) % n)], p[2 * ((i + 1) % n) + 1]]]));
    }
  }
  if (!loops.length) return [];
  // Hela mittlinjen (applySat: false) – grenarna ut i hörnen behövs för skarpa hörn.
  // Täta punkter och ingen förenkling: djupet beror direkt på hur exakt mittlinjen ligger.
  const mats = findMats(loops, { applySat: false, simplify: false, maxLength: 4 });
  const chains: number[][] = [];
  for (const mat of mats) {
    if (!mat.cpNode) continue;
    traverseEdges(mat.cpNode, (cp) => {
      if (isTerminating(cp)) return;
      const curves = getMatCurveToNext(cp);
      if (!curves?.length) return;
      const pts: number[] = [];
      for (const bz of curves) {
        let len = 0;
        for (let i = 1; i < bz.length; i++) len += Math.hypot(bz[i][0] - bz[i - 1][0], bz[i][1] - bz[i - 1][1]);
        const n = Math.max(1, Math.ceil(len / step));
        for (let k = pts.length ? 1 : 0; k <= n; k++) pts.push(...bezierAt(bz, k / n));
      }
      if (pts.length < 4) return;
      // Fortsätt föregående kedja om biten börjar där den slutade.
      const last = chains[chains.length - 1];
      if (last && Math.hypot(last[last.length - 2] - pts[0], last[last.length - 1] - pts[1]) < 1e-6) {
        for (let i = 2; i < pts.length; i++) last.push(pts[i]);
      } else chains.push(pts);
    });
  }
  return chains;
}

function reversed(pts: number[]): number[] {
  const out: number[] = [];
  for (let i = pts.length - 2; i >= 0; i -= 2) out.push(pts[i], pts[i + 1]);
  return out;
}

/**
 * Exakt avstånd från punkterna till formernas kanter (för mittlinjens djup).
 * Kanterna sorteras i ett rutnät så att bara de närmaste behöver provas.
 */
export function distanceToEdges(groups: PolylineInput[][], pts: number[]): number[] {
  const seg: number[] = [];
  for (const g of groups) for (const p of g) {
    if (!p.closed) continue;
    const n = p.points.length / 2;
    for (let k = 0; k < n; k++) {
      const m = (k + 1) % n;
      seg.push(p.points[2 * k], p.points[2 * k + 1], p.points[2 * m], p.points[2 * m + 1]);
    }
  }
  const ns = seg.length / 4;
  if (!ns) return pts.filter((_, i) => i % 2 === 0).map(() => 0);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < seg.length; i += 2) {
    minX = Math.min(minX, seg[i]); maxX = Math.max(maxX, seg[i]);
    minY = Math.min(minY, seg[i + 1]); maxY = Math.max(maxY, seg[i + 1]);
  }
  const size = Math.max(0.5, Math.sqrt(((maxX - minX) * (maxY - minY)) / ns) * 2);
  const gx = Math.max(1, Math.ceil((maxX - minX) / size) + 1), gy = Math.max(1, Math.ceil((maxY - minY) / size) + 1);
  const cells: number[][] = Array.from({ length: gx * gy }, () => []);
  const ci = (x: number) => Math.min(gx - 1, Math.max(0, Math.floor((x - minX) / size)));
  const cj = (y: number) => Math.min(gy - 1, Math.max(0, Math.floor((y - minY) / size)));
  for (let s = 0; s < ns; s++) {
    const [ax, ay, bx, by] = [seg[4 * s], seg[4 * s + 1], seg[4 * s + 2], seg[4 * s + 3]];
    for (let j = cj(Math.min(ay, by)); j <= cj(Math.max(ay, by)); j++) for (let i = ci(Math.min(ax, bx)); i <= ci(Math.max(ax, bx)); i++) cells[j * gx + i].push(s);
  }
  const segDist = (s: number, x: number, y: number) => {
    const ax = seg[4 * s], ay = seg[4 * s + 1], dx = seg[4 * s + 2] - ax, dy = seg[4 * s + 3] - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    return Math.hypot(x - ax - t * dx, y - ay - t * dy);
  };
  const out: number[] = [];
  for (let k = 0; k < pts.length; k += 2) {
    const x = pts[k], y = pts[k + 1];
    const i0 = ci(x), j0 = cj(y);
    let best = Infinity;
    // Växande ringar av rutor tills ringen ligger längre bort än bästa avståndet.
    for (let r = 0; r <= Math.max(gx, gy); r++) {
      if ((r - 1) * size > best) break;
      for (let j = j0 - r; j <= j0 + r; j++) {
        if (j < 0 || j >= gy) continue;
        for (let i = i0 - r; i <= i0 + r; i++) {
          if (i < 0 || i >= gx || (Math.abs(i - i0) !== r && Math.abs(j - j0) !== r)) continue;
          for (const s of cells[j * gx + i]) best = Math.min(best, segDist(s, x, y));
        }
      }
    }
    out.push(best);
  }
  return out;
}
