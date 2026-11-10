import type { PolylineInput } from './protocol';
import type { Vec2, VectorPath, VectorShape } from './types';

export const uid = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

const TAU = Math.PI * 2;

/** Gör om en vektorbana till en polylinje inom given tolerans (mm). */
export function flattenPath(path: VectorPath, tolerance = 0.05): Vec2[] {
  const pts: Vec2[] = [{ ...path.start }];
  let cur = path.start;

  for (const seg of path.segments) {
    if (seg.type === 'line') {
      pts.push({ ...seg.to });
    } else if (seg.type === 'arc') {
      const r = Math.hypot(cur.x - seg.center.x, cur.y - seg.center.y);
      const a0 = Math.atan2(cur.y - seg.center.y, cur.x - seg.center.x);
      const a1 = Math.atan2(seg.to.y - seg.center.y, seg.to.x - seg.center.x);
      let sweep = a1 - a0;
      if (seg.clockwise) {
        if (sweep >= 0) sweep -= TAU;
      } else if (sweep <= 0) {
        sweep += TAU;
      }
      const maxStep = r > tolerance ? 2 * Math.acos(1 - tolerance / r) : Math.PI / 4;
      const n = Math.max(4, Math.ceil(Math.abs(sweep) / maxStep));
      for (let i = 1; i < n; i++) {
        const a = a0 + (sweep * i) / n;
        pts.push({ x: seg.center.x + r * Math.cos(a), y: seg.center.y + r * Math.sin(a) });
      }
      pts.push({ ...seg.to });
    } else {
      const n = 24;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const u = 1 - t;
        pts.push({
          x: u * u * u * cur.x + 3 * u * u * t * seg.c1.x + 3 * u * t * t * seg.c2.x + t * t * t * seg.to.x,
          y: u * u * u * cur.y + 3 * u * u * t * seg.c1.y + 3 * u * t * t * seg.c2.y + t * t * t * seg.to.y,
        });
      }
    }
    cur = seg.to;
  }

  if (path.closed && pts.length > 2) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-6) pts.pop();
  }
  return pts;
}

export function shapeToPolylines(shape: VectorShape, tolerance = 0.05): PolylineInput[] {
  return shape.paths.map((p) => ({
    points: flattenPath(p, tolerance).flatMap((v) => [v.x, v.y]),
    closed: p.closed,
  }));
}

export function signedArea(pts: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/**
 * Enkel miter-offset av en sluten polygon. Positivt d = utåt.
 * OBS: prototyp. Ersätts av robust offset (Clipper2) i Rust-motorn för
 * konkava former och självkorsningar.
 */
export function offsetPolygon(pts: Vec2[], d: number): Vec2[] {
  const n = pts.length;
  if (n < 3 || Math.abs(d) < 1e-12) return pts.map((p) => ({ ...p }));
  const s = signedArea(pts) >= 0 ? 1 : -1;
  const normal = (a: Vec2, b: Vec2): Vec2 => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.max(Math.hypot(dx, dy), 1e-12);
    return { x: (s * dy) / l, y: (-s * dx) / l };
  };
  return pts.map((cur, i) => {
    const prev = pts[(i + n - 1) % n];
    const next = pts[(i + 1) % n];
    const n1 = normal(prev, cur);
    const n2 = normal(cur, next);
    const bx = n1.x + n2.x;
    const by = n1.y + n2.y;
    const bl = Math.hypot(bx, by);
    const u = bl < 1e-9 ? n1 : { x: bx / bl, y: by / bl };
    const cosHalf = Math.max(u.x * n1.x + u.y * n1.y, 0.25);
    const k = d / cosHalf;
    return { x: cur.x + u.x * k, y: cur.y + u.y * k };
  });
}

/* ───────── Formfabriker (används av Design-fliken och demo-projektet) ───────── */

export function makeRect(name: string, x: number, y: number, w: number, h: number): VectorShape {
  return {
    id: uid('shape'),
    name,
    kind: 'rect',
    paths: [
      {
        id: uid('path'),
        start: { x, y },
        segments: [
          { type: 'line', to: { x: x + w, y } },
          { type: 'line', to: { x: x + w, y: y + h } },
          { type: 'line', to: { x, y: y + h } },
          { type: 'line', to: { x, y } },
        ],
        closed: true,
      },
    ],
  };
}

export function makeCircle(name: string, cx: number, cy: number, r: number): VectorShape {
  return {
    id: uid('shape'),
    name,
    kind: 'circle',
    paths: [
      {
        id: uid('path'),
        start: { x: cx + r, y: cy },
        segments: [
          { type: 'arc', to: { x: cx - r, y: cy }, center: { x: cx, y: cy }, clockwise: false },
          { type: 'arc', to: { x: cx + r, y: cy }, center: { x: cx, y: cy }, clockwise: false },
        ],
        closed: true,
      },
    ],
  };
}

export function makeGear(name: string, cx: number, cy: number, rOuter: number, rRoot: number, teeth: number): VectorShape {
  const pts: Vec2[] = [];
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const at = (f: number, r: number) => ({ x: cx + r * Math.cos(a + f * step), y: cy + r * Math.sin(a + f * step) });
    pts.push(at(0, rRoot), at(0.18, rOuter), at(0.45, rOuter), at(0.63, rRoot));
  }
  const [start, ...rest] = pts;
  return {
    id: uid('shape'),
    name,
    kind: 'polygon',
    paths: [
      {
        id: uid('path'),
        start,
        segments: [...rest, start].map((to) => ({ type: 'line' as const, to })),
        closed: true,
      },
    ],
  };
}

