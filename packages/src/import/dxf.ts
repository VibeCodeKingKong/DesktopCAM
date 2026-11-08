/**
 * DXF-import (ASCII, R12 till 2018). Läser LINE, ARC, CIRCLE, LWPOLYLINE,
 * POLYLINE, ELLIPSE, SPLINE och INSERT (block, även nästlade).
 * Lösa linjer och bågar sammanfogas till konturer per lager.
 */
import { uid } from '../geometry';
import { joinPaths, pathsBounds, transformPath } from '../pathOps';
import { IDENTITY, multiply, rotate, scale, translate, type Mat2D } from '../transform';
import type { PathSegment, Vec2, VectorPath } from '../types';
import type { ImportOptions, ImportResult, ImportedLayer } from './types';

type Pair = [number, string];

interface Entity {
  type: string;
  props: Pair[];
  /** Hörn för gammaldags POLYLINE. */
  vertices?: Entity[];
}

interface Block {
  name: string;
  base: Vec2;
  entities: Entity[];
}

const UNIT_MM: Record<number, [number, string]> = {
  1: [25.4, 'tum'],
  2: [304.8, 'fot'],
  4: [1, 'millimeter'],
  5: [10, 'centimeter'],
  6: [1000, 'meter'],
  8: [0.0000254, 'mikrotum'],
  9: [0.0254, 'mil'],
  10: [914.4, 'yard'],
};

const TEXT_TYPES = new Set(['TEXT', 'MTEXT', 'ATTRIB', 'ATTDEF']);
const IGNORED = new Set(['POINT', 'VIEWPORT', 'DIMENSION', 'LEADER', 'MLEADER', 'SEQEND', 'VERTEX']);

const get = (e: Entity, code: number, d = 0) => {
  const p = e.props.find(([c]) => c === code);
  const n = p ? parseFloat(p[1]) : NaN;
  return Number.isFinite(n) ? n : d;
};
const str = (e: Entity, code: number, d = '') => e.props.find(([c]) => c === code)?.[1] ?? d;
const all = (e: Entity, code: number) => e.props.filter(([c]) => c === code).map(([, v]) => parseFloat(v));

function readPairs(text: string): Pair[] {
  if (text.startsWith('AutoCAD Binary DXF')) throw new Error('Binär DXF stöds inte – spara som ASCII-DXF');
  const lines = text.split(/\r?\n/);
  const pairs: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (Number.isNaN(code)) throw new Error(`Ogiltig DXF – förväntade gruppkod på rad ${i + 1}`);
    pairs.push([code, lines[i + 1].trim()]);
  }
  return pairs;
}

/** Delar upp gruppkoderna i sektioner och entiteter. */
function structure(pairs: Pair[]) {
  const header: Record<string, string> = {};
  const blocks = new Map<string, Block>();
  const entities: Entity[] = [];
  let section = '';
  let i = 0;

  const readEntity = (): Entity => {
    const e: Entity = { type: pairs[i][1], props: [] };
    i++;
    while (i < pairs.length && pairs[i][0] !== 0) e.props.push(pairs[i++]);
    return e;
  };
  const readEntityList = (stop: (type: string) => boolean): Entity[] => {
    const list: Entity[] = [];
    while (i < pairs.length && !(pairs[i][0] === 0 && stop(pairs[i][1]))) {
      if (pairs[i][0] !== 0) {
        i++;
        continue;
      }
      const e = readEntity();
      if (e.type === 'POLYLINE') {
        e.vertices = [];
        while (i < pairs.length && pairs[i][0] === 0 && pairs[i][1] === 'VERTEX') e.vertices.push(readEntity());
        if (i < pairs.length && pairs[i][1] === 'SEQEND') readEntity();
      }
      list.push(e);
    }
    return list;
  };

  while (i < pairs.length) {
    const [code, value] = pairs[i];
    if (code === 0 && value === 'SECTION') {
      section = pairs[i + 1]?.[1] ?? '';
      i += 2;
      if (section === 'ENTITIES') {
        entities.push(...readEntityList((t) => t === 'ENDSEC'));
      } else if (section === 'BLOCKS') {
        while (i < pairs.length && !(pairs[i][0] === 0 && pairs[i][1] === 'ENDSEC')) {
          if (pairs[i][0] === 0 && pairs[i][1] === 'BLOCK') {
            const head = readEntity();
            const block: Block = { name: str(head, 2), base: { x: get(head, 10), y: get(head, 20) }, entities: [] };
            block.entities = readEntityList((t) => t === 'ENDBLK');
            if (i < pairs.length) readEntity(); // ENDBLK
            blocks.set(block.name, block);
          } else i++;
        }
      }
      continue;
    }
    if (section === 'HEADER' && code === 9) {
      const next = pairs[i + 1];
      if (next) header[value] = next[1];
      i += 2;
      continue;
    }
    i++;
  }
  return { header, blocks, entities };
}

