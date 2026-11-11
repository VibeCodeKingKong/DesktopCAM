/**
 * Text i kontur-typsnitt → slutna konturer.
 *
 * Typsnittens konturer får överlappa (variabla typsnitt, skrivstil där
 * bokstäverna går i varandra) och hål känns igen på sin riktning. Fräsningen
 * fyller däremot med jämn–udda-regeln, så konturerna slås ihop till enkla,
 * icke-överlappande ytor med polyclip-ts (MIT) innan de blir en form.
 */
import { uid, type PathSegment, type VectorPath, type VectorShape } from '@desktopcam/core';
import type { Font, Glyph, PathCommand } from 'opentype.js';
import { difference, union, type Geom } from 'polyclip-ts';
import type { LoadedFont } from './fonts';

type Ring = [number, number][];
type MultiPoly = Ring[][];

export interface FontTextOptions {
  /** Versalhöjd i mm. */
  height: number;
  /** Extra teckenavstånd i mm. */
  spacing?: number;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
}

/** Glyfens konturer i typsnittsenheter (y uppåt), med kurvor uppdelade i linjer. */
function glyphRings(glyph: Glyph, font: Font, unitTol: number): Ring[] {
  const cmds: PathCommand[] = glyph.getPath(0, 0, font.unitsPerEm).commands;
  const rings: Ring[] = [];
  let ring: Ring = [];
  let cx = 0, cy = 0;
  const push = (x: number, y: number) => {
    const last = ring[ring.length - 1];
    if (!last || Math.abs(last[0] - x) > 1e-9 || Math.abs(last[1] + y) > 1e-9) ring.push([x, -y]);
    cx = x;
    cy = y;
  };
  const steps = (len: number) => Math.max(2, Math.min(24, Math.ceil(Math.sqrt(len / unitTol))));
  for (const c of cmds) {
    if (c.type === 'M') {
      if (ring.length > 2) rings.push(ring);
      ring = [];
      push(c.x!, c.y!);
    } else if (c.type === 'L') push(c.x!, c.y!);
    else if (c.type === 'Q') {
      const x0 = cx, y0 = cy;
      const n = steps(Math.hypot(c.x1! - x0, c.y1! - y0) + Math.hypot(c.x! - c.x1!, c.y! - c.y1!));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        push(u * u * x0 + 2 * u * t * c.x1! + t * t * c.x!, u * u * y0 + 2 * u * t * c.y1! + t * t * c.y!);
      }
    } else if (c.type === 'C') {
      const x0 = cx, y0 = cy;
      const n = steps(Math.hypot(c.x1! - x0, c.y1! - y0) + Math.hypot(c.x2! - c.x1!, c.y2! - c.y1!) + Math.hypot(c.x! - c.x2!, c.y! - c.y2!));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        push(
          u * u * u * x0 + 3 * u * u * t * c.x1! + 3 * u * t * t * c.x2! + t * t * t * c.x!,
          u * u * u * y0 + 3 * u * u * t * c.y1! + 3 * u * t * t * c.y2! + t * t * t * c.y!,
        );
      }
    } else if (c.type === 'Z') {
      if (ring.length > 2) rings.push(ring);
      ring = [];
    }
  }
  if (ring.length > 2) rings.push(ring);
  return rings;
}

const signedArea = (r: Ring) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return a / 2;
};

/**
 * En glyfs yta: konturer med samma riktning som den största fyller, de med
 * motsatt riktning är hål. Överlappande konturer slås ihop (nonzero-regeln).
 */
function glyphArea(rings: Ring[]): MultiPoly {
  if (!rings.length) return [];
  const areas = rings.map(signedArea);
  let big = 0;
  areas.forEach((a, i) => Math.abs(a) > Math.abs(areas[big]) && (big = i));
  const sign = Math.sign(areas[big]);
  const fill = rings.filter((_, i) => Math.sign(areas[i]) === sign).map((r) => [r] as Ring[]);
  const holes = rings.filter((_, i) => Math.sign(areas[i]) !== sign).map((r) => [r] as Ring[]);
  const solid = union(fill[0], ...fill.slice(1));
  return holes.length ? difference(solid, ...holes) : solid;
}

/** Glyfen för ett tecken: första delmängden som har det, annars "?". */
function glyphFor(f: LoadedFont, ch: string): { font: Font; glyph: Glyph } {
  for (const font of f.faces) if (font.charToGlyphIndex(ch) > 0) return { font, glyph: font.charToGlyph(ch) };
  const font = f.faces[0];
  return { font, glyph: font.charToGlyph('?') };
}

/** Versalhöjden i typsnittsenheter. */
function capHeight(font: Font): number {
  const c = font.tables.os2?.sCapHeight;
  if (c && c > 0) return c;
  let max = 0;
  for (const r of glyphRings(font.charToGlyph('H'), font, 10)) for (const p of r) max = Math.max(max, p[1]);
  return max || font.unitsPerEm * 0.7;
}

/** Bygger text i ett kontur-typsnitt. (x, y) = vänstra baslinjen på första raden. */
export function fontTextToShape(f: LoadedFont, text: string, x: number, y: number, opts: FontTextOptions): VectorShape {
  const main = f.faces[0];
  const scale = opts.height / capHeight(main); // mm per typsnittsenhet
  const spacing = opts.spacing ?? 0;
  const tol = 0.02 / scale; // ca 0,02 mm noggrannhet i kurvorna
  const lines = text.split('\n');

  // Placera glyferna rad för rad.
  type Placed = { rings: Ring[]; dx: number };
  const placedLines: { glyphs: Placed[]; width: number }[] = lines.map((line) => {
    const glyphs: Placed[] = [];
    let pen = 0;
    let prev: { font: Font; glyph: Glyph } | null = null;
    for (const ch of line) {
      const g = glyphFor(f, ch);
      if (prev && prev.font === g.font) pen += g.font.getKerningValue(prev.glyph, g.glyph) * scale;
      if (ch.trim()) glyphs.push({ rings: glyphRings(g.glyph, g.font, tol), dx: pen });
      pen += (g.glyph.advanceWidth ?? g.font.unitsPerEm * 0.5) * scale + spacing;
      prev = g;
    }
    return { glyphs, width: Math.max(0, pen - spacing) };
  });
  const widest = Math.max(0, ...placedLines.map((l) => l.width));

  const parts: MultiPoly[] = [];
  placedLines.forEach((line, li) => {
    const off = opts.align === 'center' ? (widest - line.width) / 2 : opts.align === 'right' ? widest - line.width : 0;
    const base = y - li * opts.height * (opts.lineHeight ?? 1.6);
    for (const g of line.glyphs) {
      const rings = g.rings.map((r) => r.map(([u, v]) => [x + off + g.dx + u * scale, base + v * scale] as [number, number]));
      const area = glyphArea(rings);
      if (area.length) parts.push(area);
    }
  });

  const merged: MultiPoly = parts.length ? union(parts[0] as Geom, ...(parts.slice(1) as Geom[])) : [];
  const paths: VectorPath[] = [];
  for (const poly of merged) {
    for (const ring of poly) {
      const pts = ring.slice(0, ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? -1 : undefined);
      if (pts.length < 3) continue;
      const segments: PathSegment[] = [...pts.slice(1), pts[0]].map(([px, py]) => ({ type: 'line', to: { x: px, y: py } }));
      paths.push({ id: uid('path'), start: { x: pts[0][0], y: pts[0][1] }, segments, closed: true });
    }
  }
  return { id: uid('shape'), name: text.replace(/\s+/g, ' ').slice(0, 24), kind: 'text', paths };
}
