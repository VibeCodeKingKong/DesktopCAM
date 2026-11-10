/**
 * Nodredigering. En bana har noder (ankarpunkter) och, för kurvsegment,
 * handtag. Index 0 = path.start, index i = segments[i − 1].to. Slutna banor
 * normaliseras så att sista segmentet uttryckligen går tillbaka till start;
 * den dubblerade slutpunkten räknas inte som en egen nod.
 */
import { arcToCubics, type PathSegment, type Vec2, type VectorPath, type VectorShape } from '@desktopcam/core';

const near = (a: Vec2, b: Vec2, tol = 1e-6) => Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
const add = (a: Vec2, d: Vec2): Vec2 => ({ x: a.x + d.x, y: a.y + d.y });
const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Bågar → kurvor och uttrycklig stängning, så att alla noder kan dras fritt. */
export function normalizePath(path: VectorPath): VectorPath {
  const segments: PathSegment[] = [];
  let cur = path.start;
  for (const seg of path.segments) {
    if (seg.type === 'arc') segments.push(...arcToCubics(cur, seg));
    else segments.push({ ...seg });
    cur = seg.to;
  }
  if (path.closed && segments.length && !near(segments[segments.length - 1].to, path.start, 1e-4)) {
    segments.push({ type: 'line', to: { ...path.start } });
  }
  return { ...path, start: { ...path.start }, segments };
}

export function normalizeShape(shape: VectorShape): VectorShape {
  const needs = shape.paths.some((p) => p.segments.some((s) => s.type === 'arc'));
  const kind = shape.kind === 'rect' || shape.kind === 'circle' ? (needs ? 'bezier' : 'polygon') : shape.kind;
  return { ...shape, kind, text: undefined, corner: undefined, paths: shape.paths.map(normalizePath) };
}

/** Antal noder (för sluten bana utan den dubblerade slutpunkten). */
export function nodeCount(path: VectorPath): number {
  const n = path.segments.length + 1;
  return path.closed && path.segments.length && near(path.segments[path.segments.length - 1].to, path.start, 1e-4) ? n - 1 : n;
}

export function getNode(path: VectorPath, i: number): Vec2 {
  return i === 0 ? path.start : path.segments[i - 1].to;
}

/** Segmentindex som slutar i nod i, respektive börjar i nod i. */
function segIn(path: VectorPath, i: number): number | null {
  if (i > 0) return i - 1;
  return path.closed ? path.segments.length - 1 : null;
}
function segOut(path: VectorPath, i: number): number | null {
  return i < path.segments.length ? i : null;
}

export interface Handle {
  segment: number;
  which: 'c1' | 'c2';
  pos: Vec2;
  anchor: Vec2;
}

/** Kurvhandtagen som hör till nod i. */
export function handlesOf(path: VectorPath, i: number): Handle[] {
  const out: Handle[] = [];
  const anchor = getNode(path, i);
  const a = segIn(path, i);
  const b = segOut(path, i);
  if (a !== null && path.segments[a]?.type === 'cubic') out.push({ segment: a, which: 'c2', pos: (path.segments[a] as Extract<PathSegment, { type: 'cubic' }>).c2, anchor });
  if (b !== null && path.segments[b]?.type === 'cubic') out.push({ segment: b, which: 'c1', pos: (path.segments[b] as Extract<PathSegment, { type: 'cubic' }>).c1, anchor });
  return out;
}

/** Flyttar nod i till p; tillhörande handtag följer med. */
export function moveNode(path: VectorPath, i: number, p: Vec2): VectorPath {
  const old = getNode(path, i);
  const d = { x: p.x - old.x, y: p.y - old.y };
  const segments = path.segments.map((s) => ({ ...s })) as PathSegment[];
  let start = path.start;
  if (i === 0) {
    start = { ...p };
    if (path.closed && segments.length) segments[segments.length - 1] = { ...segments[segments.length - 1], to: { ...p } };
  } else segments[i - 1] = { ...segments[i - 1], to: { ...p } };
  const a = segIn(path, i);
  const b = segOut(path, i);
  if (a !== null) {
    const s = segments[a];
    if (s.type === 'cubic') segments[a] = { ...s, c2: add(s.c2, d) };
  }
  if (b !== null) {
    const s = segments[b];
    if (s.type === 'cubic') segments[b] = { ...s, c1: add(s.c1, d) };
  }
  return { ...path, start, segments };
}

export function moveHandle(path: VectorPath, segment: number, which: 'c1' | 'c2', p: Vec2): VectorPath {
  const segments = path.segments.map((s, k) => (k === segment && s.type === 'cubic' ? { ...s, [which]: { ...p } } : s)) as PathSegment[];
  return { ...path, segments };
}

