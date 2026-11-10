/**
 * Inbyggt enkellinjigt typsnitt ("desktopCAM Linje") för gravyr med fräs eller
 * laser. Varje tecken ritas med ett streck, så verktyget följer linjen i
 * stället för att skära runt en kontur. Versaler, siffror, ÅÄÖ, ÆØÜ och
 * vanliga skiljetecken. Gemener ritas som mindre versaler (kapitäler).
 *
 * Teckenformat (versalhöjd 10 enheter):
 *   M x y        ny linje
 *   L x y        linje till
 *   E cx cy rx ry a0 a1   elliptisk båge från vinkel a0 till a1 (grader,
 *                         ökande = moturs). Fortsätter linjen från förra punkten.
 */
import { uid } from './geometry';
import { strokeOutline } from './sdf';
import type { PathSegment, Vec2, VectorPath, VectorShape } from './types';

interface Glyph {
  w: number;
  d: string;
}

const A = 'M0 0 L3 10 L6 0 M1.2 4 L4.8 4';
const O = 'E3.5 5 3.5 5 0 360';
const U = 'M0 10 L0 3 E3 3 3 3 180 360 L6 10';

const GLYPHS: Record<string, Glyph> = {
  A: { w: 6, d: A },
  B: { w: 6.3, d: 'M0 0 L0 10 L3.5 10 E3.5 7.5 2.5 2.5 90 -90 L0 5 M3.5 5 E3.5 2.5 2.8 2.5 90 -90 L0 0' },
  C: { w: 6.4, d: 'E3.4 5 3.4 5 50 310' },
  D: { w: 6, d: 'M0 0 L0 10 L2.5 10 E2.5 5 3.5 5 90 -90 L0 0' },
  E: { w: 5.5, d: 'M5.5 10 L0 10 L0 0 L5.5 0 M0 5 L4.2 5' },
  F: { w: 5.5, d: 'M5.5 10 L0 10 L0 0 M0 5 L4.2 5' },
  G: { w: 6.6, d: 'E3.4 5 3.4 5 50 360 L3.8 5' },
  H: { w: 6, d: 'M0 0 L0 10 M6 0 L6 10 M0 5 L6 5' },
  I: { w: 0, d: 'M0 0 L0 10' },
  J: { w: 5, d: 'M5 10 L5 3 E2.5 3 2.5 3 0 -180' },
  K: { w: 6, d: 'M0 0 L0 10 M6 10 L0 3.5 M2.1 5.8 L6 0' },
  L: { w: 5.2, d: 'M0 10 L0 0 L5.2 0' },
  M: { w: 7.2, d: 'M0 0 L0 10 L3.6 3 L7.2 10 L7.2 0' },
  N: { w: 6, d: 'M0 0 L0 10 L6 0 L6 10' },
  O: { w: 7, d: O },
  P: { w: 6, d: 'M0 0 L0 10 L3.3 10 E3.3 7.3 2.7 2.7 90 -90 L0 4.6' },
  Q: { w: 7, d: `${O} M4.3 2.3 L7 -0.6` },
  R: { w: 6, d: 'M0 0 L0 10 L3.3 10 E3.3 7.3 2.7 2.7 90 -90 L0 4.6 M3 4.6 L6 0' },
  S: { w: 6, d: 'E3 7.5 2.9 2.5 20 270 E3 2.5 3 2.5 90 -160' },
  T: { w: 6, d: 'M0 10 L6 10 M3 10 L3 0' },
  U: { w: 6, d: U },
  V: { w: 6, d: 'M0 10 L3 0 L6 10' },
  W: { w: 8.4, d: 'M0 10 L2.1 0 L4.2 7 L6.3 0 L8.4 10' },
  X: { w: 6, d: 'M0 0 L6 10 M0 10 L6 0' },
  Y: { w: 6, d: 'M0 10 L3 5 L6 10 M3 5 L3 0' },
  Z: { w: 6, d: 'M0 10 L6 10 L0 0 L6 0' },
  Å: { w: 6, d: `${A} E3 12.3 1.1 1.1 0 360` },
  Ä: { w: 6, d: `${A} M1.6 12.2 L2.2 12.2 M3.8 12.2 L4.4 12.2` },
  Ö: { w: 7, d: `${O} M2.1 12.2 L2.7 12.2 M4.3 12.2 L4.9 12.2` },
  Ü: { w: 6, d: `${U} M1.6 12.2 L2.2 12.2 M3.8 12.2 L4.4 12.2` },
  Æ: { w: 9, d: 'M0 0 L4.5 10 L9 10 M4.5 10 L4.5 0 L9 0 M4.5 5 L8 5 M1.6 3.5 L4.5 3.5' },
  Ø: { w: 7, d: `${O} M0.4 0 L6.6 10` },
  '0': { w: 6, d: 'E3 5 3 5 0 360' },
  '1': { w: 3, d: 'M0.5 8 L3 10 L3 0' },
  '2': { w: 6, d: 'E3 7 3 3 160 -30 L0 0 L6 0' },
  '3': { w: 6, d: 'M0.5 10 L6 10 L3 6 E3 3 3 3 90 -150' },
  '4': { w: 6.4, d: 'M5 0 L5 10 L0 3 L6.4 3' },
  '5': { w: 6, d: 'M6 10 L1 10 L0.6 5.3 E3 3 3 3 135 -150' },
  '6': { w: 6, d: 'E3 3 3 3 0 360 M0 3 E6 3 6 7 180 105' },
  '7': { w: 6, d: 'M0 10 L6 10 L2 0' },
  '8': { w: 6, d: 'E3 7.6 2.6 2.4 270 630 E3 2.6 3 2.6 90 450' },
  '9': { w: 6, d: 'E3 7 3 3 0 360 M6 7 E0 7 6 7 0 -75' },
  '.': { w: 0.4, d: 'M0 0 L0.4 0' },
  ',': { w: 0.6, d: 'M0.6 0.4 L0 -1.6' },
  ':': { w: 0.4, d: 'M0 0 L0.4 0 M0 6 L0.4 6' },
  ';': { w: 0.6, d: 'M0.6 0.4 L0 -1.6 M0.2 6 L0.6 6' },
  '-': { w: 4, d: 'M0 4 L4 4' },
  '+': { w: 5, d: 'M0 4 L5 4 M2.5 1.5 L2.5 6.5' },
  '=': { w: 5, d: 'M0 3 L5 3 M0 5.5 L5 5.5' },
  '!': { w: 0.4, d: 'M0.2 10 L0.2 3 M0 0 L0.4 0' },
  '?': { w: 5.5, d: 'E2.75 7.25 2.75 2.75 160 -60 L2.75 3 M2.6 0 L3 0' },
  '/': { w: 5, d: 'M0 -1 L5 11' },
  '(': { w: 2.2, d: 'E4.2 5 4.2 6.2 125 235' },
  ')': { w: 2.2, d: 'E-2 5 4.2 6.2 55 -55' },
  "'": { w: 0.4, d: 'M0.2 10 L0.2 7.5' },
  '"': { w: 2, d: 'M0.2 10 L0.2 7.5 M1.8 10 L1.8 7.5' },
  '&': { w: 7, d: 'M7 0 L1.6 6.6 E3 8.2 1.6 1.8 220 -40 L1.2 3.6 E3.2 2.4 2.2 2.4 150 300 L6.6 3.6' },
  '#': { w: 7, d: 'M2.4 0 L3.4 10 M5 0 L6 10 M0.6 3.4 L7 3.4 M1 6.6 L7.4 6.6' },
  '%': { w: 7, d: 'M0 0 L7 10 E1.5 8.5 1.5 1.5 0 360 M7 1.5 E5.5 1.5 1.5 1.5 0 360' },
  '@': { w: 9, d: 'E4.5 5 2 2 0 360 M6.5 5 L6.5 3.4 E7.6 3.4 1.1 1.1 180 360 E4.5 5 4.2 5 -5 300' },
  '°': { w: 3, d: 'E1.5 8.5 1.5 1.5 0 360' },
  '*': { w: 5, d: 'M2.5 3 L2.5 9 M0 7.5 L5 4.5 M0 4.5 L5 7.5' },
};

