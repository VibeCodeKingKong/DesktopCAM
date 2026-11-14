/**
 * Plasmaskärning.
 *
 * - Strålkompensation (kerf): banan flyttas en halv snittbredd ut från
 *   detaljen (utsida) eller in i hålet (insida) med avståndsfältets offset.
 * - Riktning: en vanlig brännare virvlar medurs, så den raka, fina snittkanten
 *   hamnar till höger om färdriktningen. Detaljen läggs därför till höger
 *   (ytterkonturer medurs, hål moturs).
 * - Inlöp/utlöp: genomstickningen görs i spillet, en bit från konturen, och
 *   brännaren glider in tangentiellt (båge) eller vinkelrätt (linje). Så blir
 *   det varken krater eller hack i detaljen. Utlöpet går också ut i spillet.
 * - Genomstickning: brännaren tänds på genomstickningshöjd, väntar
 *   genomstickningstiden (G4) och sänks sedan till skärhöjd.
 * - Höjdavkänning (IHS): brännaren känner av plåten med G38.2 före varje
 *   genomstickning, så Z = 0 alltid ligger på plåtens yta även om den är skev.
 * - Hål skärs före ytterkonturen (annars kan detaljen lossna och tippa), och
 *   små hål skärs långsammare. Höjdregleringen (THC) kan stängas av i små hål.
 */
import { formatNumber } from './gcode';
import type { PolylineInput } from './protocol';
import { offsetShapes } from './sdf';
import type { CutSide, PlasmaCutChartRow, PostprocessorConfig } from './types';

export type PlasmaLead = 'arc' | 'line' | 'none';

export interface PlasmaSettings {
  leadIn: PlasmaLead;
  /** Inlöpets längd, eller bågens radie (mm). */
  leadInLength: number;
  leadOut: PlasmaLead;
  leadOutLength: number;
  /** Hur långt brännaren fortsätter förbi startpunkten innan utlöpet (mm). */
  overcut: number;
  /** Höjd vid genomstickning (mm över plåten). */
  pierceHeight: number;
  /** Väntetid efter tändning innan rörelsen börjar (s). */
  pierceDelay: number;
  /** Höjd under skärningen (mm över plåten). */
  cutHeight: number;
  /** Initial höjdavkänning med G38.2 före varje genomstickning. */
  ihs: boolean;
  /** Hur långt Z rör sig från kontakt tills givaren slår till (mm). */
  ihsSwitchOffset: number;
  /** Långsammare matning i små hål. */
  holeSlowdown: boolean;
  /** Hål med mindre diameter än så räknas som små (mm). */
  holeDiameter: number;
  /** Matning i små hål, procent av vanlig matning. */
  holeFeedPct: number;
  /** Stäng av höjdregleringen (THC) i små hål. */
  thcOffInHoles: boolean;
  /** true = detaljen till höger om färdriktningen (medurs virvel, vanligast). */
  partOnRight: boolean;
  /** Matning i inlöpet och utlöpet, procent av skärmatningen. */
  leadInFeedPct: number;
  leadOutFeedPct: number;
  /** Sakta ner i skarpa hörn (mindre fasning, ingen urbränning i hörnet). */
  cornerSlowdown: boolean;
  /** Riktningsändring som räknas som skarpt hörn (grader). */
  cornerAngle: number;
  /** Hur långt före och efter hörnet farten sänks (mm). */
  cornerDistance: number;
  /** Matning i hörnen, procent av skärmatningen. */
  cornerFeedPct: number;
}

export interface PlasmaJob {
  groups: PolylineInput[][];
  side: CutSide;
  /** Snittbredd (mm). */
  kerf: number;
  feedRate: number;
  /** Nedmatning från genomstickningshöjd till skärhöjd (mm/min). */
  plungeRate: number;
  settings: PlasmaSettings;
  /** Maskinen har motoriserad Z-axel (annars skrivs inga Z-rörelser). */
  zAxis: boolean;
  /** Materialets tjocklek, för hur långt höjdavkänningen får söka (mm). */
  thickness: number;
  post: PostprocessorConfig;
}

export const defaultPlasmaSettings = (): PlasmaSettings => ({
  leadIn: 'arc',
  leadInLength: 4,
  leadOut: 'line',
  leadOutLength: 2,
  overcut: 0.5,
  pierceHeight: 3.8,
  pierceDelay: 0.4,
  cutHeight: 1.5,
  ihs: true,
  ihsSwitchOffset: 1.5,
  holeSlowdown: true,
  holeDiameter: 30,
  holeFeedPct: 60,
  thcOffInHoles: true,
  partOnRight: true,
  leadInFeedPct: 100,
  leadOutFeedPct: 100,
  cornerSlowdown: true,
  cornerAngle: 45,
  cornerDistance: 3,
  cornerFeedPct: 60,
});