const pt = (x: number, y: number): Vec2 => ({ x, y });

function circlePath(c: Vec2, r: number, cw: boolean): VectorPath {
  return {
    id: uid('path'),
    start: pt(c.x + r, c.y),
    closed: true,
    segments: [
      { type: 'arc', to: pt(c.x - r, c.y), center: c, clockwise: cw },
      { type: 'arc', to: pt(c.x + r, c.y), center: c, clockwise: cw },
    ],
  };
}

/** Segment från p1 till p2 med "bulge" = tan(vinkel/4), positiv = moturs. */
function bulgeSegment(p1: Vec2, p2: Vec2, b: number): PathSegment {
  if (Math.abs(b) < 1e-9) return { type: 'line', to: p2 };
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const c = Math.hypot(dx, dy);
  if (c < 1e-12) return { type: 'line', to: p2 };
  const k = (1 - b * b) / (4 * b); // avstånd från kordans mitt till centrum / korda
  return {
    type: 'arc',
    to: p2,
    center: pt((p1.x + p2.x) / 2 - k * dy, (p1.y + p2.y) / 2 + k * dx),
    clockwise: b < 0,
  };
}

function polylineFromVertices(vs: { x: number; y: number; bulge: number }[], closed: boolean): VectorPath | null {
  if (vs.length < 2) return null;
  const segments: PathSegment[] = [];
  for (let i = 1; i < vs.length; i++) segments.push(bulgeSegment(vs[i - 1], vs[i], vs[i - 1].bulge));
  if (closed) segments.push(bulgeSegment(vs[vs.length - 1], vs[0], vs[vs.length - 1].bulge));
  return { id: uid('path'), start: pt(vs[0].x, vs[0].y), segments, closed };
}

function sampleLines(points: Vec2[], closed: boolean): VectorPath | null {
  if (points.length < 2) return null;
  return {
    id: uid('path'),
    start: points[0],
    segments: points.slice(1).map((to) => ({ type: 'line' as const, to })),
    closed,
  };
}

/** B-spline (även rationell) via de Boors algoritm. */
function evalSpline(e: Entity): Vec2[] {
  const degree = get(e, 71, 3);
  const knots = all(e, 40);
  const xs = all(e, 10);
  const ys = all(e, 20);
  const weights = all(e, 41);
  const ctrl = xs.map((x, i) => ({ x, y: ys[i] ?? 0, w: weights[i] ?? 1 }));
  if (ctrl.length < 2 || knots.length !== ctrl.length + degree + 1) {
    const fx = all(e, 11);
    const fy = all(e, 21);
    if (fx.length >= 2) return fx.map((x, i) => pt(x, fy[i] ?? 0));
    return ctrl.map((c) => pt(c.x, c.y));
  }
  const t0 = knots[degree];
  const t1 = knots[ctrl.length];
  const n = Math.max(32, ctrl.length * 12);
  const out: Vec2[] = [];
  for (let s = 0; s <= n; s++) {
    const t = Math.min(t0 + ((t1 - t0) * s) / n, t1 - 1e-12 * Math.abs(t1 || 1));
    let k = degree;
    while (k < ctrl.length - 1 && knots[k + 1] <= t) k++;
    const d = Array.from({ length: degree + 1 }, (_, j) => {
      const c = ctrl[k - degree + j];
      return { x: c.x * c.w, y: c.y * c.w, w: c.w };
    });
    for (let r = 1; r <= degree; r++) {
      for (let j = degree; j >= r; j--) {
        const i = k - degree + j;
        const den = knots[i + degree - r + 1] - knots[i];
        const a = den === 0 ? 0 : (t - knots[i]) / den;
        d[j] = { x: (1 - a) * d[j - 1].x + a * d[j].x, y: (1 - a) * d[j - 1].y + a * d[j].y, w: (1 - a) * d[j - 1].w + a * d[j].w };
      }
    }
    out.push(pt(d[degree].x / d[degree].w, d[degree].y / d[degree].w));
  }
  return out;
}