const SPACE = 4;
const TRACKING = 2;

function parseGlyph(d: string, sx: number, sy: number, ox: number, oy: number): Vec2[][] {
  const tokens = d.trim().split(/\s+/);
  const strokes: Vec2[][] = [];
  let cur: Vec2[] | null = null;
  const P = (x: number, y: number): Vec2 => ({ x: ox + x * sx, y: oy + y * sy });
  for (let i = 0; i < tokens.length; ) {
    const t = tokens[i];
    const c = t[0];
    const nums = (n: number) => {
      const first = t.length > 1 ? [parseFloat(t.slice(1))] : [];
      const rest = tokens.slice(i + 1, i + 1 + n - first.length).map(Number);
      i += 1 + rest.length;
      return [...first, ...rest];
    };
    if (c === 'M') {
      const [x, y] = nums(2);
      cur = [P(x, y)];
      strokes.push(cur);
    } else if (c === 'L') {
      const [x, y] = nums(2);
      cur ??= (strokes.push([]), strokes[strokes.length - 1]);
      cur.push(P(x, y));
    } else if (c === 'E') {
      const [cx, cy, rx, ry, a0, a1] = nums(6);
      if (!cur) {
        cur = [];
        strokes.push(cur);
      }
      const steps = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 10));
      for (let k = 0; k <= steps; k++) {
        const a = ((a0 + ((a1 - a0) * k) / steps) * Math.PI) / 180;
        cur.push(P(cx + rx * Math.cos(a), cy + ry * Math.sin(a)));
      }
    } else i++;
  }
  return strokes.filter((s) => s.length >= 2);
}

