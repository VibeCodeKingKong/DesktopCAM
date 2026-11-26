/**
 * Förena, dra ifrån och gemensam del för markerade former (polyclip-ts, MIT).
 * (Förskjut kontur finns i egenskapspanelen: commands.offsetSelection.)
 *
 * Formerna läses med jämn–udda-regeln (ett hål i en form är ett hål) och
 * resultatet blir en ny form av raka linjer med 0,02 mm noggrannhet. Bågarna
 * passas in igen när G-koden skrivs.
 */
import { shapeToPolylines, simplifyClosed, uid, type PathSegment, type VectorPath, type VectorShape } from '@desktopcam/core';
import { difference, intersection, union, xor, type Geom } from 'polyclip-ts';
import { getT } from '../i18n';
import { allShapes, useAppStore } from '../store/useAppStore';

type Ring = [number, number][];
type MultiPoly = Ring[][];
export type BooleanOp = 'union' | 'subtract' | 'intersect';

const TOL = 0.02;

/** Formens yta som polygoner (jämn–udda), eller null om den saknar slutna konturer. */
function areaOf(sh: VectorShape): MultiPoly | null {
  const rings: Ring[] = [];
  for (const p of shapeToPolylines(sh, TOL)) {
    if (!p.closed || p.points.length < 6) continue;
    const r: Ring = [];
    for (let i = 0; i + 1 < p.points.length; i += 2) r.push([p.points[i], p.points[i + 1]]);
    rings.push(r);
  }
  if (!rings.length) return null;
  let acc: Geom = [[rings[0]]];
  for (const r of rings.slice(1)) acc = xor(acc, [[r]]);
  return acc as MultiPoly;
}

/** Ungefärlig yta (för att välja vilken form de andra dras ifrån). */
function size(mp: MultiPoly): number {
  let a = 0;
  for (const poly of mp)
    poly.forEach((r, k) => {
      let s = 0;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
      a += (k === 0 ? 1 : -1) * Math.abs(s / 2);
    });
  return a;
}

/** Polygoner → banor (en sluten bana per ring). */
function toPaths(rings: number[][]): VectorPath[] {
  const paths: VectorPath[] = [];
  for (const flat of rings) {
    if (flat.length < 6) continue;
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
    const segments: PathSegment[] = [...pts.slice(1), pts[0]].map(([x, y]) => ({ type: 'line', to: { x, y } }));
    paths.push({ id: uid('path'), start: { x: pts[0][0], y: pts[0][1] }, segments, closed: true });
  }
  return paths;
}

/** Ringar utan upprepad slutpunkt, med bort-förenklade punkter på raka sträckor. */
function cleanRings(mp: MultiPoly): number[][] {
  const out: number[][] = [];
  for (const poly of mp)
    for (const r of poly) {
      const pts = r.slice(0, r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? -1 : undefined);
      const flat = simplifyClosed(pts.flat(), TOL / 4);
      if (flat.length >= 6) out.push(flat);
    }
  return out;
}

/** Ersätter formerna med en ny form (ett ångra-steg). Banor som använde någon av dem använder den nya. */
function replaceWith(ids: string[], shape: VectorShape) {
  const s = useAppStore.getState();
  const gone = new Set(ids);
  let placed = false;
  const layers = s.layers.map((l) => {
    if (!l.shapes.some((sh) => gone.has(sh.id))) return l;
    const shapes = l.shapes.filter((sh) => !gone.has(sh.id));
    if (!placed) {
      shapes.push(shape);
      placed = true;
    }
    return { ...l, shapes };
  });
  const toolpaths = s.toolpaths.map((tp) =>
    tp.shapeIds.some((id) => gone.has(id)) ? { ...tp, shapeIds: [...tp.shapeIds.filter((id) => !gone.has(id)), shape.id] } : tp,
  );
  s.checkpoint();
  useAppStore.setState({ layers, toolpaths, selectedShapeIds: [shape.id], selectedNode: null });
  for (const tp of toolpaths) if (tp.shapeIds.includes(shape.id)) void import('./toolpathService').then((m) => m.scheduleCompute(tp.id));
}

/**
 * Slå ihop / dra ifrån / gemensam del för de markerade formerna.
 * Dra ifrån: den största formen behålls och de övriga dras ifrån den.
 */
export function combineSelection(op: BooleanOp): void {
  const s = useAppStore.getState();
  const t = getT();
  const shapes = allShapes(s.layers).filter((sh) => s.selectedShapeIds.includes(sh.id));
  if (shapes.length < 2) {
    s.setStatus(t.shapeOps.needTwo);
    return;
  }
  const areas = shapes.map(areaOf);
  if (areas.some((a) => !a)) {
    s.setStatus(t.shapeOps.needClosed);
    return;
  }
  const list = areas as MultiPoly[];
  let result: MultiPoly;
  if (op === 'union') result = union(list[0], ...list.slice(1)) as MultiPoly;
  else if (op === 'intersect') result = intersection(list[0], ...list.slice(1)) as MultiPoly;
  else {
    let base = 0;
    list.forEach((a, i) => size(a) > size(list[base]) && (base = i));
    result = difference(list[base], ...list.filter((_, i) => i !== base)) as MultiPoly;
  }
  const paths = toPaths(cleanRings(result));
  if (!paths.length) {
    s.setStatus(op === 'intersect' ? t.shapeOps.noOverlap : t.shapeOps.nothingLeft);
    return;
  }
  const name = t.shapeOps.names[op];
  const shape: VectorShape = { id: uid('shape'), name, kind: 'imported', paths };
  replaceWith(
    shapes.map((sh) => sh.id),
    shape,
  );
  s.setStatus(t.shapeOps.done(name, String(shapes.length)));
}