/** Inställningar från äldre projekt får standardvärden för nya fält. */
export const withPlasmaDefaults = (s: Partial<PlasmaSettings>): PlasmaSettings => ({ ...defaultPlasmaSettings(), ...s });

/**
 * Var på banan det finns skarpa hörn (båglängd). Riktningen jämförs över
 * ett fönster på w mm åt varje håll, så att även hörn som består av många
 * korta segment (t.ex. en kugg) upptäcks, men inte mjuka bågar.
 */
export function cornerStations(pts: [number, number][], closed: boolean, angleDeg: number, w = 1): number[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  if (L < 1e-6) return [];
  const at = (s: number): [number, number] => {
    if (closed) s = ((s % L) + L) % L;
    else s = Math.max(0, Math.min(L, s));
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] <= s) lo = m;
      else hi = m;
    }
    const t = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
    return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t];
  };
  const limit = Math.cos((angleDeg * Math.PI) / 180);
  const found: { s: number; c: number }[] = [];
  const last = closed ? pts.length - 1 : pts.length;
  for (let k = 0; k < last; k++) {
    const s = cum[k];
    if (!closed && (s < w || s > L - w)) continue;
    const a = at(s - w), b = at(s + w), q = pts[k];
    const v1x = q[0] - a[0], v1y = q[1] - a[1], v2x = b[0] - q[0], v2y = b[1] - q[1];
    const n = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
    if (n < 1e-12) continue;
    const c = (v1x * v2x + v1y * v2y) / n;
    if (c < limit) found.push({ s, c });
  }
  // Ett hörn per kluster: punkten med störst riktningsändring.
  const out: number[] = [];
  for (const f of found) {
    const prev = out.length ? out[out.length - 1] : -Infinity;
    if (f.s - prev < w) {
      const pf = found.find((x) => x.s === prev)!;
      if (f.c < pf.c) out[out.length - 1] = f.s;
    } else out.push(f.s);
  }
  return out;
}

type P = [number, number];

const area = (pts: number[]) => {
  let a = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const j = (i + 2) % pts.length;
    a += pts[i] * pts[j + 1] - pts[j] * pts[i + 1];
  }
  return a / 2;
};

const toPoints = (flat: number[]): P[] => {
  const out: P[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1]]);
  // Slutna konturer ska inte ha dubblerad slutpunkt här.
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-9) out.pop();
  return out;
};

/** Punkter längs en båge från a till b runt c (moturs om ccw), med jämn uppdelning. */
function arcPoints(a: P, b: P, c: P, ccw: boolean): P[] {
  const r = Math.hypot(a[0] - c[0], a[1] - c[1]);
  let a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
  let a1 = Math.atan2(b[1] - c[1], b[0] - c[0]);
  if (ccw && a1 <= a0) a1 += 2 * Math.PI;
  if (!ccw && a1 >= a0) a1 -= 2 * Math.PI;
  const n = Math.max(4, Math.ceil((Math.abs(a1 - a0) * r) / 0.5));
  const out: P[] = [];
  for (let i = 1; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    out.push([c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r]);
  }
  return out;
}

interface Cut {
  /** Konturen med start- och slutpunkt i startpunkten. */
  path: P[];
  closed: boolean;
  hole: boolean;
  /** Ekvivalent diameter (mm) för slutna konturer. */
  diameter: number;
  /** Riktning in mot spillet vid startpunkten (enhetsvektor), och tangenten. */
  scrap: P;
  tangent: P;
}