/** Gör om en entitet till banor i blockets/ritningens koordinater. */
function entityPaths(e: Entity, skipped: Map<string, number>): VectorPath[] {
  const flip = get(e, 230, 1) < 0; // extrusion −Z: speglad OCS
  const fx = (x: number) => (flip ? -x : x);
  switch (e.type) {
    case 'LINE':
      return [{ id: uid('path'), start: pt(get(e, 10), get(e, 20)), segments: [{ type: 'line', to: pt(get(e, 11), get(e, 21)) }], closed: false }];
    case 'CIRCLE': {
      const r = get(e, 40);
      return r > 0 ? [circlePath(pt(fx(get(e, 10)), get(e, 20)), r, flip)] : [];
    }
    case 'ARC': {
      const c = pt(get(e, 10), get(e, 20));
      const r = get(e, 40);
      const a0 = (get(e, 50) * Math.PI) / 180;
      const a1 = (get(e, 51) * Math.PI) / 180;
      if (r <= 0) return [];
      const p = (a: number) => pt(fx(c.x + r * Math.cos(a)), c.y + r * Math.sin(a));
      const center = pt(fx(c.x), c.y);
      if (Math.abs(((a1 - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) < 1e-9) return [circlePath(center, r, flip)];
      return [{ id: uid('path'), start: p(a0), segments: [{ type: 'arc', to: p(a1), center, clockwise: flip }], closed: false }];
    }
    case 'LWPOLYLINE': {
      const vs: { x: number; y: number; bulge: number }[] = [];
      for (const [code, value] of e.props) {
        const v = parseFloat(value);
        if (code === 10) vs.push({ x: fx(v), y: 0, bulge: 0 });
        else if (code === 20 && vs.length) vs[vs.length - 1].y = v;
        else if (code === 42 && vs.length) vs[vs.length - 1].bulge = flip ? -v : v;
      }
      const p = polylineFromVertices(vs, (get(e, 70) & 1) === 1);
      return p ? [p] : [];
    }
    case 'POLYLINE': {
      const flags = get(e, 70);
      if (flags & (16 | 64)) {
        skipped.set('3D-nät', (skipped.get('3D-nät') ?? 0) + 1);
        return [];
      }
      const vs = (e.vertices ?? []).filter((v) => !(get(v, 70) & 16)).map((v) => ({ x: fx(get(v, 10)), y: get(v, 20), bulge: flip ? -get(v, 42) : get(v, 42) }));
      const p = polylineFromVertices(vs, (flags & 1) === 1);
      return p ? [p] : [];
    }
    case 'ELLIPSE': {
      const c = pt(get(e, 10), get(e, 20));
      const M = pt(get(e, 11), get(e, 21));
      const ratio = get(e, 40, 1);
      const t0 = get(e, 41, 0);
      let t1 = get(e, 42, Math.PI * 2);
      if (t1 <= t0) t1 += Math.PI * 2;
      const full = Math.abs(t1 - t0 - Math.PI * 2) < 1e-6;
      const N = pt(-M.y * ratio, M.x * ratio);
      const n = Math.max(24, Math.ceil(((t1 - t0) / (Math.PI * 2)) * 128));
      const pts: Vec2[] = [];
      for (let i = 0; i <= n; i++) {
        const t = t0 + ((t1 - t0) * i) / n;
        pts.push(pt(fx(c.x + M.x * Math.cos(t) + N.x * Math.sin(t)), c.y + M.y * Math.cos(t) + N.y * Math.sin(t)));
      }
      if (full) pts.pop();
      const p = sampleLines(full ? [...pts, pts[0]] : pts, full);
      return p ? [p] : [];
    }
    case 'SPLINE': {
      const closed = (get(e, 70) & 1) === 1;
      const p = sampleLines(evalSpline(e), closed);
      return p ? [p] : [];
    }
    default:
      if (TEXT_TYPES.has(e.type)) skipped.set('text', (skipped.get('text') ?? 0) + 1);
      else if (!IGNORED.has(e.type)) skipped.set(e.type, (skipped.get(e.type) ?? 0) + 1);
      return [];
  }
}

export function importDxf(text: string, opts: ImportOptions): ImportResult {
  const { header, blocks, entities } = structure(readPairs(text));
  const warnings: string[] = [];
  const skipped = new Map<string, number>();
  const byLayer = new Map<string, VectorPath[]>();

  const emit = (list: Entity[], m: Mat2D, inheritLayer: string | null, depth: number) => {
    for (const e of list) {
      let layer = str(e, 8, '0');
      if (layer === '0' && inheritLayer) layer = inheritLayer;
      if (e.type === 'INSERT') {
        const block = blocks.get(str(e, 2));
        if (!block || depth > 16) continue;
        const local = multiply(
          translate(get(e, 10), get(e, 20)),
          multiply(rotate(get(e, 50)), multiply(scale(get(e, 41, 1), get(e, 42, 1)), translate(-block.base.x, -block.base.y))),
        );
        emit(block.entities, multiply(m, local), layer, depth + 1);
        continue;
      }
      const paths = entityPaths(e, skipped).map((p) => transformPath(p, m));
      if (!paths.length) continue;
      if (!byLayer.has(layer)) byLayer.set(layer, []);
      byLayer.get(layer)!.push(...paths);
    }
  };
  emit(entities, IDENTITY, null, 0);

  // Enheter
  const insunits = parseInt(header.$INSUNITS ?? '0', 10);
  let factor = 1;
  let unitsNote: string;
  if (opts.unitScale) {
    factor = opts.unitScale;
    unitsNote = `Manuell skala: ${opts.unitScale} mm per enhet`;
  } else if (UNIT_MM[insunits]) {
    [factor] = UNIT_MM[insunits];
    unitsNote = `Enhet från filen: ${UNIT_MM[insunits][1]}`;
  } else {
    unitsNote = 'Filen saknar enhet – tolkas som millimeter';
    warnings.push('Ritningen saknar enhet. Kontrollera storleken och välj tum om den ser 25 gånger för liten ut.');
  }
  const unitMat = scale(factor);

  if (skipped.has('text')) {
    warnings.push(`${skipped.get('text')} textobjekt hoppades över. Exportera text som kurvor (explode) från CAD-programmet.`);
    skipped.delete('text');
  }
  for (const [type, n] of skipped) warnings.push(`${n} objekt av typen ${type} stöds inte och hoppades över.`);

  const layers: ImportedLayer[] = [];
  let openPathCount = 0;
  for (const [name, raw] of byLayer) {
    const scaled = raw.map((p) => transformPath(p, unitMat));
    const paths = opts.join ? joinPaths(scaled, opts.joinTolerance) : scaled;
    openPathCount += paths.filter((p) => !p.closed).length;
    let closedN = 0;
    let openN = 0;
    layers.push({
      name: name === '0' ? 'DXF' : name,
      shapes: paths.map((p) => ({
        id: uid('shape'),
        name: p.closed ? `Kontur ${++closedN}` : `Öppen bana ${++openN}`,
        kind: 'imported' as const,
        paths: [p],
      })),
    });
  }
  const allPaths = layers.flatMap((l) => l.shapes.flatMap((s) => s.paths));
  if (!allPaths.length) warnings.push('Hittade inga ritbara objekt i filen.');
  if (openPathCount > 0) warnings.push(`${openPathCount} banor är öppna. Profil och laserskärning följer dem, men de kan inte användas för fickor.`);

  return {
    format: 'dxf',
    layers,
    warnings,
    bounds: pathsBounds(allPaths),
    unitsNote,
    shapeCount: layers.reduce((n, l) => n + l.shapes.length, 0),
    openPathCount,
  };
}
