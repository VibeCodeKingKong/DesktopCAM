/**
 * Formbibliotek: färdiga vektormotiv – ramar, banderoller, ornament och
 * linjemönster – som läggs in som vanliga former. Användaren väljer sedan
 * själv bearbetning (ficka, V-gravyr, profil, inlägg, linjegravyr, borrning).
 *
 * Alla motiv byggs runt origo i storleken w × h (mm) och flyttas sedan dit
 * de ska. Slutna banor i samma form fylls med jämn–udda-regeln, så en ram
 * är två slutna banor (ytter och inner).
 */
import { uid } from './geometry';
import type { PathSegment, Vec2, VectorPath, VectorShape } from './types';

export type ShapeLibraryCategory = 'basic' | 'frames' | 'banners' | 'ornaments' | 'mechanical' | 'joinery' | 'textures';

export interface ShapeLibraryParams {
  /** Ramens bredd (mm). */
  band: number;
  /** Avstånd mellan linjer eller celler (mm). */
  spacing: number;
  /** Värden för motivets reglage (se ShapeLibraryItem.controls). */
  values?: Record<string, number | string>;
}

/** Reglage för ett motiv: ett tal (dragreglage) eller ett val bland alternativ. */
export type ShapeLibraryControl =
  | { key: string; min: number; max: number; step?: number; def: number; unit?: 'mm' | '%' }
  | { key: string; options: string[]; def: string };

export interface ShapeLibraryItem {
  id: string;
  category: ShapeLibraryCategory;
  /** 'area' = slutna ytor (ficka, V-gravyr, inlägg). 'lines' = linjer att gravera längs. 'holes' = cirklar för borrning. */
  kind: 'area' | 'lines' | 'holes';
  size: { w: number; h: number };
  /** Vilken extra inställning motivet har. */
  param?: 'band' | 'spacing';
  /** Reglage som ändrar motivets form. */
  controls?: ShapeLibraryControl[];
  /** Måtten styrs av reglagen (t.ex. en fläns) – inga fält för bredd och höjd. */
  fixedSize?: boolean;
  build: (w: number, h: number, p: ShapeLibraryParams) => VectorPath[];
}

/* ───────── Hjälpfunktioner ───────── */

const P = (x: number, y: number): Vec2 => ({ x, y });

function poly(pts: Vec2[], closed = true): VectorPath {
  const segs: PathSegment[] = pts.slice(1).map((to) => ({ type: 'line', to }));
  if (closed) segs.push({ type: 'line', to: pts[0] });
  return { id: uid('path'), start: pts[0], segments: segs, closed };
}

/** Mjuk kurva genom punkterna (Catmull–Rom som Bézier). */
function smooth(pts: Vec2[], closed: boolean): VectorPath {
  const n = pts.length;
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const segs: PathSegment[] = [];
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    segs.push({ type: 'cubic', c1: P(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6), c2: P(p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6), to: p2 });
  }
  return { id: uid('path'), start: pts[0], segments: segs, closed };
}

function ellipse(cx: number, cy: number, rx: number, ry: number): VectorPath {
  const k = 0.5522847498;
  const s = (x: number, y: number) => P(cx + x, cy + y);
  return {
    id: uid('path'),
    start: s(rx, 0),
    closed: true,
    segments: [
      { type: 'cubic', c1: s(rx, ry * k), c2: s(rx * k, ry), to: s(0, ry) },
      { type: 'cubic', c1: s(-rx * k, ry), c2: s(-rx, ry * k), to: s(-rx, 0) },
      { type: 'cubic', c1: s(-rx, -ry * k), c2: s(-rx * k, -ry), to: s(0, -ry) },
      { type: 'cubic', c1: s(rx * k, -ry), c2: s(rx, -ry * k), to: s(rx, 0) },
    ],
  };
}

/** Rektangel med rundade hörn, moturs. */
function roundRect(x0: number, y0: number, x1: number, y1: number, r: number): VectorPath {
  r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  if (r < 1e-6) return poly([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]);
  const arc = (to: Vec2, center: Vec2): PathSegment => ({ type: 'arc', to, center, clockwise: false });
  return {
    id: uid('path'),
    start: P(x0 + r, y0),
    closed: true,
    segments: [
      { type: 'line', to: P(x1 - r, y0) },
      arc(P(x1, y0 + r), P(x1 - r, y0 + r)),
      { type: 'line', to: P(x1, y1 - r) },
      arc(P(x1 - r, y1), P(x1 - r, y1 - r)),
      { type: 'line', to: P(x0 + r, y1) },
      arc(P(x0, y1 - r), P(x0 + r, y1 - r)),
      { type: 'line', to: P(x0, y0 + r) },
      arc(P(x0 + r, y0), P(x0 + r, y0 + r)),
    ],
  };
}

/** Rektangel med inåtbuktande (konkava) hörn med radien c, centrerade i hörnen. */
function scallopRect(hw: number, hh: number, c: number, inset: number): VectorPath {
  const R = c + inset;
  const ex = hw - inset, ey = hh - inset;
  const dx = Math.sqrt(Math.max(0, R * R - inset * inset));
  const corner = (sx: number, sy: number) => P(sx * hw, sy * hh);
  const arc = (to: Vec2, center: Vec2): PathSegment => ({ type: 'arc', to, center, clockwise: true });
  // Moturs runt: nederkant → högerkant → överkant → vänsterkant.
  return {
    id: uid('path'),
    start: P(-hw + dx, -ey),
    closed: true,
    segments: [
      { type: 'line', to: P(hw - dx, -ey) },
      arc(P(ex, -hh + dx), corner(1, -1)),
      { type: 'line', to: P(ex, hh - dx) },
      arc(P(hw - dx, ey), corner(1, 1)),
      { type: 'line', to: P(-hw + dx, ey) },
      arc(P(-ex, hh - dx), corner(-1, 1)),
      { type: 'line', to: P(-ex, -hh + dx) },
      arc(P(-hw + dx, -ey), corner(-1, -1)),
    ],
  };
}

