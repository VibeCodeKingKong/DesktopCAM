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
