/**
 * Profilfräsning med strategier, som i Vectric och Fusion:
 *
 *  - Grovpass som lämnar en tunn hud mot kanten, följt av ett lätt finpass
 *    som ger raka väggar och exakta mått (fräsen böjer sig mindre).
 *  - Fräsriktning: medfräsning (climb) eller motfräsning (conventional),
 *    separat för grov- och finpass. Förutsätter medurs spindel (M3).
 *  - Ramp: fräsen glider ner längs konturen i stället för att borra rakt ner.
 *  - Flikar som håller kvar detaljen, och lökskal (tunt lager i botten).
 *
 * Konturerna kommer från avståndsfältet. Där ligger formens insida alltid
 * till vänster om färdriktningen; det används för att välja riktning.
 */
import { formatNumber } from './gcode';
import type { PolylineInput } from './protocol';
import { depthPasses } from './referenceEngine';
import { offsetShapes } from './sdf';
import type { CutDirection, CutSide, PostprocessorConfig, ProfileStrategy, StrategyPreset, TabSettings, Vec2 } from './types';

export const STRATEGY_PRESETS: Record<Exclude<StrategyPreset, 'custom'>, Omit<ProfileStrategy, 'preset'>> = {
  fast: { direction: 'conventional', finishPass: false, allowance: 0, finishDirection: 'climb', finishFeedFactor: 1, entry: 'ramp', rampAngle: 10, onionSkin: 0 },
  balanced: { direction: 'conventional', finishPass: true, allowance: 0.3, finishDirection: 'climb', finishFeedFactor: 1, entry: 'ramp', rampAngle: 8, onionSkin: 0 },
  fine: { direction: 'conventional', finishPass: true, allowance: 0.5, finishDirection: 'climb', finishFeedFactor: 0.7, entry: 'ramp', rampAngle: 5, onionSkin: 0 },
};

export const defaultStrategy = (preset: Exclude<StrategyPreset, 'custom'> = 'balanced'): ProfileStrategy => ({ preset, ...STRATEGY_PRESETS[preset] });

/** Vilken förinställning motsvarar inställningarna (för att visa rätt knapp)? */
export function matchPreset(s: ProfileStrategy): StrategyPreset {
  for (const [name, p] of Object.entries(STRATEGY_PRESETS) as [Exclude<StrategyPreset, 'custom'>, Omit<ProfileStrategy, 'preset'>][]) {
    if ((Object.keys(p) as (keyof typeof p)[]).every((k) => k === 'onionSkin' || p[k] === s[k])) return name;
  }
  return 'custom';
}

export const defaultTabs = (throughCut: boolean, thickness: number): TabSettings => ({
  enabled: throughCut,
  count: 4,
  width: 6,
  height: Math.max(1, Math.min(3, +(thickness / 4).toFixed(1))),
  offset: 0.125,
});

export interface RouterProfileJob {
  /** En grupp per form. */
  groups: PolylineInput[][];
  side: CutSide;
  toolDiameter: number;
  cutDepth: number;
  stepDown: number;
  feedRate: number;
  plungeRate: number;
  spindleRpm: number;
  strategy: ProfileStrategy;
  tabs: TabSettings;
  post: PostprocessorConfig;
}

/* ───────── Flikarnas lägen ───────── */

/** Närmaste punkt på slutna polylinjer: punkt, avstånd och riktning (enhetsvektor). */
export function nearestOnContours(polys: PolylineInput[], x: number, y: number): { x: number; y: number; dist: number; tx: number; ty: number } | null {
  let best: { x: number; y: number; dist: number; tx: number; ty: number } | null = null;
  for (const pl of polys) {
    if (!pl.closed) continue;
    const pts = pl.points;
    const n = pts.length / 2;
    for (let k = 0; k < n; k++) {
      const ax = pts[2 * k], ay = pts[2 * k + 1];
      const b = (k + 1) % n;
      const bx = pts[2 * b], by = pts[2 * b + 1];
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-12) continue;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
      const px = ax + dx * t, py = ay + dy * t;
      const d = Math.hypot(x - px, y - py);
      if (!best || d < best.dist) {
        const l = Math.sqrt(len2);
        best = { x: px, y: py, dist: d, tx: dx / l, ty: dy / l };
      }
    }
  }
  return best;
}

/**
 * Jämnt fördelade flikar: på varje forms yttre kontur, med start i konturens
 * första punkt förskjuten med `offset`. Korta konturer får färre flikar.
 */
