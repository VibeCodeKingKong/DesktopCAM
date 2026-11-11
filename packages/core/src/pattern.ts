/**
 * Linjära och cirkulära mönster: transformationer för kopior av en markering,
 * t.ex. en rad hål eller hål på en bultcirkel. Originalet räknas som första
 * elementet och ingår inte i listan.
 */
import { multiply, rotate, translate, type Mat2D } from './transform';
import type { Bounds2D } from './pathOps';

export interface LinearPattern {
  kind: 'linear';
  countX: number;
  countY: number;
  /** Avstånd i X och Y. */
  spacingX: number;
  spacingY: number;
  /** center: mellan mittpunkterna. gap: fritt mellanrum mellan kopiorna. */
  spacingMode: 'center' | 'gap';
}

export interface CircularPattern {
  kind: 'circular';
  count: number;
  /** Mittpunkt som kopiorna fördelas runt (mm). */
  cx: number;
  cy: number;
  /** Vinkel som kopiorna fördelas över; 360 = hela varvet jämnt. */
  totalAngle: number;
  /** Vrid kopiorna med (som ekrar) eller behåll deras riktning. */
  rotateCopies: boolean;
}

export type PatternConfig = LinearPattern | CircularPattern;

/** Transformationer för kopiorna (utan originalet). */
export function patternTransforms(p: PatternConfig, b: Bounds2D): Mat2D[] {
  const out: Mat2D[] = [];
  if (p.kind === 'linear') {
    const w = b.max.x - b.min.x, h = b.max.y - b.min.y;
    const sx = p.spacingMode === 'gap' ? w + p.spacingX : p.spacingX;
    const sy = p.spacingMode === 'gap' ? h + p.spacingY : p.spacingY;
    for (let j = 0; j < Math.max(1, Math.round(p.countY)); j++) {
      for (let i = 0; i < Math.max(1, Math.round(p.countX)); i++) {
        if (i || j) out.push(translate(i * sx, j * sy));
      }
    }
    return out;
  }
  const n = Math.max(1, Math.round(p.count));
  const full = Math.abs(Math.abs(p.totalAngle) - 360) < 1e-6;
  const step = n <= 1 ? 0 : full ? p.totalAngle / n : p.totalAngle / (n - 1);
  const mx = (b.min.x + b.max.x) / 2, my = (b.min.y + b.max.y) / 2;
  for (let k = 1; k < n; k++) {
    const a = step * k;
    const around = multiply(translate(p.cx, p.cy), multiply(rotate(a), translate(-p.cx, -p.cy)));
    if (p.rotateCopies) out.push(around);
    else {
      // Flytta mittpunkten längs cirkeln men behåll riktningen.
      const r = (a * Math.PI) / 180;
      const x = p.cx + (mx - p.cx) * Math.cos(r) - (my - p.cy) * Math.sin(r);
      const y = p.cy + (mx - p.cx) * Math.sin(r) + (my - p.cy) * Math.cos(r);
      out.push(translate(x - mx, y - my));
    }
  }
  return out;
}