export interface TextOptions {
  /** Versalhöjd i mm. */
  height: number;
  /** Extra teckenavstånd i mm. */
  spacing?: number;
  /** Radavstånd som andel av höjden. */
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
  /**
   * Linjebredd i mm. 0 = enkellinje (öppna banor för gravyr). Större än 0 ger
   * slutna konturer runt linjerna så att texten kan fickfräsas, V-graveras
   * och användas för inlägg.
   */
  weight?: number;
}

/** Mått för en textrad i fontenheter. */
function measure(line: string): number {
  let w = 0;
  for (const ch of line) {
    if (ch === ' ') w += SPACE;
    else {
      const small = ch !== ch.toUpperCase();
      const g = GLYPHS[ch.toUpperCase()] ?? GLYPHS['?'];
      w += g.w * (small ? 0.78 : 1) + TRACKING;
    }
  }
  return Math.max(0, w - TRACKING);
}

/** Gör text till en form med öppna banor. (x, y) = vänstra baslinjen på första raden. */
export function textToShape(text: string, x: number, y: number, opts: TextOptions): VectorShape {
  const s = opts.height / 10;
  const extra = (opts.spacing ?? 0) / s;
  const lines = text.split('\n');
  const widest = Math.max(...lines.map(measure));
  const paths: VectorPath[] = [];
  lines.forEach((line, li) => {
    const lineW = measure(line);
    let pen = opts.align === 'center' ? (widest - lineW) / 2 : opts.align === 'right' ? widest - lineW : 0;
    const base = y - li * opts.height * (opts.lineHeight ?? 1.6);
    for (const ch of line) {
      if (ch === ' ') {
        pen += SPACE + extra;
        continue;
      }
      const small = ch !== ch.toUpperCase();
      const k = small ? 0.78 : 1;
      const g = GLYPHS[ch.toUpperCase()] ?? GLYPHS['?'];
      for (const stroke of parseGlyph(g.d, s * k, s * k, x + pen * s, base)) {
        const closed = stroke.length > 3 && Math.hypot(stroke[0].x - stroke[stroke.length - 1].x, stroke[0].y - stroke[stroke.length - 1].y) < 1e-6;
        const pts = closed ? stroke.slice(0, -1) : stroke;
        const segments: PathSegment[] = pts.slice(1).map((to) => ({ type: 'line', to }));
        if (closed) segments.push({ type: 'line', to: pts[0] });
        paths.push({ id: uid('path'), start: pts[0], segments, closed });
      }
      pen += g.w * k + TRACKING + extra;
    }
  });
  const name = text.replace(/\s+/g, ' ').slice(0, 24);
  const weight = opts.weight ?? 0;
  if (weight > 0 && paths.length) {
    const lines = paths.map((pa) => ({
      points: [pa.start, ...pa.segments.map((sg) => sg.to)].slice(0, pa.closed ? -1 : undefined).flatMap((p) => [p.x, p.y]),
      closed: pa.closed,
    }));
    const outline: VectorPath[] = strokeOutline(lines, weight).map((pts) => {
      const ps: Vec2[] = [];
      for (let i = 0; i + 1 < pts.length; i += 2) ps.push({ x: pts[i], y: pts[i + 1] });
      return { id: uid('path'), start: ps[0], segments: [...ps.slice(1), ps[0]].map((to) => ({ type: 'line' as const, to })), closed: true };
    });
    return { id: uid('shape'), name, kind: 'text', paths: outline };
  }
  return { id: uid('shape'), name, kind: 'text', paths };
}

export const SUPPORTED_TEXT_CHARS = Object.keys(GLYPHS).join('');