export function autoTabPositions(groups: PolylineInput[][], tabs: TabSettings, toolDiameter: number): Vec2[] {
  const out: Vec2[] = [];
  const span = tabs.width + toolDiameter;
  for (const g of groups) {
    const closed = g.filter((p) => p.closed);
    if (!closed.length) continue;
    const outer = closed.reduce((a, b) => (Math.abs(signedArea(b.points)) > Math.abs(signedArea(a.points)) ? b : a));
    const track = new Track(outer.points, true);
    const n = Math.min(Math.max(0, Math.round(tabs.count)), Math.floor(track.length / (span * 3)));
    for (let k = 0; k < n; k++) {
      const [x, y] = track.at(((tabs.offset + k / n) % 1) * track.length);
      out.push({ x, y });
    }
  }
  return out;
}

/**
 * Fördelar befintliga flikar jämnt: varje kontur behåller lika många flikar
 * som den har nu, och den första fliken (räknat från konturens start) står kvar.
 */
export function distributeTabs(groups: PolylineInput[][], positions: Vec2[]): Vec2[] {
  const outers = groups
    .map((g) => g.filter((p) => p.closed))
    .filter((g) => g.length)
    .map((g) => new Track(g.reduce((a, b) => (Math.abs(signedArea(b.points)) > Math.abs(signedArea(a.points)) ? b : a)).points, true));
  if (!outers.length) return positions;
  // Fördela flikarna på närmaste kontur.
  const onTrack: number[][] = outers.map(() => []);
  const loose: Vec2[] = [];
  for (const q of positions) {
    let best = -1, bestD = Infinity, bestS = 0;
    outers.forEach((tr, i) => {
      const n = tr.nearest(q.x, q.y);
      if (n.dist < bestD) { bestD = n.dist; best = i; bestS = n.s; }
    });
    if (best >= 0) onTrack[best].push(bestS);
    else loose.push(q);
  }
  const out: Vec2[] = [...loose];
  outers.forEach((tr, i) => {
    const ss = onTrack[i].sort((a, b) => a - b);
    const n = ss.length;
    if (!n) return;
    for (let k = 0; k < n; k++) {
      const [x, y] = tr.at(ss[0] + (k * tr.length) / n);
      out.push({ x, y });
    }
  });
  return out;
}

/** Flikarnas mittpunkter för en bana: manuella eller automatiska. */
export function tabPositions(groups: PolylineInput[][], tabs: TabSettings, toolDiameter: number): Vec2[] {
  if (!tabs.enabled) return [];
  return tabs.mode === 'manual' ? (tabs.positions ?? []) : autoTabPositions(groups, tabs, toolDiameter);
}

/* ───────── Bana med båglängd ───────── */

class Track {
  readonly xs: number[] = [];
  readonly ys: number[] = [];
  /** Kumulativ längd till varje punkt. */
  readonly cum: number[] = [0];
  readonly length: number;
  constructor(points: number[], readonly closed: boolean) {
    for (let i = 0; i + 1 < points.length; i += 2) {
      this.xs.push(points[i]);
      this.ys.push(points[i + 1]);
    }
    if (closed && this.xs.length) {
      this.xs.push(this.xs[0]);
      this.ys.push(this.ys[0]);
    }
    for (let i = 1; i < this.xs.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.xs[i] - this.xs[i - 1], this.ys[i] - this.ys[i - 1]));
    this.length = this.cum[this.cum.length - 1] ?? 0;
  }
  /** Punkt på avståndet s (slutna banor räknas runt). */
  at(s: number): [number, number] {
    if (this.closed) s = ((s % this.length) + this.length) % this.length;
    else s = Math.max(0, Math.min(this.length, s));
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const seg = this.cum[hi] - this.cum[lo] || 1e-12;
    const t = (s - this.cum[lo]) / seg;
    return [this.xs[lo] + (this.xs[hi] - this.xs[lo]) * t, this.ys[lo] + (this.ys[hi] - this.ys[lo]) * t];
  }
  /** Närmaste läge (båglängd) och avstånd från punkten till banan. */
  nearest(x: number, y: number): { s: number; dist: number } {
    let best = { s: 0, dist: Infinity };
    for (let i = 1; i < this.xs.length; i++) {
      const ax = this.xs[i - 1], ay = this.ys[i - 1];
      const dx = this.xs[i] - ax, dy = this.ys[i] - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 1e-12 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
      const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
      if (d < best.dist) best = { s: this.cum[i - 1] + t * (this.cum[i] - this.cum[i - 1]), dist: d };
    }
    return best;
  }
  /** Hörnpunkternas avstånd mellan s0 och s1 (för att behålla formen). */
  vertexStations(s0: number, s1: number): number[] {
    const out: number[] = [];
    const L = this.length;
    const first = this.closed ? Math.floor(s0 / L) - 1 : 0;
    const last = this.closed ? Math.floor(s1 / L) + 1 : 0;
    for (let lap = first; lap <= last; lap++) {
      for (const c of this.cum) {
        const s = (this.closed ? lap * L : 0) + c;
        if (s > s0 + 1e-9 && s < s1 - 1e-9) out.push(s);
      }
      if (!this.closed) break;
    }
    return out.sort((a, b) => a - b);
  }
}

