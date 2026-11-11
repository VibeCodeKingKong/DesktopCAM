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

export type ShapeLibraryCategory = 'frames' | 'banners' | 'ornaments' | 'textures';

export interface ShapeLibraryParams {
  /** Ramens bredd (mm). */
  band: number;
  /** Avstånd mellan linjer eller celler (mm). */
  spacing: number;
}

export interface ShapeLibraryItem {
  id: string;
  category: ShapeLibraryCategory;
  /** 'area' = slutna ytor (ficka, V-gravyr, inlägg). 'lines' = linjer att gravera längs. 'holes' = cirklar för borrning. */
  kind: 'area' | 'lines' | 'holes';
  size: { w: number; h: number };
  /** Vilken extra inställning motivet har. */
  param?: keyof ShapeLibraryParams;
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

const range = (n: number) => Array.from({ length: Math.max(0, n) }, (_, i) => i);

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
    category: 'ornaments',
    kind: 'area',
    size: { w: 80, h: 80 },
    build: (w, h) => {
      const pts = range(10).map((i) => {
        const a = Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 0.4 : 1;
        return P(Math.cos(a) * r * (w / 2), Math.sin(a) * r * (h / 2) - h * 0.05);
      });
      return [poly(pts)];
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
];

export const DEFAULT_SHAPE_PARAMS: ShapeLibraryParams = { band: 8, spacing: 8 };

/** Bygger ett motiv med mitten i (cx, cy). */
export function buildLibraryShape(item: ShapeLibraryItem, name: string, w: number, h: number, params: ShapeLibraryParams, cx: number, cy: number): VectorShape {
  const move = (q: Vec2) => P(q.x + cx, q.y + cy);
  const paths = item.build(w, h, params).map((path) => ({
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