/** Delar segmentet vid parametern t och lägger till en nod. */
export function insertNode(path: VectorPath, segment: number, t: number): VectorPath {
  const from = segment === 0 ? path.start : path.segments[segment - 1].to;
  const s = path.segments[segment];
  const segments = [...path.segments];
  if (s.type === 'cubic') {
    const p01 = lerp(from, s.c1, t), p12 = lerp(s.c1, s.c2, t), p23 = lerp(s.c2, s.to, t);
    const p012 = lerp(p01, p12, t), p123 = lerp(p12, p23, t);
    const mid = lerp(p012, p123, t);
    segments.splice(segment, 1, { type: 'cubic', c1: p01, c2: p012, to: mid }, { type: 'cubic', c1: p123, c2: p23, to: s.to });
  } else {
    segments.splice(segment, 1, { type: 'line', to: lerp(from, s.to, t) }, { type: 'line', to: s.to });
  }
  return { ...path, segments };
}

/** Tar bort nod i. Returnerar null om banan skulle bli för kort. */
export function deleteNode(path: VectorPath, i: number): VectorPath | null {
  const n = nodeCount(path);
  if (n <= (path.closed ? 3 : 2)) return null;
  const segs = path.segments;
  if (!path.closed && i === 0) return { ...path, start: segs[0].to, segments: segs.slice(1) };
  if (!path.closed && i === n - 1) return { ...path, segments: segs.slice(0, -1) };
  if (path.closed && i === 0) {
    // Rotera så att nod 1 blir start, ta sedan bort den gamla start-noden (nu sist).
    const rotated: VectorPath = { ...path, start: segs[0].to, segments: [...segs.slice(1), segs[0]] };
    return deleteNode(rotated, n - 1);
  }
  const a = segs[i - 1];
  const b = segs[i];
  const prevNode = i - 1 === 0 ? path.start : segs[i - 2].to;
  const merged: PathSegment =
    a.type === 'line' && b.type === 'line'
      ? { type: 'line', to: b.to }
      : {
          type: 'cubic',
          c1: a.type === 'cubic' ? a.c1 : prevNode,
          c2: b.type === 'cubic' ? b.c2 : b.to,
          to: b.to,
        };
  return { ...path, segments: [...segs.slice(0, i - 1), merged, ...segs.slice(i + 1)] };
}

/** Punkt på segment vid t. */
export function pointOnSegment(from: Vec2, s: PathSegment, t: number): Vec2 {
  if (s.type === 'cubic') {
    const u = 1 - t;
    return {
      x: u * u * u * from.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x,
      y: u * u * u * from.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y,
    };
  }
  return lerp(from, s.to, t);
}

/** Närmaste punkt på banan: segment, parameter och avstånd. */
export function nearestOnPath(path: VectorPath, p: Vec2): { segment: number; t: number; dist: number; point: Vec2 } | null {
  let best: { segment: number; t: number; dist: number; point: Vec2 } | null = null;
  let from = path.start;
  path.segments.forEach((s, k) => {
    const steps = s.type === 'line' ? 1 : 40;
    if (s.type === 'line') {
      const dx = s.to.x - from.x, dy = s.to.y - from.y;
      const len2 = dx * dx + dy * dy || 1e-12;
      const t = Math.min(1, Math.max(0, ((p.x - from.x) * dx + (p.y - from.y) * dy) / len2));
      const q = lerp(from, s.to, t);
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (!best || d < best.dist) best = { segment: k, t, dist: d, point: q };
    } else {
      for (let j = 0; j <= steps; j++) {
        const t = j / steps;
        const q = pointOnSegment(from, s, t);
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (!best || d < best.dist) best = { segment: k, t, dist: d, point: q };
      }
    }
    from = s.to;
  });
  return best;
}

/** Stänger eller öppnar en bana. */
export function setClosed(path: VectorPath, closed: boolean): VectorPath {
  if (closed === path.closed) return path;
  if (closed) {
    const last = path.segments[path.segments.length - 1];
    const segments = last && near(last.to, path.start, 1e-4) ? path.segments : [...path.segments, { type: 'line' as const, to: { ...path.start } }];
    return { ...path, closed: true, segments };
  }
  const last = path.segments[path.segments.length - 1];
  const segments = last && last.type === 'line' && near(last.to, path.start, 1e-4) ? path.segments.slice(0, -1) : path.segments;
  return { ...path, closed: false, segments };
}