function signedArea(points: number[]) {
  let a = 0;
  for (let i = 0; i < points.length; i += 2) {
    const j = (i + 2) % points.length;
    a += points[i] * points[j + 1] - points[j] * points[i + 1];
  }
  return a / 2;
}

function reverseLoop(points: number[]) {
  const out: number[] = [];
  for (let i = points.length - 2; i >= 0; i -= 2) out.push(points[i], points[i + 1]);
  return out;
}

/**
 * Konturerna från avståndsfältet har formens insida till vänster. Utsida:
 * detaljen till vänster = medfräsning. Insida: detaljen till höger = motfräsning.
 */
function orient(loop: number[], side: CutSide, dir: CutDirection) {
  if (side === 'on') return loop;
  const climbAsIs = side === 'outside';
  return (dir === 'climb') === climbAsIs ? loop : reverseLoop(loop);
}

/* ───────── G-kod ───────── */

export function routerProfileGcode(job: RouterProfileJob): string {
  const p = job.post;
  const f = (n: number) => formatNumber(n, p.decimals);
  const st = job.strategy;
  const r = job.toolDiameter / 2;
  const sideSign = job.side === 'outside' ? 1 : job.side === 'inside' ? -1 : 0;
  const finish = st.finishPass && sideSign !== 0 && st.allowance > 0;
  const allowance = finish ? st.allowance : 0;
  const finalDepth = Math.max(0, job.cutDepth - Math.max(0, st.onionSkin));

  const closedGroups = job.groups.map((g) => g.filter((x) => x.closed)).filter((g) => g.length);
  const open = job.groups.flat().filter((x) => !x.closed);
  const contours = (dist: number) => (sideSign === 0 ? closedGroups.flat() : offsetShapes(closedGroups, dist));
  const byArea = (a: PolylineInput, b: PolylineInput) => Math.abs(signedArea(a.points)) - Math.abs(signedArea(b.points));

  const rough = contours(sideSign * (r + allowance)).sort(byArea);
  const fin = finish ? contours(sideSign * r).sort(byArea) : [];
  if (closedGroups.length && sideSign !== 0 && !rough.length) throw new Error('TOOL_TOO_LARGE');

  // Flikar: djupet där flikarna börjar, och flikbredd längs banan (inkl. fräsens diameter).
  const tabs = job.tabs;
  const tabTop = -(finalDepth - Math.min(tabs.height, finalDepth));
  const tabSpan = tabs.width + 2 * r;
  // Flikarna är punkter på detaljens kontur. Varje pass (grov och fin, oavsett
  // riktning) projicerar dem på sin egen bana, så att alla pass lyfter på samma ställe.
  const tabPoints = sideSign === 0 ? [] : tabPositions(closedGroups, tabs, job.toolDiameter);
  const reach = r + allowance + Math.max(1, r);
  const tabIntervals = (track: Track): [number, number][] => {
    if (!tabPoints.length || !track.closed) return [];
    const out: [number, number][] = [];
    for (const pt of tabPoints) {
      const { s, dist } = track.nearest(pt.x, pt.y);
      if (dist <= reach) out.push([s - tabSpan / 2, s + tabSpan / 2]);
    }
    return out;
  };
  const inTab = (track: Track, iv: [number, number][], s: number) => {
    const L = track.length;
    const u = ((s % L) + L) % L;
    return iv.some(([a, b]) => (u >= a && u <= b) || (u + L >= a && u + L <= b) || (u - L >= a && u - L <= b));
  };

  const out: string[] = [
    `; desktopCAM profile (${job.side}, ${finish ? `rough + finish, allowance ${allowance} mm` : 'single'}, ${st.entry})`,
    ...p.header,
    'G21',
    'G90',
    `M3 S${Math.round(job.spindleRpm)}`,
    `G0 Z${f(p.safeZ)}`,
  ];
  let lastF = -1;
  const feed = (v: number) => {
    if (v === lastF) return '';
    lastF = v;
    return ` F${f(v)}`;
  };
  let cur = { x: NaN, y: NaN, z: p.safeZ };
  let lastXYZ = '';
  const moveTo = (x: number, y: number, z: number, rate: number) => {
    const xyz = `X${f(x)} Y${f(y)} Z${f(z)}`;
    cur = { x, y, z };
    if (xyz === lastXYZ) return;
    lastXYZ = xyz;
    out.push(`G1 ${xyz}${feed(rate)}`);
  };

  /** Kör banan från s0 till s1 med Z linjärt från z0 till z1, lyft över flikar. */
  const run = (track: Track, iv: [number, number][], s0: number, s1: number, z0: number, z1: number, rate: number) => {
    const stations = [s0, ...track.vertexStations(s0, s1), s1];
    for (const [a, b] of iv) {
      const L = track.length;
      const lapFrom = track.closed ? Math.floor(s0 / L) - 1 : 0;
      const lapTo = track.closed ? Math.floor(s1 / L) + 1 : 0;
      for (let lap = lapFrom; lap <= lapTo; lap++) {
        for (const e of [a, b]) {
          const s = e + lap * L;
          if (s > s0 && s < s1) stations.push(s - 1e-4, s + 1e-4);
        }
      }
    }
    stations.sort((x, y) => x - y);
    const span = s1 - s0 || 1;
    for (const s of stations) {
      const [x, y] = track.at(s);
      let z = z0 + ((z1 - z0) * (s - s0)) / span;
      if (iv.length && inTab(track, iv, s)) z = Math.max(z, tabTop);
      moveTo(x, y, z, rate);
    }
  };

  /** Sluten kontur: alla djup i följd, med ramp eller rak nedgång och flikar. */
  const cutLoop = (points: number[], levels: number[], rate: number) => {
    const track = new Track(points, true);
    if (track.length < 1e-6) return;
    const iv = tabIntervals(track);
    const tanA = Math.tan((Math.max(1, Math.min(45, st.rampAngle)) * Math.PI) / 180);
    let s = 0;
    const [x0, y0] = track.at(0);
    out.push(`G0 Z${f(p.safeZ)}`, `G0 X${f(x0)} Y${f(y0)}`, 'G0 Z0.5');
    cur = { x: x0, y: y0, z: 0.5 };
    lastXYZ = '';
    let zPrev = 0;
    for (const depth of levels) {
      const z = -depth;
      if (st.entry === 'ramp') {
        // Glid ner längs banan (brantare om konturen är kort), kör sedan ett helt varv på djupet.
        const len = Math.min((zPrev - z) / tanA, track.length);
        if (cur.z > zPrev + 1e-6) moveTo(cur.x, cur.y, zPrev, job.plungeRate);
        run(track, iv, s, s + len, zPrev, z, job.plungeRate);
        s += len;
      } else {
        const [sx, sy] = track.at(s);
        moveTo(sx, sy, inTab(track, iv, s) ? Math.max(z, tabTop) : z, job.plungeRate);
      }
      run(track, iv, s, s + track.length, z, z, rate);
      zPrev = z;
    }
    out.push(`G0 Z${f(p.safeZ)}`);
    cur = { ...cur, z: p.safeZ };
  };

  /** Öppen bana (t.ex. gravyr på linjen): fram och tillbaka mellan djupen. */
  const cutOpen = (points: number[], levels: number[], rate: number) => {
    const fwd = new Track(points, false);
    if (fwd.length < 1e-6) return;
    const back = new Track(reverseLoop(points), false);
    const [x0, y0] = fwd.at(0);
    out.push(`G0 Z${f(p.safeZ)}`, `G0 X${f(x0)} Y${f(y0)}`, 'G0 Z0.5');
    cur = { x: x0, y: y0, z: 0.5 };
    lastXYZ = '';
    levels.forEach((depth, i) => {
      const track = i % 2 === 0 ? fwd : back;
      const [sx, sy] = track.at(0);
      moveTo(sx, sy, -depth, job.plungeRate);
      run(track, [], 0, track.length, -depth, -depth, rate);
    });
    out.push(`G0 Z${f(p.safeZ)}`);
    cur = { ...cur, z: p.safeZ };
  };

  const roughLevels = depthPasses(finalDepth, job.stepDown);
  // Finpasset tar bara huden, så det klarar djupare steg.
  const finishLevels = depthPasses(finalDepth, Math.max(job.stepDown * 3, finalDepth / 3));

  for (const loop of rough) cutLoop(orient(loop.points, job.side, st.direction), roughLevels, job.feedRate);
  for (const pl of open) cutOpen(pl.points, roughLevels, job.feedRate);
  if (finish) {
    const rate = job.feedRate * Math.max(0.2, Math.min(1.5, st.finishFeedFactor));
    out.push('; finish pass');
    for (const loop of fin) cutLoop(orient(loop.points, job.side, st.finishDirection), finishLevels, rate);
  }
  out.push('M5', ...p.footer);
  return out.join('\n') + '\n';
}
