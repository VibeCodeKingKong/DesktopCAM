/** Träffytor för former: avstånd till linjer och "inuti" för slutna former. */
import { shapeToPolylines, type Vec2, type VectorLayer, type VectorShape } from '@desktopcam/core';

interface Cached {
  polys: { points: number[]; closed: boolean }[];
  min: Vec2;
  max: Vec2;
}

const cache = new WeakMap<VectorShape, Cached>();

export function shapeGeometry(shape: VectorShape): Cached {
  let c = cache.get(shape);
  if (!c) {
    const polys = shapeToPolylines(shape, 0.1);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of polys) {
      for (let i = 0; i + 1 < p.points.length; i += 2) {
        minX = Math.min(minX, p.points[i]); maxX = Math.max(maxX, p.points[i]);
        minY = Math.min(minY, p.points[i + 1]); maxY = Math.max(maxY, p.points[i + 1]);
      }
    }
    c = { polys, min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
    cache.set(shape, c);
  }
  return c;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function inside(points: number[], x: number, y: number) {
  let c = false;
  const n = points.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[2 * i], yi = points[2 * i + 1], xj = points[2 * j], yj = points[2 * j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Formen närmast punkten (inom tol), annars den minsta slutna formen som innehåller den. */
export function hitShape(layers: VectorLayer[], p: Vec2, tol: number): string | null {
  let bestId: string | null = null;
  let bestDist = tol;
  let insideId: string | null = null;
  let insideArea = Infinity;
  for (const layer of layers) {
    if (!layer.visible || layer.locked) continue;
    for (const shape of layer.shapes) {
      const g = shapeGeometry(shape);
      if (p.x < g.min.x - tol || p.x > g.max.x + tol || p.y < g.min.y - tol || p.y > g.max.y + tol) continue;
      let isInside = false;
      for (const poly of g.polys) {
        const pts = poly.points;
        const n = pts.length / 2;
        const segs = poly.closed ? n : n - 1;
        for (let k = 0; k < segs; k++) {
          const a = 2 * k, b = 2 * ((k + 1) % n);
          const d = segDist(p.x, p.y, pts[a], pts[a + 1], pts[b], pts[b + 1]);
          if (d < bestDist) {
            bestDist = d;
            bestId = shape.id;
          }
        }
        if (poly.closed && inside(pts, p.x, p.y)) isInside = !isInside;
      }
      if (isInside) {
        const area = (g.max.x - g.min.x) * (g.max.y - g.min.y);
        if (area < insideArea) {
          insideArea = area;
          insideId = shape.id;
        }
      }
    }
  }
  return bestId ?? insideId;
}