export type GearToothShape = 'trapezoid' | 'triangle' | 'rounded' | 'involute';

export interface GearOptions {
  teeth: number;
  /** Ytterdiameter (topp till topp), mm. */
  outerDiameter: number;
  /** Kuggdjup, mm. Ignoreras för evolvent (räknas från modulen). */
  toothDepth: number;
  shape: GearToothShape;
  /** Ingreppsvinkel för evolvent (grader), normalt 20. */
  pressureAngle?: number;
  /** Hål i mitten (diameter, mm). 0 = inget hål. */
  boreDiameter?: number;
}

/** Evolventkugghjul enligt standardproportioner: topp = 1·m, fot = 1,25·m. */
function involuteOutline(teeth: number, outerDiameter: number, pressureDeg: number): { pts: Vec2[]; module: number } {
  const z = teeth;
  const m = outerDiameter / (z + 2);
  const rp = (m * z) / 2;
  const ra = rp + m;
  const rf = Math.max(rp - 1.25 * m, m * 0.5);
  const alpha = (pressureDeg * Math.PI) / 180;
  const rb = rp * Math.cos(alpha);
  const inv = (r: number) => {
    const b = Math.acos(Math.min(1, rb / r));
    return Math.tan(b) - b;
  };
  const invA = Math.tan(alpha) - alpha;
  const psi = Math.PI / (2 * z);
  const r0 = Math.max(rb, rf);
  const N = 10;
  const pts: Vec2[] = [];
  const polar = (r: number, a: number) => ({ x: r * Math.cos(a), y: r * Math.sin(a) });
  for (let i = 0; i < z; i++) {
    const th = (i * TAU) / z;
    const sideB = (r: number) => th - psi - invA + inv(r);
    const sideA = (r: number) => th + psi + invA - inv(r);
    // Fot → evolventens början (radiell linje om grundcirkeln ligger över foten)
    pts.push(polar(rf, sideB(r0)));
    for (let k = 0; k <= N; k++) {
      const r = r0 + ((ra - r0) * k) / N;
      pts.push(polar(r, sideB(r)));
    }
    const tipA = sideA(ra);
    const tipB = sideB(ra);
    if (tipA > tipB) for (let k = 1; k < 4; k++) pts.push(polar(ra, tipB + ((tipA - tipB) * k) / 4));
    for (let k = N; k >= 0; k--) {
      const r = r0 + ((ra - r0) * k) / N;
      pts.push(polar(r, sideA(r)));
    }
    pts.push(polar(rf, sideA(r0)));
    // Fotcirkel fram till nästa kugge
    const next = th + TAU / z - psi - invA + inv(r0);
    const from = sideA(r0);
    for (let k = 1; k < 4; k++) pts.push(polar(rf, from + ((next - from) * k) / 4));
  }
  return { pts, module: m };
}

/** Kugghjul med valbar kuggform. Mitten i (cx, cy). */
export function makeGearShape(name: string, cx: number, cy: number, o: GearOptions): VectorShape {
  const z = Math.max(3, Math.round(o.teeth));
  const rOuter = o.outerDiameter / 2;
  const rRoot = Math.max(rOuter * 0.2, rOuter - Math.max(0.1, o.toothDepth));
  const step = TAU / z;
  let pts: Vec2[] = [];
  if (o.shape === 'involute') {
    pts = involuteOutline(z, o.outerDiameter, o.pressureAngle ?? 20).pts.map((p) => ({ x: p.x + cx, y: p.y + cy }));
  } else if (o.shape === 'rounded') {
    const n = z * 24;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      // Platt topp och botten med mjuka flanker
      const c = Math.cos(a * z);
      const s = Math.max(-1, Math.min(1, c * 1.6));
      const r = rRoot + ((rOuter - rRoot) * (s + 1)) / 2;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  } else {
    const prof: [number, number][] = o.shape === 'triangle' ? [[0, rRoot], [0.5, rOuter]] : [[0, rRoot], [0.18, rOuter], [0.45, rOuter], [0.63, rRoot]];
    for (let i = 0; i < z; i++) {
      for (const [f, r] of prof) {
        const a = (i + f) * step;
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
    }
  }
  const toPath = (p: Vec2[]): VectorPath => ({
    id: uid('path'),
    start: p[0],
    segments: [...p.slice(1), p[0]].map((to) => ({ type: 'line' as const, to })),
    closed: true,
  });
  const paths = [toPath(pts)];
  const bore = o.boreDiameter ?? 0;
  if (bore > 0 && bore / 2 < rRoot * 0.95) {
    const c = makeCircle('', cx, cy, bore / 2);
    paths.push(...c.paths);
  }
  return { id: uid('shape'), name, kind: 'polygon', paths };
}

/** Modul för ett evolventhjul med given ytterdiameter (för visning). */
export const gearModule = (teeth: number, outerDiameter: number) => outerDiameter / (Math.max(3, teeth) + 2);