/** Värdet för ett reglage (standardvärdet fylls i av buildLibraryShape). */
const num = (p: ShapeLibraryParams, k: string) => Number(p.values?.[k] ?? 0);
const opt = (p: ShapeLibraryParams, k: string) => String(p.values?.[k] ?? '');

/** Moturs ordning (positiv area). */
function ccw(pts: Vec2[]): Vec2[] {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a < 0 ? pts.slice().reverse() : pts;
}

/** Sluten månghörning med hörnen rundade med radien r (bågar, även inåtgående hörn). */
function filletPoly(input: Vec2[], r: number): VectorPath {
  const pts = ccw(input);
  if (!(r > 0)) return poly(pts);
  const n = pts.length;
  const corners = pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const la = Math.hypot(a.x - p.x, a.y - p.y), lb = Math.hypot(b.x - p.x, b.y - p.y);
    const u1 = P((a.x - p.x) / la, (a.y - p.y) / la), u2 = P((b.x - p.x) / lb, (b.y - p.y) / lb);
    const cos = Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y));
    const th = Math.acos(cos);
    if (th < 1e-3 || Math.PI - th < 1e-3) return null;
    let t = r / Math.tan(th / 2);
    t = Math.min(t, la / 2 - 1e-6, lb / 2 - 1e-6);
    const re = t * Math.tan(th / 2);
    const bl = Math.hypot(u1.x + u2.x, u1.y + u2.y);
    const dc = re / Math.sin(th / 2);
    const c = P(p.x + ((u1.x + u2.x) / bl) * dc, p.y + ((u1.y + u2.y) / bl) * dc);
    // Inåtgående hörn (högersväng i en moturs kontur) rundas medurs.
    const turn = (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x);
    return { s: P(p.x + u1.x * t, p.y + u1.y * t), e: P(p.x + u2.x * t, p.y + u2.y * t), c, cw: turn < 0 };
  });
  const startOf = (i: number) => corners[i]?.s ?? pts[i];
  const segs: PathSegment[] = [];
  for (let i = 0; i < n; i++) {
    const k = corners[i];
    if (k) segs.push({ type: 'arc', to: k.e, center: k.c, clockwise: k.cw });
    segs.push({ type: 'line', to: startOf((i + 1) % n) });
  }
  return { id: uid('path'), start: startOf(0), segments: segs, closed: true };
}

const circlePath = (cx: number, cy: number, d: number) => ellipse(cx, cy, d / 2, d / 2);

/** Långhål (moturs) från (x0, y) till (x1, y) med bredden w. */
function slotPath(x0: number, x1: number, y: number, w: number): VectorPath {
  const r = w / 2;
  return {
    id: uid('path'),
    start: P(x0, y - r),
    closed: true,
    segments: [
      { type: 'line', to: P(x1, y - r) },
      { type: 'arc', to: P(x1, y + r), center: P(x1, y), clockwise: false },
      { type: 'line', to: P(x0, y + r) },
      { type: 'arc', to: P(x0, y - r), center: P(x0, y), clockwise: false },
    ],
  };
}

/** Förutsägbar slump (samma frö ger samma mönster). */
function seeded(seed: number) {
  let x = (Math.floor(seed) * 16807 + 13) % 2147483647 || 1;
  return () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
}

const range = (n: number) => Array.from({ length: Math.max(0, n) }, (_, i) => i);

/**
 * Fingerskarv: kanten delas i ett udda antal lika delar. 'ends' = finger i
 * båda ändarna (jämna delar är fingrar), 'gaps' = det omvända, 'flat' = rak.
 * Ett urtag går t in från kanten.
 */
type FingerEdge = { len: number; kind: 'ends' | 'gaps' | 'flat'; n: number };
const fingerCount = (len: number, f: number) => {
  let n = Math.max(3, Math.round(len / Math.max(1, f)));
  if (n % 2 === 0) n++;
  return n;
};

/** Kontur (moturs) för en platta w × h med fyra kanter: under, höger, över, vänster. */
function fingerPanel(w: number, h: number, t: number, edges: [FingerEdge, FingerEdge, FingerEdge, FingerEdge]): Vec2[] {
  const corners = [P(0, 0), P(w, 0), P(w, h), P(0, h)];
  const dirs = [P(1, 0), P(0, 1), P(-1, 0), P(0, -1)];
  const segs = edges.map((e) => range(e.kind === 'flat' ? 1 : e.n).map((i) => {
    const cut = e.kind === 'ends' ? i % 2 === 1 : e.kind === 'gaps' ? i % 2 === 0 : false;
    const n = e.kind === 'flat' ? 1 : e.n;
    return { a: (i * e.len) / n, b: ((i + 1) * e.len) / n, d: cut ? t : 0 };
  }));
  const pts: Vec2[] = [];
  for (let k = 0; k < 4; k++) {
    const sg = segs[k], prev = segs[(k + 3) % 4], next = segs[(k + 1) % 4];
    const c = corners[k], u = dirs[k], nrm = P(-u.y, u.x);
    const at = (along: number, d: number) => P(c.x + u.x * along + nrm.x * d, c.y + u.y * along + nrm.y * d);
    pts.push(at(prev[prev.length - 1].d, sg[0].d));
    for (let j = 0; j + 1 < sg.length; j++) {
      if (sg[j].d === sg[j + 1].d) continue;
      pts.push(at(sg[j].b, sg[j].d), at(sg[j].b, sg[j + 1].d));
    }
    pts.push(at(edges[k].len - next[0].d, sg[sg.length - 1].d));
  }
  return pts.filter((q, i) => {
    const r = pts[(i + 1) % pts.length];
    return Math.hypot(q.x - r.x, q.y - r.y) > 1e-9;
  });
}

