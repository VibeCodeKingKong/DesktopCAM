/**
 * Operationer på vektorbanor: transformera, vända, sammanfoga och mäta.
 * Används av SVG/DXF-importen och när importerade former placeras.
 */
import { filletPaths, flattenPath, uid } from './geometry';
import { applyMat, determinant, isConformal, type Mat2D } from './transform';
import type { PathSegment, Vec2, VectorPath, VectorShape } from './types';

const TAU = Math.PI * 2;

/** Gör om en cirkelbåge till kubiska Bézierkurvor (högst 90° per kurva). */
export function arcToCubics(from: Vec2, seg: Extract<PathSegment, { type: 'arc' }>): PathSegment[] {
  const { center: c } = seg;
  const r = Math.hypot(from.x - c.x, from.y - c.y);
  const a0 = Math.atan2(from.y - c.y, from.x - c.x);
  const a1 = Math.atan2(seg.to.y - c.y, seg.to.x - c.x);
  let sweep = a1 - a0;
  if (seg.clockwise) {
    if (sweep >= 0) sweep -= TAU;
  } else if (sweep <= 0) sweep += TAU;
  const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
  const step = sweep / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const out: PathSegment[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = a0 + step * i;
    const t1 = t0 + step;
    const p0 = { x: c.x + r * Math.cos(t0), y: c.y + r * Math.sin(t0) };
    const p1 = i === n - 1 ? seg.to : { x: c.x + r * Math.cos(t1), y: c.y + r * Math.sin(t1) };
    out.push({
      type: 'cubic',
      c1: { x: p0.x - k * r * Math.sin(t0), y: p0.y + k * r * Math.cos(t0) },
      c2: { x: p1.x + k * r * Math.sin(t1), y: p1.y - k * r * Math.cos(t1) },
      to: { ...p1 },
    });
  }
  return out;
}

export function transformPath(path: VectorPath, m: Mat2D): VectorPath {
  const conformal = isConformal(m);
  const mirrored = determinant(m) < 0;
  const segments: PathSegment[] = [];
  let cur = path.start;
  for (const seg of path.segments) {
    if (seg.type === 'line') segments.push({ type: 'line', to: applyMat(m, seg.to) });
    else if (seg.type === 'cubic') segments.push({ type: 'cubic', c1: applyMat(m, seg.c1), c2: applyMat(m, seg.c2), to: applyMat(m, seg.to) });
    else if (conformal) segments.push({ type: 'arc', to: applyMat(m, seg.to), center: applyMat(m, seg.center), clockwise: seg.clockwise !== mirrored });
    else for (const cub of arcToCubics(cur, seg)) segments.push(transformPath({ id: '', start: cur, segments: [cub], closed: false }, m).segments[0]);
    cur = seg.to;
  }
  return { ...path, start: applyMat(m, path.start), segments };
}

export const transformShape = (shape: VectorShape, m: Mat2D): VectorShape => {
  if (shape.corner) {
    // Avrundade hörn: flytta/skala de skarpa banorna och avrunda igen. Radien
    // behålls (som i CAD), även när formen ändrar storlek.
    const base = shape.corner.base.map((p) => transformPath(p, m));
    const { radius, radii } = shape.corner;
    return { ...shape, paths: filletPaths(base, radius, radii), corner: { radius, base, radii } };
  }
  return { ...shape, paths: shape.paths.map((p) => transformPath(p, m)) };
};

export function endPoint(path: VectorPath): Vec2 {
  return path.segments.length ? path.segments[path.segments.length - 1].to : path.start;
}

export function reversePath(path: VectorPath): VectorPath {
  const froms: Vec2[] = [path.start, ...path.segments.map((s) => s.to)];
  const segments: PathSegment[] = [];
  for (let i = path.segments.length - 1; i >= 0; i--) {
    const seg = path.segments[i];
    const to = froms[i];
    if (seg.type === 'line') segments.push({ type: 'line', to });
    else if (seg.type === 'cubic') segments.push({ type: 'cubic', c1: seg.c2, c2: seg.c1, to });
    else segments.push({ type: 'arc', to, center: seg.center, clockwise: !seg.clockwise });
  }
  return { ...path, start: endPoint(path), segments };
}

const near = (a: Vec2, b: Vec2, tol: number) => Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;

/** Sätter slutpunkten exakt på p så att sammanfogade banor sluter tätt. */
function snapEnd(path: VectorPath, p: Vec2) {
  const last = path.segments[path.segments.length - 1];
  if (last) last.to = { ...p };
}

/**
 * Sammanfogar öppna banor vars ändpunkter möts inom toleransen till längre
 * kedjor och sluter dem när start och slut möts. Vanligt för DXF där varje
 * linje och båge är ett eget objekt.
 */
export function joinPaths(paths: VectorPath[], tol = 0.01): VectorPath[] {
  const done: VectorPath[] = [];
  const open: VectorPath[] = [];
  for (const p of paths) {
    if (p.closed || !p.segments.length) done.push(p);
    else if (near(p.start, endPoint(p), tol) && p.segments.length > 1) {
      snapEnd(p, p.start);
      done.push({ ...p, closed: true });
    } else open.push({ ...p, segments: [...p.segments] });
  }

  const used = new Uint8Array(open.length);
  for (let i = 0; i < open.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    let chain = open[i];
    let grew = true;
    while (grew) {
      grew = false;
      for (let j = 0; j < open.length; j++) {
        if (used[j]) continue;
        const other = open[j];
        const end = endPoint(chain);
        let next: VectorPath | null = null;
        let prepend = false;
        if (near(end, other.start, tol)) next = other;
        else if (near(end, endPoint(other), tol)) next = reversePath(other);
        else if (near(chain.start, endPoint(other), tol)) { next = other; prepend = true; }
        else if (near(chain.start, other.start, tol)) { next = reversePath(other); prepend = true; }
        if (!next) continue;
        used[j] = 1;
        grew = true;
        if (prepend) {
          snapEnd(next, chain.start);
          chain = { ...chain, start: next.start, segments: [...next.segments, ...chain.segments] };
        } else {
          chain = { ...chain, segments: [...chain.segments, ...next.segments] };
        }
      }
      if (near(chain.start, endPoint(chain), tol) && chain.segments.length > 1) {
        snapEnd(chain, chain.start);
        chain = { ...chain, closed: true };
        break;
      }
    }
    done.push(chain);
  }
  return done;
}

export interface Bounds2D {
  min: Vec2;
  max: Vec2;
}

export function pathsBounds(paths: VectorPath[], tolerance = 0.1): Bounds2D | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) {
    for (const v of flattenPath(p, tolerance)) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }
  }
  return Number.isFinite(minX) ? { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } } : null;
}

export function shapesBounds(shapes: VectorShape[]): Bounds2D | null {
  return pathsBounds(shapes.flatMap((s) => s.paths));
}

/** Gör om en lista banor till former: slutna och längre kedjor får egna namn. */
export function pathsToShapes(paths: VectorPath[], prefix: string): VectorShape[] {
  return paths.map((p, i) => ({
    id: uid('shape'),
    name: `${prefix} ${i + 1}`,
    kind: 'imported' as const,
    paths: [p],
  }));
}
