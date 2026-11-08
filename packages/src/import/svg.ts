/**
 * SVG-import. Läser former, grupper med transformer, <use> och Inkscape-lager.
 * Allt omvandlas till millimeter med Y uppåt (CAD-konvention).
 */
import { uid } from '../geometry';
import { joinPaths, pathsBounds, transformPath } from '../pathOps';
import { IDENTITY, multiply, parseTransform, scale, translate, type Mat2D } from '../transform';
import type { PathSegment, Vec2, VectorPath, VectorShape } from '../types';
import { parsePathData } from './svgPath';
import type { ImportOptions, ImportResult, ImportedLayer } from './types';
import { parseXml, type XmlNode } from './xml';

const KAPPA = 0.5522847498;
const SKIP = new Set(['defs', 'clipPath', 'mask', 'symbol', 'marker', 'pattern', 'title', 'desc', 'metadata', 'style', 'script', 'linearGradient', 'radialGradient', 'filter', 'sodipodi:namedview']);

const num = (v: string | undefined, d = 0) => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : d;
};

/** Längd med enhet → mm. Returnerar null för procent eller saknat värde. */
function lengthMm(v: string | undefined, dpi: number): number | null {
  if (!v) return null;
  const m = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*([a-z%]*)\s*$/i.exec(v);
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch (m[2].toLowerCase()) {
    case 'mm': return n;
    case 'cm': return n * 10;
    case 'in': return n * 25.4;
    case 'pt': return (n * 25.4) / 72;
    case 'pc': return (n * 25.4) / 6;
    case '':
    case 'px': return (n * 25.4) / dpi;
    default: return null;
  }
}

function styleOf(node: XmlNode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (node.attrs.style ?? '').split(';')) {
    const [k, ...v] = part.split(':');
    if (k && v.length) out[k.trim()] = v.join(':').trim();
  }
  return out;
}

function hidden(node: XmlNode): boolean {
  const st = styleOf(node);
  return node.attrs.display === 'none' || st.display === 'none' || node.attrs.visibility === 'hidden' || st.visibility === 'hidden';
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): VectorPath {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  const seg = (c1: Vec2, c2: Vec2, to: Vec2): PathSegment => ({ type: 'cubic', c1, c2, to });
  return {
    id: uid('path'),
    start: { x: cx + rx, y: cy },
    closed: true,
    segments: [
      seg({ x: cx + rx, y: cy + ky }, { x: cx + kx, y: cy + ry }, { x: cx, y: cy + ry }),
      seg({ x: cx - kx, y: cy + ry }, { x: cx - rx, y: cy + ky }, { x: cx - rx, y: cy }),
      seg({ x: cx - rx, y: cy - ky }, { x: cx - kx, y: cy - ry }, { x: cx, y: cy - ry }),
      seg({ x: cx + kx, y: cy - ry }, { x: cx + rx, y: cy - ky }, { x: cx + rx, y: cy }),
    ],
  };
}

function rectPath(x: number, y: number, w: number, h: number, rxIn: number, ryIn: number): VectorPath {
  const rx = Math.min(rxIn, w / 2);
  const ry = Math.min(ryIn, h / 2);
  const L = (px: number, py: number): PathSegment => ({ type: 'line', to: { x: px, y: py } });
  if (rx <= 0 || ry <= 0) {
    return { id: uid('path'), start: { x, y }, closed: true, segments: [L(x + w, y), L(x + w, y + h), L(x, y + h), L(x, y)] };
  }
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  const C = (c1x: number, c1y: number, c2x: number, c2y: number, tx: number, ty: number): PathSegment => ({
    type: 'cubic', c1: { x: c1x, y: c1y }, c2: { x: c2x, y: c2y }, to: { x: tx, y: ty },
  });
  return {
    id: uid('path'),
    start: { x: x + rx, y },
    closed: true,
    segments: [
      L(x + w - rx, y),
      C(x + w - rx + kx, y, x + w, y + ry - ky, x + w, y + ry),
      L(x + w, y + h - ry),
      C(x + w, y + h - ry + ky, x + w - rx + kx, y + h, x + w - rx, y + h),
      L(x + rx, y + h),
      C(x + rx - kx, y + h, x, y + h - ry + ky, x, y + h - ry),
      L(x, y + ry),
      C(x, y + ry - ky, x + rx - kx, y, x + rx, y),
    ],
  };
}

