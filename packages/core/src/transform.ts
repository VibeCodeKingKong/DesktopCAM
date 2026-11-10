import type { Vec2 } from './types';

/** Affin 2D-matris [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f (samma som SVG). */
export type Mat2D = [number, number, number, number, number, number];

export const IDENTITY: Mat2D = [1, 0, 0, 1, 0, 0];

/** m · n – n tillämpas först, sedan m. */
export function multiply(m: Mat2D, n: Mat2D): Mat2D {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export const translate = (x: number, y: number): Mat2D => [1, 0, 0, 1, x, y];
export const scale = (sx: number, sy = sx): Mat2D => [sx, 0, 0, sy, 0, 0];
export function rotate(deg: number): Mat2D {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
}

export const applyMat = (m: Mat2D, p: Vec2): Vec2 => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });

export const determinant = (m: Mat2D) => m[0] * m[3] - m[1] * m[2];

/** Sant om matrisen bevarar cirklar (likformig skala, rotation, spegling, förflyttning). */
export function isConformal(m: Mat2D): boolean {
  const sx = Math.hypot(m[0], m[1]);
  const sy = Math.hypot(m[2], m[3]);
  const dot = m[0] * m[2] + m[1] * m[3];
  return Math.abs(sx - sy) <= 1e-9 * Math.max(sx, sy, 1) && Math.abs(dot) <= 1e-9 * Math.max(sx * sy, 1);
}

/** Tolkar SVG:s transform-attribut, t.ex. "translate(10 5) rotate(30) scale(2)". */
export function parseTransform(src: string | undefined): Mat2D {
  if (!src) return IDENTITY;
  let m: Mat2D = IDENTITY;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src))) {
    const v = (match[2].match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
    let t: Mat2D = IDENTITY;
    switch (match[1]) {
      case 'matrix':
        if (v.length === 6) t = v as Mat2D;
        break;
      case 'translate':
        t = translate(v[0] ?? 0, v[1] ?? 0);
        break;
      case 'scale':
        t = scale(v[0] ?? 1, v[1] ?? v[0] ?? 1);
        break;
      case 'rotate':
        t = v.length >= 3
          ? multiply(translate(v[1], v[2]), multiply(rotate(v[0]), translate(-v[1], -v[2])))
          : rotate(v[0] ?? 0);
        break;
      case 'skewX':
        t = [1, 0, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
        break;
      case 'skewY':
        t = [1, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
    }
    m = multiply(m, t);
  }
  return m;
}