/** Alla delar till en låda med yttermåtten L × W × H (botten, valfritt lock). */
export function fingerBox(L: number, W: number, H: number, t: number, f: number, lid: boolean) {
  const nL = fingerCount(L, f), nW = fingerCount(W, f), nH = fingerCount(H, f);
  const top = (n: number, len: number): FingerEdge => (lid ? { len, kind: 'ends', n } : { len, kind: 'flat', n: 1 });
  const longSide = { w: L, h: H, pts: fingerPanel(L, H, t, [{ len: L, kind: 'ends', n: nL }, { len: H, kind: 'ends', n: nH }, top(nL, L), { len: H, kind: 'ends', n: nH }]) };
  const shortSide = { w: W, h: H, pts: fingerPanel(W, H, t, [{ len: W, kind: 'ends', n: nW }, { len: H, kind: 'gaps', n: nH }, top(nW, W), { len: H, kind: 'gaps', n: nH }]) };
  const base = { w: L, h: W, pts: fingerPanel(L, W, t, [{ len: L, kind: 'gaps', n: nL }, { len: W, kind: 'gaps', n: nW }, { len: L, kind: 'gaps', n: nL }, { len: W, kind: 'gaps', n: nW }]) };
  return [longSide, longSide, shortSide, shortSide, base, ...(lid ? [base] : [])];
}

/* ───────── Motiven ───────── */