function pointsPath(list: string | undefined, closed: boolean): VectorPath | null {
  const v = (list?.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
  if (v.length < 4) return null;
  const segments: PathSegment[] = [];
  for (let i = 2; i + 1 < v.length; i += 2) segments.push({ type: 'line', to: { x: v[i], y: v[i + 1] } });
  if (closed) segments.push({ type: 'line', to: { x: v[0], y: v[1] } });
  return { id: uid('path'), start: { x: v[0], y: v[1] }, segments, closed };
}

const SHAPE_NAMES: Record<string, string> = {
  path: 'Bana', rect: 'Rektangel', circle: 'Cirkel', ellipse: 'Ellips', line: 'Linje', polyline: 'Polylinje', polygon: 'Polygon',
};

export function importSvg(text: string, opts: ImportOptions): ImportResult {
  const root = parseXml(text);
  if (root.name !== 'svg' && !root.name.endsWith(':svg')) throw new Error('Filen är inte en SVG');
  const dpi = opts.svgDpi;
  const warnings: string[] = [];
  const skipped: Record<string, number> = {};

  const ids = new Map<string, XmlNode>();
  const index = (n: XmlNode) => {
    if (n.attrs.id) ids.set(n.attrs.id, n);
    n.children.forEach(index);
  };
  index(root);

  // Dokumentets mått → mm
  const vb = (root.attrs.viewBox ?? '').split(/[\s,]+/).map(Number);
  const hasVb = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0;
  const wMm = lengthMm(root.attrs.width, dpi);
  const hMm = lengthMm(root.attrs.height, dpi);
  let sx = 25.4 / dpi;
  let unitsNote = `Inga enheter i filen – ${dpi} px per tum`;
  if (opts.unitScale) {
    sx = opts.unitScale;
    unitsNote = `Manuell skala: ${opts.unitScale} mm per enhet`;
  } else if (hasVb && (wMm || hMm)) {
    sx = wMm ? wMm / vb[2] : hMm! / vb[3];
    unitsNote = /mm|cm|in|pt|pc/.test(`${root.attrs.width}${root.attrs.height}`)
      ? `Storlek från filen (${root.attrs.width} × ${root.attrs.height})`
      : `Storlek i pixlar, ${dpi} px per tum`;
  }
  const sy = !opts.unitScale && hasVb && wMm && hMm ? hMm / vb[3] : sx;
  const rootMat = multiply(scale(sx, sy), hasVb ? translate(-vb[0], -vb[1]) : IDENTITY);
  const docHeight = hasVb ? vb[3] * sy : hMm ?? null;

  const layers = new Map<string, VectorShape[]>();
  const defaultLayer = 'Importerat';
  const add = (layer: string, shape: VectorShape) => {
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer)!.push(shape);
  };
  const counter: Record<string, number> = {};

  const walk = (node: XmlNode, parent: Mat2D, layer: string, depth: number) => {
    if (depth > 64 || SKIP.has(node.name) || hidden(node)) return;
    const m = multiply(parent, parseTransform(node.attrs.transform));
    let paths: VectorPath[] = [];
    switch (node.name) {
      case 'svg':
      case 'g':
      case 'a':
      case 'switch': {
        const isLayer = node.name === 'g' && node.attrs['inkscape:groupmode'] === 'layer';
        const nextLayer = isLayer ? node.attrs['inkscape:label'] ?? node.attrs.id ?? layer : layer;
        const inner = node.name === 'svg' && node !== root ? multiply(m, translate(num(node.attrs.x), num(node.attrs.y))) : m;
        node.children.forEach((c) => walk(c, inner, nextLayer, depth + 1));
        return;
      }
      case 'use': {
        const href = (node.attrs.href ?? node.attrs['xlink:href'] ?? '').replace(/^#/, '');
        const target = ids.get(href);
        if (target && target !== node) walk(target, multiply(m, translate(num(node.attrs.x), num(node.attrs.y))), layer, depth + 1);
        return;
      }
      case 'path':
        try {
          paths = parsePathData(node.attrs.d ?? '').map((s) => ({ id: uid('path'), ...s }));
        } catch (e) {
          warnings.push(`En bana kunde inte läsas: ${(e as Error).message}`);
        }
        break;
      case 'rect': {
        const w = num(node.attrs.width);
        const h = num(node.attrs.height);
        if (w > 0 && h > 0) {
          const rx = node.attrs.rx !== undefined ? num(node.attrs.rx) : num(node.attrs.ry);
          const ry = node.attrs.ry !== undefined ? num(node.attrs.ry) : rx;
          paths = [rectPath(num(node.attrs.x), num(node.attrs.y), w, h, rx, ry)];
        }
        break;
      }
      case 'circle': {
        const r = num(node.attrs.r);
        if (r > 0) paths = [ellipsePath(num(node.attrs.cx), num(node.attrs.cy), r, r)];
        break;
      }
      case 'ellipse': {
        const rx = num(node.attrs.rx);
        const ry = num(node.attrs.ry);
        if (rx > 0 && ry > 0) paths = [ellipsePath(num(node.attrs.cx), num(node.attrs.cy), rx, ry)];
        break;
      }
      case 'line':
        paths = [
          {
            id: uid('path'),
            start: { x: num(node.attrs.x1), y: num(node.attrs.y1) },
            segments: [{ type: 'line', to: { x: num(node.attrs.x2), y: num(node.attrs.y2) } }],
            closed: false,
          },
        ];
        break;
      case 'polyline':
      case 'polygon': {
        const p = pointsPath(node.attrs.points, node.name === 'polygon');
        if (p) paths = [p];
        break;
      }
      case 'text':
        skipped.text = (skipped.text ?? 0) + 1;
        return;
      case 'image':
        skipped.image = (skipped.image ?? 0) + 1;
        return;
      default:
        node.children.forEach((c) => walk(c, m, layer, depth + 1));
        return;
    }
    if (!paths.length) return;
    const full = multiply(rootMat, m);
    counter[node.name] = (counter[node.name] ?? 0) + 1;
    add(layer, {
      id: uid('shape'),
      name: node.attrs['inkscape:label'] ?? `${SHAPE_NAMES[node.name]} ${counter[node.name]}`,
      kind: 'imported',
      paths: paths.map((p) => transformPath(p, full)),
    });
  };

  root.children.forEach((c) => walk(c, IDENTITY, defaultLayer, 1));

  if (skipped.text) warnings.push(`${skipped.text} textobjekt hoppades över. Konvertera text till kurvor (Inkscape: Bana › Objekt till bana) och importera igen.`);
  if (skipped.image) warnings.push(`${skipped.image} inbäddade bilder hoppades över. Använd Fotogravyr för bilder.`);

  // SVG har Y nedåt – spegla till CAD-koordinater med Y uppåt.
  let all = [...layers.values()].flat();
  const rawBounds = pathsBounds(all.flatMap((s) => s.paths));
  const flipH = docHeight ?? (rawBounds ? rawBounds.max.y + rawBounds.min.y : 0);
  const flip: Mat2D = [1, 0, 0, -1, 0, flipH];

  const out: ImportedLayer[] = [];
  let openPathCount = 0;
  for (const [name, shapes] of layers) {
    let flipped = shapes.map((s) => ({ ...s, paths: s.paths.map((p) => transformPath(p, flip)) }));
    if (opts.join) {
      const closedShapes = flipped.filter((s) => s.paths.every((p) => p.closed));
      const openPaths = flipped.filter((s) => !s.paths.every((p) => p.closed)).flatMap((s) => s.paths);
      const joined = joinPaths(openPaths, opts.joinTolerance);
      flipped = [
        ...closedShapes,
        ...joined.map((p, i) => ({ id: uid('shape'), name: `${p.closed ? 'Kontur' : 'Öppen bana'} ${i + 1}`, kind: 'imported' as const, paths: [p] })),
      ];
    }
    openPathCount += flipped.reduce((n, s) => n + s.paths.filter((p) => !p.closed).length, 0);
    out.push({ name, shapes: flipped });
  }
  all = out.flatMap((l) => l.shapes);

  return {
    format: 'svg',
    layers: out,
    warnings,
    bounds: pathsBounds(all.flatMap((s) => s.paths)),
    unitsNote,
    shapeCount: all.length,
    openPathCount,
  };
}