export function plasmaGcode(job: PlasmaJob): string {
  const s = withPlasmaDefaults(job.settings);
  const p = job.post;
  const f = (n: number) => formatNumber(n, p.decimals);
  const side: CutSide = job.side;
  const half = job.kerf / 2;

  const closedGroups = job.groups.map((g) => g.filter((x) => x.closed)).filter((g) => g.length);
  const open = job.groups.flat().filter((x) => !x.closed);
  const loops: PolylineInput[] = side === 'on' ? closedGroups.flat() : closedGroups.length ? offsetShapes(closedGroups, side === 'outside' ? half : -half) : [];
  if (closedGroups.length && !loops.length) throw new Error('TOOL_TOO_LARGE');

  // Avståndsfältets konturer har formens insida till vänster. Vid utsida är
  // formens insida detaljen, vid insida är den spillet (hålet).
  const scrapLeftRaw = side === 'inside';
  const cuts: Cut[] = [];
  for (const loop of loops) {
    let pts = toPoints(loop.points);
    if (pts.length < 3) continue;
    const a = area(loop.points);
    const hole = scrapLeftRaw ? a > 0 : a < 0;
    // Detaljen till vänster i rådata när spillet är till höger.
    const partLeft = !scrapLeftRaw;
    if (partLeft === s.partOnRight) pts = pts.slice().reverse();
    const scrapLeft = s.partOnRight; // efter vändningen
    // Starta mitt på den längsta sträckan – långt från hörn, bra för inlöpet.
    let best = 0, bestLen = -1;
    for (let i = 0; i < pts.length; i++) {
      const q = pts[(i + 1) % pts.length];
      const l = Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]);
      if (l > bestLen) (bestLen = l), (best = i);
    }
    const A = pts[best], B = pts[(best + 1) % pts.length];
    const T: P = [(B[0] - A[0]) / (bestLen || 1), (B[1] - A[1]) / (bestLen || 1)];
    const M: P = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const path: P[] = [M];
    for (let k = 1; k <= pts.length; k++) path.push(pts[(best + k) % pts.length]);
    path.push(M);
    const left: P = [-T[1], T[0]];
    cuts.push({ path, closed: true, hole, diameter: 2 * Math.sqrt(Math.abs(a) / Math.PI), scrap: scrapLeft ? left : [-left[0], -left[1]], tangent: T });
  }
  // Hål först (minst först), sedan ytterkonturer – detaljen lossnar sist.
  cuts.sort((x, y) => (x.hole === y.hole ? x.diameter - y.diameter : x.hole ? -1 : 1));
  const openCuts: Cut[] = open
    .map((o) => toPoints(o.points))
    .filter((pts) => pts.length >= 2)
    .map((path) => ({ path, closed: false, hole: false, diameter: Infinity, scrap: [0, 0] as P, tangent: [1, 0] as P }));

  const torchOn = p.torchOn ?? 'M3 S1000';
  const torchOff = p.torchOff ?? 'M5';
  const out: string[] = [
    `; desktopCAM plasma (${side}, kerf ${f(job.kerf)} mm, lead-in ${s.leadIn} ${f(s.leadInLength)} mm, pierce ${f(s.pierceDelay)} s${s.ihs && job.zAxis ? ', IHS' : ''})`,
    ...p.header,
    'G21',
    'G90',
  ];
  const z = (v: number, rapid = true, rate?: number) => job.zAxis && out.push(`${rapid ? 'G0' : 'G1'} Z${f(v)}${rate ? ` F${f(rate)}` : ''}`);
  z(p.safeZ);
  let lastF = -1;
  const feed = (v: number) => {
    if (Math.abs(v - lastF) < 1e-9) return '';
    lastF = v;
    return ` F${f(v)}`;
  };
  const line = (q: P, rate: number) => out.push(`G1 X${f(q[0])} Y${f(q[1])}${feed(rate)}`);

  for (const c of [...openCuts, ...cuts]) {
    const small = c.closed && c.hole && c.diameter < s.holeDiameter;
    const rate = s.holeSlowdown && small ? (job.feedRate * s.holeFeedPct) / 100 : job.feedRate;
    const start = c.path[0];
    // Inlöpet får plats i hålet: högst en dryg tredjedel av hålets radie.
    const cap = c.hole ? Math.max(0, (c.diameter / 2) * 0.4) : Infinity;
    const lead = c.closed && s.leadIn !== 'none' ? Math.min(s.leadInLength, cap) : 0;
    const [nx, ny] = c.scrap, [tx, ty] = c.tangent;
    const leadIn: P[] = [];
    let pierce: P = start;
    if (lead > 0.05) {
      if (s.leadIn === 'arc') {
        // Kvartsbåge som börjar i spillet och möter konturen tangentiellt.
        const C: P = [start[0] + nx * lead, start[1] + ny * lead];
        pierce = [C[0] - tx * lead, C[1] - ty * lead];
        leadIn.push(...arcPoints(pierce, start, C, s.partOnRight));
      } else {
        pierce = [start[0] + nx * lead, start[1] + ny * lead];
        leadIn.push(start);
      }
    }

    out.push(`G0 X${f(pierce[0])} Y${f(pierce[1])}`);
    if (job.zAxis && s.ihs) {
      out.push(`G38.2 Z${f(-(job.thickness + 25))} F300`, `G92 Z${f(-s.ihsSwitchOffset)}`);
    }
    z(s.pierceHeight);
    if (small && s.thcOffInHoles && p.thcOff) out.push(p.thcOff);
    out.push(torchOn);
    if (s.pierceDelay > 0) out.push(`G4 P${f(s.pierceDelay)}`);
    if (job.zAxis) out.push(`G1 Z${f(s.cutHeight)} F${f(job.plungeRate)}`);
    lastF = job.zAxis ? job.plungeRate : -1;
    for (const q of leadIn) line(q, (rate * s.leadInFeedPct) / 100);

    // Konturen, och för slutna konturer en överskärning förbi startpunkten.
    const route: P[] = c.path.slice();
    let endDir: P = c.tangent;
    if (c.closed) {
      let left = Math.max(0, s.overcut);
      let pos = c.path[c.path.length - 1];
      for (let k = 1; k < c.path.length && left > 1e-6; k++) {
        const q = c.path[k];
        const d = Math.hypot(q[0] - pos[0], q[1] - pos[1]);
        if (d < 1e-9) continue;
        endDir = [(q[0] - pos[0]) / d, (q[1] - pos[1]) / d];
        const step = Math.min(d, left);
        pos = [pos[0] + endDir[0] * step, pos[1] + endDir[1] * step];
        route.push(pos);
        left -= step;
      }
    }
    // Hörnbromsning: lägre matning cornerDistance före och efter varje skarpt hörn.
    const L = c.closed ? c.path.reduce((acc, q, k) => (k ? acc + Math.hypot(q[0] - c.path[k - 1][0], q[1] - c.path[k - 1][1]) : 0), 0) : 0;
    const corners = s.cornerSlowdown ? cornerStations(c.path, c.closed, s.cornerAngle, Math.min(1, s.cornerDistance)) : [];
    const D = Math.max(0, s.cornerDistance);
    const slowAt = (u: number) => corners.some((cs) => {
      const d = c.closed ? Math.min(Math.abs(u - cs), Math.abs(u - cs - L), Math.abs(u - cs + L)) : Math.abs(u - cs);
      return d <= D;
    });
    const bounds: number[] = [];
    for (const cs of corners) for (const sh of c.closed ? [-L, 0, L] : [0]) bounds.push(cs + sh - D, cs + sh + D);
    bounds.sort((a, b) => a - b);
    const slowRate = Math.min(rate, (job.feedRate * s.cornerFeedPct) / 100);
    let sAcc = 0;
    for (let k = 1; k < route.length; k++) {
      const a = route[k - 1], b = route[k];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1e-9) continue;
      const cuts = [sAcc, ...bounds.filter((x) => x > sAcc + 1e-6 && x < sAcc + len - 1e-6), sAcc + len];
      for (let m = 1; m < cuts.length; m++) {
        const t = (cuts[m] - sAcc) / len;
        const mid = (cuts[m - 1] + cuts[m]) / 2;
        line(m === cuts.length - 1 ? b : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], corners.length && slowAt(mid) ? slowRate : rate);
      }
      sAcc += len;
    }

    if (c.closed) {
      const pos = route[route.length - 1];
      const leadOutRate = (rate * s.leadOutFeedPct) / 100;
      // Utlöp ut i spillet.
      const lo = s.leadOut !== 'none' ? Math.min(s.leadOutLength, c.hole ? (c.diameter / 2) * 0.4 : Infinity) : 0;
      if (lo > 0.05) {
        const sl: P = s.partOnRight ? [-endDir[1], endDir[0]] : [endDir[1], -endDir[0]];
        if (s.leadOut === 'arc') {
          const C: P = [pos[0] + sl[0] * lo, pos[1] + sl[1] * lo];
          for (const q of arcPoints(pos, [C[0] + endDir[0] * lo, C[1] + endDir[1] * lo], C, s.partOnRight)) line(q, leadOutRate);
        } else line([pos[0] + sl[0] * lo, pos[1] + sl[1] * lo], leadOutRate);
      }
    }
    out.push(torchOff);
    if (small && s.thcOffInHoles && p.thcOn) out.push(p.thcOn);
    z(p.safeZ);
  }
  out.push(torchOff, ...p.footer);
  return out.join('\n') + '\n';
}