export const SHAPE_LIBRARY: ShapeLibraryItem[] = [
  {
    id: 'frame-rect',
    category: 'frames',
    kind: 'area',
    size: { w: 160, h: 100 },
    param: 'band',
    build: (w, h, p) => {
      const r = Math.min(w, h) * 0.08;
      const b = Math.min(p.band, w / 3, h / 3);
      return [roundRect(-w / 2, -h / 2, w / 2, h / 2, r), roundRect(-w / 2 + b, -h / 2 + b, w / 2 - b, h / 2 - b, Math.max(0, r - b))];
    },
  },
  {
    id: 'frame-oval',
    category: 'frames',
    kind: 'area',
    size: { w: 140, h: 100 },
    param: 'band',
    build: (w, h, p) => {
      const b = Math.min(p.band, w / 3, h / 3);
      return [ellipse(0, 0, w / 2, h / 2), ellipse(0, 0, w / 2 - b, h / 2 - b)];
    },
  },
  {
    id: 'frame-plaque',
    category: 'frames',
    kind: 'area',
    size: { w: 160, h: 100 },
    param: 'band',
    build: (w, h, p) => {
      const c = Math.min(w, h) * 0.14;
      const b = Math.min(p.band, w / 4, h / 4);
      return [scallopRect(w / 2, h / 2, c, 0), scallopRect(w / 2, h / 2, c, b)];
    },
  },
  {
    id: 'frame-double',
    category: 'frames',
    kind: 'lines',
    size: { w: 160, h: 100 },
    param: 'band',
    build: (w, h, p) => {
      const r = Math.min(w, h) * 0.06;
      const b = Math.min(p.band, w / 4, h / 4);
      return [roundRect(-w / 2, -h / 2, w / 2, h / 2, r), roundRect(-w / 2 + b, -h / 2 + b, w / 2 - b, h / 2 - b, Math.max(0, r - b))];
    },
  },
  {
    id: 'banner-ribbon',
    category: 'banners',
    kind: 'area',
    size: { w: 200, h: 60 },
    build: (w, h) => {
      const a = w * 0.34; // halva bandets bredd
      const d = h * 0.22; // hur mycket ändarna ligger lägre
      const n = h * 0.3; // klyvningens djup
      const fold = w * 0.05;
      const body = poly([P(-a, -h / 2 + d), P(a, -h / 2 + d), P(a, h / 2), P(-a, h / 2)]);
      const tail = (s: number) =>
        poly(
          [P(s * a, h / 2 - d), P((s * w) / 2, h / 2 - d), P(s * (w / 2 - n * 0.6), (h / 2 - d - h / 2) / 2), P((s * w) / 2, -h / 2), P(s * (a - fold), -h / 2), P(s * (a - fold), -h / 2 + d), P(s * a, -h / 2 + d)]
        );
      return [body, tail(1), tail(-1)];
    },
  },
  {
    id: 'banner-scroll',
    category: 'banners',
    kind: 'area',
    size: { w: 200, h: 50 },
    build: (w, h) => {
      const band = h * 0.62, amp = (h - band) / 2;
      const N = 9;
      const top = range(N).map((i) => P(-w / 2 + (w * i) / (N - 1), h / 2 - amp + amp * Math.sin((i / (N - 1)) * Math.PI * 2)));
      const bottom = top.map((q) => P(q.x, q.y - band)).reverse();
      const notch = band * 0.35;
      const path = smooth(top, false);
      const back = smooth(bottom, false);
      path.segments.push({ type: 'line', to: P(w / 2 - notch, top[N - 1].y - band / 2) }, { type: 'line', to: bottom[0] }, ...back.segments, { type: 'line', to: P(-w / 2 + notch, top[0].y - band / 2) }, { type: 'line', to: top[0] });
      path.closed = true;
      return [path];
    },
  },
  {
    id: 'label-tag',
    category: 'banners',
    kind: 'area',
    size: { w: 160, h: 50 },
    build: (w, h) => {
      const n = h * 0.35;
      return [poly([P(-w / 2, -h / 2), P(w / 2, -h / 2), P(w / 2 - n, 0), P(w / 2, h / 2), P(-w / 2, h / 2), P(-w / 2 + n, 0)])];
    },
  },
  {
    id: 'shield',
    category: 'banners',
    kind: 'area',
    size: { w: 90, h: 110 },
    build: (w, h) => [
      {
        id: uid('path'),
        start: P(-w / 2, h / 2),
        closed: true,
        segments: [
          { type: 'cubic', c1: P(-w / 6, h / 2 - h * 0.06), c2: P(w / 6, h / 2 - h * 0.06), to: P(w / 2, h / 2) },
          { type: 'line', to: P(w / 2, h * 0.05) },
          { type: 'cubic', c1: P(w / 2, -h * 0.25), c2: P(w * 0.2, -h * 0.4), to: P(0, -h / 2) },
          { type: 'cubic', c1: P(-w * 0.2, -h * 0.4), c2: P(-w / 2, -h * 0.25), to: P(-w / 2, h * 0.05) },
          { type: 'line', to: P(-w / 2, h / 2) },
        ],
      },
    ],
  },
  {
    id: 'star',
    category: 'basic',
    kind: 'area',
    size: { w: 80, h: 80 },
    controls: [
      { key: 'points', min: 3, max: 16, def: 5 },
      { key: 'innerRadius', min: 15, max: 90, def: 40, unit: '%' },
      { key: 'rounding', min: 0, max: 10, step: 0.5, def: 0, unit: 'mm' },
    ],
    build: (w, h, p) => {
      const n = num(p, 'points'), q = num(p, 'innerRadius') / 100;
      const pts = range(2 * n).map((i) => {
        const a = Math.PI / 2 + (i * Math.PI) / n;
        const r = i % 2 ? q : 1;
        return P(Math.cos(a) * r * (w / 2), Math.sin(a) * r * (h / 2));
      });
      return [filletPoly(pts, num(p, 'rounding'))];
    },
  },
  {
    id: 'heart',
    category: 'ornaments',
    kind: 'area',
    size: { w: 80, h: 72 },
    build: (w, h) => {
      const sx = w / 2, sy = h / 2;
      const s = (x: number, y: number) => P(x * sx, y * sy);
      return [
        {
          id: uid('path'),
          start: s(0, -1),
          closed: true,
          segments: [
            { type: 'cubic', c1: s(0.55, -0.45), c2: s(1.05, 0.05), to: s(0.98, 0.5) },
            { type: 'cubic', c1: s(0.9, 1.05), c2: s(0.2, 1.1), to: s(0, 0.6) },
            { type: 'cubic', c1: s(-0.2, 1.1), c2: s(-0.9, 1.05), to: s(-0.98, 0.5) },
            { type: 'cubic', c1: s(-1.05, 0.05), c2: s(-0.55, -0.45), to: s(0, -1) },
          ],
        },
      ];
    },
  },
  {
    id: 'arrow',
    category: 'ornaments',
    kind: 'area',
    size: { w: 120, h: 50 },
    build: (w, h) => {
      const head = Math.min(w * 0.35, h * 1.2), t = h * 0.36;
      return [poly([P(-w / 2, -t / 2), P(w / 2 - head, -t / 2), P(w / 2 - head, -h / 2), P(w / 2, 0), P(w / 2 - head, h / 2), P(w / 2 - head, t / 2), P(-w / 2, t / 2)])];
    },
  },
  {
    id: 'sunburst',
    category: 'ornaments',
    kind: 'area',
    size: { w: 100, h: 100 },
    build: (w, h) => {
      const rays = 16, rx = w / 2, ry = h / 2;
      const out: VectorPath[] = [ellipse(0, 0, rx * 0.28, ry * 0.28)];
      for (const i of range(rays)) {
        const a = (i * 2 * Math.PI) / rays, da = Math.PI / rays * 0.55;
        const r0 = 0.36, r1 = i % 2 ? 0.78 : 1;
        out.push(poly([P(Math.cos(a - da) * r0 * rx, Math.sin(a - da) * r0 * ry), P(Math.cos(a) * r1 * rx, Math.sin(a) * r1 * ry), P(Math.cos(a + da) * r0 * rx, Math.sin(a + da) * r0 * ry)]));
      }
      return out;
    },
  },
  {
    id: 'flourish',
    category: 'ornaments',
    kind: 'lines',
    size: { w: 160, h: 30 },
    build: (w, h) => {
      // Symmetrisk avdelare: en mittlinje som slutar i en spiral åt varje håll.
      const half = (s: number) => {
        const pts: Vec2[] = [P(0, 0), P(s * w * 0.14, h * 0.18), P(s * w * 0.26, h * 0.05), P(s * w * 0.36, -h * 0.2), P(s * w * 0.42, -h * 0.05)];
        const cx = s * w * 0.41, cy = h * 0.1;
        for (let k = 1; k <= 10; k++) {
          const a = -Math.PI / 2 + (s > 0 ? 1 : -1) * k * 0.55;
          const r = h * 0.38 * (1 - k / 13);
          pts.push(P(cx + s * Math.cos(a) * r * 1.6, cy + Math.sin(a) * r));
        }
        return smooth(pts, false);
      };
      const dot = ellipse(0, h * 0.32, h * 0.08, h * 0.08);
      return [half(1), half(-1), dot];
    },
  },
  {
    id: 'waves',
    category: 'textures',
    kind: 'lines',
    size: { w: 160, h: 80 },
    param: 'spacing',
    build: (w, h, p) => {
      const s = Math.max(1, p.spacing);
      const amp = s * 0.35, n = Math.floor((h - 2 * amp) / s) + 1;
      const waves = Math.max(2, Math.round(w / (s * 6)));
      const pts = waves * 8 + 1;
      return range(n).map((k) => {
        const y0 = -h / 2 + amp + k * s;
        return smooth(range(pts).map((i) => P(-w / 2 + (w * i) / (pts - 1), y0 + amp * Math.sin((i / (pts - 1)) * waves * 2 * Math.PI + k * 0.6))), false);
      });
    },
  },
  {
    id: 'topo',
    category: 'textures',
    kind: 'lines',
    size: { w: 160, h: 110 },
    param: 'spacing',
    build: (w, h, p) => {
      // Höjdkurvor som på en karta: oregelbundna, koncentriska slingor.
      const shape = (t: number, k: number) => 1 + 0.16 * Math.sin(3 * t + 0.4 * k) + 0.09 * Math.sin(5 * t + 1.7 - 0.3 * k) + 0.05 * Math.cos(7 * t + 0.9);
      const maxF = 1.3;
      const n = Math.max(1, Math.floor(Math.min(w, h) / 2 / Math.max(1, p.spacing) / maxF * 0.98));
      const cx = -w * 0.08, cy = h * 0.06;
      const sx = (w / 2 - Math.abs(cx)) / (n * Math.max(1, p.spacing) * maxF), sy = (h / 2 - Math.abs(cy)) / (n * Math.max(1, p.spacing) * maxF);
      return range(n).map((k) => {
        const r = (k + 1) * Math.max(1, p.spacing);
        const pts = range(40).map((i) => {
          const t = (i / 40) * 2 * Math.PI;
          const f = shape(t, k);
          return P(cx + Math.cos(t) * r * f * sx, cy + Math.sin(t) * r * f * sy);
        });
        return smooth(pts, true);
      });
    },
  },
  {
    id: 'diamonds',
    category: 'textures',
    kind: 'lines',
    size: { w: 120, h: 80 },
    param: 'spacing',
    build: (w, h, p) => {
      const s = Math.max(2, p.spacing);
      const out: VectorPath[] = [];
      const hw = w / 2, hh = h / 2;
      // Linjer y = ±x + c, klippta mot rektangeln.
      for (const dir of [1, -1]) {
        for (let c = -hw - hh; c <= hw + hh + 1e-9; c += s) {
          const pts: Vec2[] = [];
          for (const x of [-hw, hw]) {
            const y = dir * x + c;
            if (y >= -hh - 1e-9 && y <= hh + 1e-9) pts.push(P(x, y));
          }
          for (const y of [-hh, hh]) {
            const x = dir * (y - c);
            if (x > -hw + 1e-9 && x < hw - 1e-9) pts.push(P(x, y));
          }
          if (pts.length >= 2) {
            pts.sort((a, b) => a.x - b.x);
            if (Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) > 0.5) out.push(poly([pts[0], pts[pts.length - 1]], false));
          }
        }
      }
      out.push(poly([P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh)]));
      return out;
    },
  },
  {
    id: 'honeycomb',
    category: 'textures',
    kind: 'area',
    size: { w: 120, h: 80 },
    param: 'spacing',
    build: (w, h, p) => {
      // Sexkantiga celler med en vägg emellan – fickfräs cellerna eller gravera kanterna.
      const s = Math.max(4, p.spacing);
      const wall = Math.max(0.8, s * 0.12);
      const R = s / Math.sqrt(3); // cellens hörnradie (mitt till hörn)
      const r = R - wall / Math.sqrt(3);
      const dx = s, dy = s * Math.sqrt(3) / 2;
      const out: VectorPath[] = [];
      for (let row = 0; ; row++) {
        const y = -h / 2 + R + row * dy;
        if (y + R > h / 2 + 1e-9) break;
        for (let col = 0; ; col++) {
          const x = -w / 2 + s / 2 + col * dx + (row % 2 ? s / 2 : 0);
          if (x + s / 2 > w / 2 + 1e-9) break;
          out.push(poly(range(6).map((i) => P(x + r * Math.cos(Math.PI / 6 + (i * Math.PI) / 3), y + r * Math.sin(Math.PI / 6 + (i * Math.PI) / 3)))));
        }
      }
      return out;
    },
  },
  {
    id: 'dots-border',
    category: 'textures',
    kind: 'holes',
    size: { w: 160, h: 100 },
    param: 'spacing',
    build: (w, h, p) => {
      // Hål längs kanten – t.ex. för dekorativa borrhål runt en skylt.
      const s = Math.max(3, p.spacing);
      const d = Math.min(s * 0.45, 6);
      const out: VectorPath[] = [];
      const nx = Math.max(1, Math.round(w / s)), ny = Math.max(1, Math.round(h / s));
      const hw = w / 2 - d, hh = h / 2 - d;
      for (const i of range(nx + 1)) for (const y of [-hh, hh]) out.push(ellipse(-hw + (2 * hw * i) / nx, y, d / 2, d / 2));
      for (const j of range(ny - 1)) for (const x of [-hw, hw]) out.push(ellipse(x, -hh + (2 * hh * (j + 1)) / ny, d / 2, d / 2));
      return out;
    },
  },
  /* ───────── Grundformer ───────── */
  {
    id: 'polygon',
    category: 'basic',
    kind: 'area',
    size: { w: 100, h: 100 },
    controls: [
      { key: 'sides', min: 3, max: 12, def: 6 },
      { key: 'cornerRadius', min: 0, max: 20, step: 0.5, def: 3, unit: 'mm' },
    ],
    build: (w, h, p) => {
      const n = num(p, 'sides');
      const pts = range(n).map((i) => {
        const a = Math.PI / 2 + (i * 2 * Math.PI) / n;
        return P((Math.cos(a) * w) / 2, (Math.sin(a) * h) / 2);
      });
      return [filletPoly(pts, num(p, 'cornerRadius'))];
    },
  },
  {
    id: 'corner-plate',
    category: 'basic',
    kind: 'area',
    size: { w: 200, h: 90 },
    controls: [
      { key: 'cornerSize', min: 0, max: 40, step: 0.5, def: 16, unit: 'mm' },
      { key: 'cornerStyle', options: ['round', 'chamfer', 'inward'], def: 'inward' },
    ],
    build: (w, h, p) => {
      const c = Math.min(num(p, 'cornerSize'), w / 2 - 0.5, h / 2 - 0.5);
      const hw = w / 2, hh = h / 2, style = opt(p, 'cornerStyle');
      if (c <= 0) return [poly([P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh)])];
      if (style === 'round') return [roundRect(-hw, -hh, hw, hh, c)];
      if (style === 'chamfer') return [poly([P(-hw + c, -hh), P(hw - c, -hh), P(hw, -hh + c), P(hw, hh - c), P(hw - c, hh), P(-hw + c, hh), P(-hw, hh - c), P(-hw, -hh + c)])];
      return [scallopRect(hw, hh, c, 0)];
    },
  },

  /* ───────── Dekor ───────── */
  {
    id: 'speech-bubble',
    category: 'ornaments',
    kind: 'area',
    size: { w: 180, h: 128 },
    controls: [
      { key: 'cornerRadius', min: 0, max: 40, step: 0.5, def: 18, unit: 'mm' },
      { key: 'tailPos', min: 15, max: 85, def: 30, unit: '%' },
      { key: 'tailLength', min: 10, max: 40, def: 22, unit: '%' },
    ],
    build: (w, h, p) => {
      const tl = (h * num(p, 'tailLength')) / 100;
      const hw = w / 2, top = h / 2, bot = -h / 2 + tl;
      const r = Math.min(num(p, 'cornerRadius'), hw - 1, (top - bot) / 2 - 1);
      const tw = Math.min(w * 0.12, 24);
      const px = Math.max(-hw + r + tw, Math.min(hw - r - tw / 2, -hw + (w * num(p, 'tailPos')) / 100));
      const arc = (to: Vec2, center: Vec2): PathSegment => ({ type: 'arc', to, center, clockwise: false });
      const segs: PathSegment[] = [
        { type: 'line', to: P(px - tw / 2, bot) },
        { type: 'line', to: P(px - tw, -h / 2) },
        { type: 'line', to: P(px + tw / 2, bot) },
        { type: 'line', to: P(hw - r, bot) },
      ];
      if (r > 0) segs.push(arc(P(hw, bot + r), P(hw - r, bot + r)));
      segs.push({ type: 'line', to: P(hw, top - r) });
      if (r > 0) segs.push(arc(P(hw - r, top), P(hw - r, top - r)));
      segs.push({ type: 'line', to: P(-hw + r, top) });
      if (r > 0) segs.push(arc(P(-hw, top - r), P(-hw + r, top - r)));
      segs.push({ type: 'line', to: P(-hw, bot + r) });
      if (r > 0) segs.push(arc(P(-hw + r, bot), P(-hw + r, bot + r)));
      return [{ id: uid('path'), start: P(-hw + r, bot), segments: segs, closed: true }];
    },
  },
  {
    id: 'scallop-frame',
    category: 'frames',
    kind: 'area',
    size: { w: 200, h: 140 },
    controls: [
      { key: 'arcs', min: 8, max: 40, def: 18 },
      { key: 'arcDepth', min: 1, max: 15, step: 0.5, def: 5, unit: 'mm' },
    ],
    build: (w, h, p) => {
      const n = num(p, 'arcs'), a = Math.min(num(p, 'arcDepth'), w / 4, h / 4);
      const N = Math.max(240, n * 24);
      const pts = range(N).map((i) => {
        const t = (i / N) * 2 * Math.PI;
        const k = Math.abs(Math.sin((t * n) / 2));
        return P((w / 2 - a + a * k) * Math.cos(t), (h / 2 - a + a * k) * Math.sin(t));
      });
      return [poly(pts)];
    },
  },
  {
    id: 'flower',
    category: 'ornaments',
    kind: 'area',
    size: { w: 120, h: 120 },
    controls: [
      { key: 'petals', min: 4, max: 14, def: 8 },
      { key: 'petalDepth', min: 10, max: 60, def: 35, unit: '%' },
      { key: 'centerHole', min: 0, max: 40, def: 15, unit: '%' },
    ],
    build: (w, h, p) => {
      const n = num(p, 'petals'), q = num(p, 'petalDepth') / 100, N = Math.max(240, n * 40);
      const pts = range(N).map((i) => {
        const t = (i / N) * 2 * Math.PI;
        const k = 1 - q * (1 - Math.abs(Math.cos((t * n) / 2)));
        return P((k * w * Math.cos(t)) / 2, (k * h * Math.sin(t)) / 2);
      });
      const hole = num(p, 'centerHole') / 100;
      return hole > 0 ? [poly(pts), ellipse(0, 0, (w * hole) / 2, (h * hole) / 2)] : [poly(pts)];
    },
  },

  /* ───────── Mekaniska delar (måtten styrs av reglagen) ───────── */
  {
    id: 'flange',
    category: 'mechanical',
    kind: 'area',
    size: { w: 160, h: 160 },
    fixedSize: true,
    controls: [
      { key: 'outerDia', min: 20, max: 600, def: 160, unit: 'mm' },
      { key: 'innerDia', min: 0, max: 500, def: 70, unit: 'mm' },
      { key: 'holeCount', min: 0, max: 24, def: 6 },
      { key: 'holeDia', min: 2, max: 40, step: 0.5, def: 12, unit: 'mm' },
    ],
    build: (_w, _h, p) => {
      const R = num(p, 'outerDia') / 2, hd = num(p, 'holeDia');
      const ri = Math.max(0, Math.min(num(p, 'innerDia') / 2, R - hd - 4));
      const bc = (R + ri) / 2;
      const out = [circlePath(0, 0, 2 * R)];
      if (ri > 0) out.push(circlePath(0, 0, 2 * ri));
      const n = num(p, 'holeCount');
      if (hd < R - ri - 1)
        for (const i of range(n)) {
          const a = Math.PI / 2 + (i * 2 * Math.PI) / n;
          out.push(circlePath(bc * Math.cos(a), bc * Math.sin(a), hd));
        }
      return out;
    },
  },
  {
    id: 'mount-plate',
    category: 'mechanical',
    kind: 'area',
    size: { w: 160, h: 100 },
    fixedSize: true,
    controls: [
      { key: 'width', min: 20, max: 600, def: 160, unit: 'mm' },
      { key: 'height', min: 20, max: 600, def: 100, unit: 'mm' },
      { key: 'cols', min: 1, max: 8, def: 3 },
      { key: 'rows', min: 1, max: 6, def: 2 },
      { key: 'holeDia', min: 2, max: 30, step: 0.5, def: 8, unit: 'mm' },
      { key: 'edgeDist', min: 3, max: 60, step: 0.5, def: 14, unit: 'mm' },
      { key: 'cornerRadius', min: 0, max: 50, step: 0.5, def: 10, unit: 'mm' },
    ],
    build: (_w, _h, p) => {
      const w = num(p, 'width'), h = num(p, 'height'), hd = num(p, 'holeDia');
      const e = Math.min(num(p, 'edgeDist'), w / 2, h / 2);
      const out = [roundRect(-w / 2, -h / 2, w / 2, h / 2, num(p, 'cornerRadius'))];
      const nc = num(p, 'cols'), nr = num(p, 'rows');
      for (const i of range(nc))
        for (const j of range(nr)) {
          const x = nc === 1 ? 0 : -w / 2 + e + (i * (w - 2 * e)) / (nc - 1);
          const y = nr === 1 ? 0 : -h / 2 + e + (j * (h - 2 * e)) / (nr - 1);
          out.push(circlePath(x, y, hd));
        }
      return out;
    },
  },
  {
    id: 'slot',
    category: 'mechanical',
    kind: 'area',
    size: { w: 70, h: 10 },
    fixedSize: true,
    controls: [
      { key: 'slotLength', min: 0, max: 300, step: 0.5, def: 60, unit: 'mm' },
      { key: 'slotWidth', min: 2, max: 60, step: 0.5, def: 10, unit: 'mm' },
    ],
    build: (_w, _h, p) => {
      const L = num(p, 'slotLength') / 2, wd = num(p, 'slotWidth');
      return [L > 0 ? slotPath(-L, L, 0, wd) : circlePath(0, 0, wd)];
    },
  },
  {
    id: 'keyhole',
    category: 'mechanical',
    kind: 'area',
    size: { w: 10, h: 24 },
    fixedSize: true,
    controls: [
      { key: 'headDia', min: 5, max: 20, step: 0.5, def: 10, unit: 'mm' },
      { key: 'slotWidth', min: 2, max: 10, step: 0.5, def: 5, unit: 'mm' },
      { key: 'slotLength', min: 4, max: 40, step: 0.5, def: 14, unit: 'mm' },
    ],
    build: (_w, _h, p) => {
      const R = num(p, 'headDia') / 2, r = Math.min(num(p, 'slotWidth') / 2, R - 0.5), L = Math.max(num(p, 'slotLength'), R);
      const y0 = Math.sqrt(R * R - r * r), oy = -(L - R) / 2;
      const Q = (x: number, y: number) => P(x, y + oy);
      return [
        {
          id: uid('path'),
          start: Q(r, y0),
          closed: true,
          segments: [
            { type: 'line', to: Q(r, L) },
            { type: 'arc', to: Q(-r, L), center: Q(0, L), clockwise: false },
            { type: 'line', to: Q(-r, y0) },
            { type: 'arc', to: Q(r, y0), center: Q(0, 0), clockwise: false },
          ],
        },
      ];
    },
  },

  /* ───────── Sammanfogning ───────── */
  {
    id: 'finger-box',
    category: 'joinery',
    kind: 'area',
    size: { w: 400, h: 300 },
    fixedSize: true,
    controls: [
      { key: 'length', min: 40, max: 600, def: 120, unit: 'mm' },
      { key: 'width', min: 40, max: 600, def: 80, unit: 'mm' },
      { key: 'height', min: 20, max: 400, def: 40, unit: 'mm' },
      { key: 'fingerWidth', min: 4, max: 60, step: 0.5, def: 10, unit: 'mm' },
      { key: 'thickness', min: 1, max: 25, step: 0.5, def: 6, unit: 'mm' },
      { key: 'lid', options: ['open', 'closed'], def: 'open' },
    ],
    build: (_w, _h, p) => {
      // Lådans yttermått. Långsidorna äger hörnen (fingrar ytterst), kortsidorna
      // och botten har urtag där – så att alla kanter griper i varandra.
      const L = num(p, 'length'), W = num(p, 'width'), H = num(p, 'height');
      const t = Math.min(num(p, 'thickness'), L / 4, W / 4, H / 3);
      const f = num(p, 'fingerWidth'), lid = opt(p, 'lid') === 'closed';
      const panels = fingerBox(L, W, H, t, f, lid);
      // Delarna i två kolumner med 10 mm mellanrum.
      const gap = 10, out: VectorPath[] = [];
      const colW = Math.max(L, W);
      let y = 0;
      const rows: { w: number; h: number; pts: Vec2[] }[][] = [];
      for (let i = 0; i < panels.length; i += 2) rows.push(panels.slice(i, i + 2));
      const totalH = rows.reduce((acc, r) => acc + Math.max(...r.map((q) => q.h)), 0) + gap * (rows.length - 1);
      const totalW = 2 * colW + gap;
      for (const r of rows) {
        const rh = Math.max(...r.map((q) => q.h));
        r.forEach((q, c) => {
          const ox = -totalW / 2 + c * (colW + gap) + (colW - q.w) / 2, oy = totalH / 2 - y - rh + (rh - q.h) / 2;
          out.push(poly(q.pts.map((v) => P(v.x + ox, v.y + oy))));
        });
        y += rh + gap;
      }
      return out;
    },
  },
  {
    id: 'tab-slot',
    category: 'joinery',
    kind: 'area',
    size: { w: 160, h: 130 },
    fixedSize: true,
    controls: [
      { key: 'width', min: 40, max: 600, def: 160, unit: 'mm' },
      { key: 'height', min: 20, max: 300, def: 50, unit: 'mm' },
      { key: 'tabCount', min: 1, max: 6, def: 3 },
      { key: 'tabWidth', min: 5, max: 60, step: 0.5, def: 20, unit: 'mm' },
      { key: 'thickness', min: 1, max: 25, step: 0.5, def: 6, unit: 'mm' },
    ],
    build: (_w, _h, p) => {
      // Överst plattan med tappar (nedåt), under den plattan med matchande slitsar.
      const W = num(p, 'width'), H = num(p, 'height'), t = num(p, 'thickness'), n = num(p, 'tabCount');
      const tw = Math.min(num(p, 'tabWidth'), W / n - 4), gap = 10;
      const y0 = gap / 2 + t; // tapparnas underkant ligger på gap/2
      const cxs = range(n).map((i) => -W / 2 + ((i + 0.5) * W) / n);
      const top: Vec2[] = [P(-W / 2, y0)];
      for (const cx of cxs) top.push(P(cx - tw / 2, y0), P(cx - tw / 2, gap / 2), P(cx + tw / 2, gap / 2), P(cx + tw / 2, y0));
      top.push(P(W / 2, y0), P(W / 2, y0 + H), P(-W / 2, y0 + H));
      const yb = -gap / 2;
      const out = [poly(top), poly([P(-W / 2, yb - H), P(W / 2, yb - H), P(W / 2, yb), P(-W / 2, yb)])];
      const ys = yb - H / 2;
      for (const cx of cxs) out.push(poly([P(cx - tw / 2, ys - t / 2), P(cx + tw / 2, ys - t / 2), P(cx + tw / 2, ys + t / 2), P(cx - tw / 2, ys + t / 2)]));
      return out;
    },
  },

  /* ───────── Mönster ───────── */
  {
    id: 'puzzle',
    category: 'textures',
    kind: 'lines',
    size: { w: 200, h: 140 },
    controls: [
      { key: 'cols', min: 2, max: 20, def: 5 },
      { key: 'rows', min: 2, max: 20, def: 4 },
      { key: 'knob', min: 10, max: 30, def: 20, unit: '%' },
      { key: 'seed', min: 1, max: 99, def: 7 },
    ],
    build: (w, h, p) => {
      const nc = num(p, 'cols'), nr = num(p, 'rows'), cw = w / nc, ch = h / nr, rand = seeded(num(p, 'seed') * 97 + 13);
      const x0 = -w / 2, y0 = -h / 2;
      const out: VectorPath[] = [poly([P(x0, y0), P(x0 + w, y0), P(x0 + w, y0 + h), P(x0, y0 + h)])];
      const edge = (ax: number, ay: number, bx: number, by: number) => {
        const L = Math.hypot(bx - ax, by - ay), dx = (bx - ax) / L, dy = (by - ay) / L;
        const sgn = rand() < 0.5 ? 1 : -1, k = (num(p, 'knob') / 100) * L, m = L / 2;
        const Q = (u: number, v: number) => P(ax + dx * u - dy * v * sgn, ay + dy * u + dx * v * sgn);
        const segs: PathSegment[] = [
          { type: 'line', to: Q(m - k * 0.6, 0) },
          { type: 'cubic', c1: Q(m - k * 0.2, k * 0.2), c2: Q(m - k * 1.1, k * 0.6), to: Q(m - k * 0.9, k * 0.95) },
          { type: 'cubic', c1: Q(m - k * 0.7, k * 1.35), c2: Q(m + k * 0.7, k * 1.35), to: Q(m + k * 0.9, k * 0.95) },
          { type: 'cubic', c1: Q(m + k * 1.1, k * 0.6), c2: Q(m + k * 0.2, k * 0.2), to: Q(m + k * 0.6, 0) },
          { type: 'line', to: Q(L, 0) },
        ];
        out.push({ id: uid('path'), start: Q(0, 0), segments: segs, closed: false });
      };
      for (const i of range(nc - 1)) for (const j of range(nr)) edge(x0 + (i + 1) * cw, y0 + j * ch, x0 + (i + 1) * cw, y0 + (j + 1) * ch);
      for (const j of range(nr - 1)) for (const i of range(nc)) edge(x0 + i * cw, y0 + (j + 1) * ch, x0 + (i + 1) * cw, y0 + (j + 1) * ch);
      return out;
    },
  },
  {
    id: 'vent',
    category: 'textures',
    kind: 'area',
    size: { w: 70, h: 75 },
    fixedSize: true,
    controls: [
      { key: 'slotCount', min: 1, max: 30, def: 8 },
      { key: 'slotWidth', min: 2, max: 20, step: 0.5, def: 5, unit: 'mm' },
      { key: 'slotLength', min: 10, max: 300, def: 70, unit: 'mm' },
      { key: 'gap', min: 2, max: 30, step: 0.5, def: 5, unit: 'mm' },
    ],
    build: (_w, _h, p) => {
      const n = num(p, 'slotCount'), wd = num(p, 'slotWidth'), L = Math.max(num(p, 'slotLength'), wd), g = num(p, 'gap');
      const step = wd + g, tot = n * step - g, half = L / 2 - wd / 2;
      return range(n).map((i) => (half > 0 ? slotPath(-half, half, -tot / 2 + wd / 2 + i * step, wd) : circlePath(0, -tot / 2 + wd / 2 + i * step, wd)));
    },
  },
];

export const DEFAULT_SHAPE_PARAMS: ShapeLibraryParams = { band: 8, spacing: 8 };

/** Bygger ett motiv med mitten i (cx, cy). */
export function buildLibraryShape(item: ShapeLibraryItem, name: string, w: number, h: number, params: ShapeLibraryParams, cx: number, cy: number): VectorShape {
  const move = (q: Vec2) => P(q.x + cx, q.y + cy);
  const values = { ...Object.fromEntries((item.controls ?? []).map((c) => [c.key, c.def])), ...params.values };
  const paths = item.build(w, h, { ...params, values }).map((path) => ({
    ...path,
    id: uid('path'),
    start: move(path.start),
    segments: path.segments.map((sg): PathSegment => {
      if (sg.type === 'line') return { type: 'line', to: move(sg.to) };
      if (sg.type === 'arc') return { ...sg, to: move(sg.to), center: move(sg.center) };
      return { type: 'cubic', c1: move(sg.c1), c2: move(sg.c2), to: move(sg.to) };
    }),
  }));
  return { id: uid('shape'), name, kind: 'imported', paths };
}