/**
 * Riktvärden för en tjocklek ur skärtabellen. Mellan två rader interpoleras
 * linjärt; utanför tabellen används närmaste rad.
 */
export function plasmaChartAt(rows: PlasmaCutChartRow[] | undefined, thickness: number): PlasmaCutChartRow | null {
  if (!rows?.length) return null;
  const sorted = [...rows].sort((a, b) => a.thickness - b.thickness);
  if (thickness <= sorted[0].thickness) return { ...sorted[0], thickness };
  const last = sorted[sorted.length - 1];
  if (thickness >= last.thickness) return { ...last, thickness };
  const i = sorted.findIndex((r) => r.thickness >= thickness);
  const a = sorted[i - 1], b = sorted[i];
  const k = (thickness - a.thickness) / (b.thickness - a.thickness);
  const mix = (x: number, y: number) => x + (y - x) * k;
  return {
    thickness,
    amps: Math.round(mix(a.amps, b.amps)),
    feedRate: Math.round(mix(a.feedRate, b.feedRate) / 10) * 10,
    kerf: +mix(a.kerf, b.kerf).toFixed(2),
    pierceDelay: +mix(a.pierceDelay, b.pierceDelay).toFixed(2),
    pierceHeight: +mix(a.pierceHeight, b.pierceHeight).toFixed(1),
    cutHeight: +mix(a.cutHeight, b.cutHeight).toFixed(1),
  };
}
