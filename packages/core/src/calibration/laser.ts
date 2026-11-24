/**
 * Kalibreringstester för laser: effekt, hastighet, effekt × hastighet,
 * fokus, snittbredd, radavstånd, gråskala och antal pass.
 *
 * Mönstren är egna och enkla (rutor, linjer och fyllda ytor med etiketter),
 * utformade för att prova samma fysiska egenskaper som alla lasertester gör.
 */
import { formatNumber } from '../gcode';
import { shapeToPolylines } from '../geometry';
import { textToShape } from '../strokeFont';
import type { MachineProfile } from '../types';
import type { PolylineInput } from '../protocol';
import { circlePl, num, plShape, rectPl, steps, str, type CalCell, type CalibrationPlan, type CalibrationTest, type CalOutcome, type CalParam, type CalValues, type LaserOp } from './types';

/* ───────── Gemensamt ───────── */

const POS: CalParam[] = [
  { key: 'x', kind: 'number', min: 0, max: 2000, step: 1, def: 5, unit: 'mm', advanced: true },
  { key: 'y', kind: 'number', min: 0, max: 2000, step: 1, def: 5, unit: 'mm', advanced: true },
];
const LABELS: CalParam[] = [
  { key: 'labelPower', kind: 'number', min: 0, max: 100, step: 1, def: 15, unit: '%', advanced: true },
  { key: 'labelSpeed', kind: 'number', min: 100, max: 20000, step: 100, def: 2000, unit: 'mm/min', advanced: true },
];
const MODE: CalParam = { key: 'mode', kind: 'choice', options: ['engrave', 'cut'], def: 'engrave' };

/** Text som laserns etikett (enkellinje), med baslinjen i y. */
function label(text: string, x: number, y: number, h: number, v: CalValues, align: 'left' | 'center' | 'right' = 'center'): LaserOp {
  return { kind: 'vector', polylines: shapeToPolylines(textToShape(text, x, y, { height: h, align: 'left' }), 0.05).map((p) => shiftAlign(p, text, h, align)), powerPct: num(v, 'labelPower'), speed: num(v, 'labelSpeed'), passes: 1, label: true };
}

/** Centrerar eller högerställer en etikett (fonten ritas alltid vänsterställd). */
function shiftAlign(p: PolylineInput, text: string, h: number, align: 'left' | 'center' | 'right'): PolylineInput {
  if (align === 'left') return p;
  const w = textWidth(text, h);
  const dx = align === 'center' ? -w / 2 : -w;
  return { ...p, points: p.points.map((c, i) => (i % 2 ? c : c + dx)) };
}

const widthCache = new Map<string, number>();
/** Etikettens bredd (mm). */
export function textWidth(text: string, h: number): number {
  const key = `${text}|${h}`;
  let w = widthCache.get(key);
  if (w === undefined) {
    let x0 = Infinity, x1 = -Infinity;
    for (const p of shapeToPolylines(textToShape(text, 0, 0, { height: h }), 0.1))
      for (let i = 0; i < p.points.length; i += 2) (x0 = Math.min(x0, p.points[i])), (x1 = Math.max(x1, p.points[i]));
    w = Number.isFinite(x0) ? x1 - x0 : 0;
    widthCache.set(key, w);
  }
  return w;
}

const fmt = (n: number, d = 0) => (Math.round(n * 10 ** d) / 10 ** d).toString();

/** En provruta: fylld yta (gravyr) eller kontur (skärning). */
function cellOp(mode: string, x0: number, y0: number, x1: number, y1: number, powerPct: number, speed: number, interval: number, passes = 1): LaserOp {
  return mode === 'cut'
    ? { kind: 'vector', polylines: [rectPl(x0, y0, x1, y1)], powerPct, speed, passes }
    : { kind: 'fill', polylines: [rectPl(x0, y0, x1, y1)], rect: { x0, y0, x1, y1 }, interval, powerPct, speed, passes };
}

/**
 * Rutor i rader (högst `perRow` per rad, uppifrån och ner) med etikett under
 * varje ruta. Returnerar rutornas lägen och mönstrets storlek.
 */
function rowLayout(n: number, cell: number, gap: number, labelH: number, perRow: number, x: number, y: number, titleH: number) {
  const cols = Math.min(n, perRow), rows = Math.ceil(n / perRow);
  const rowH = cell + labelH * 1.6 + gap;
  const width = cols * cell + (cols - 1) * gap;
  const height = rows * rowH - gap + titleH;
  const at = (i: number) => {
    const c = i % perRow, r = Math.floor(i / perRow);
    const x0 = x + c * (cell + gap);
    const y1 = y + height - titleH - r * rowH;
    return { x0, y0: y1 - cell, x1: x0 + cell, y1 };
  };
  return { width, height, at };
}

/** Plan av laserarbeten: lager för förhandsvisning (gravyr, skärning, etiketter). */
function laserPlan(ops: LaserOp[], cells: CalCell[], x: number, y: number, width: number, height: number, extra: Partial<CalibrationPlan> = {}): CalibrationPlan {
  const layer = (name: string, color: string, pick: (o: LaserOp) => boolean) => ({ name, color, shapes: [plShape(name, ops.filter(pick).flatMap((o) => o.polylines))] });
  return {
    x,
    y,
    width,
    height,
    laser: ops,
    cells,
    measures: [],
    layers: [layer('engrave', '#1f6feb', (o) => o.kind === 'fill' && !o.label), layer('cut', '#d1242f', (o) => o.kind === 'vector' && !o.label), layer('labels', '#57606a', (o) => !!o.label)].filter((l) => l.shapes[0].paths.length),
    ...extra,
  };
}

/* ───────── Testerna ───────── */

const power: CalibrationTest = {
  id: 'laser-power',
  category: 'laser',
  analyzable: true,
  params: [
    MODE,
    { key: 'powerMin', kind: 'number', min: 0, max: 100, step: 1, def: 10, unit: '%' },
    { key: 'powerMax', kind: 'number', min: 1, max: 100, step: 1, def: 100, unit: '%' },
    { key: 'count', kind: 'number', min: 2, max: 20, step: 1, def: 10, integer: true },
    { key: 'speed', kind: 'number', min: 10, max: 20000, step: 50, def: 3000, unit: 'mm/min' },
    { key: 'interval', kind: 'number', min: 0.03, max: 1, step: 0.01, def: 0.1, unit: 'mm', advanced: true },
    { key: 'cell', kind: 'number', min: 4, max: 40, step: 1, def: 10, unit: 'mm' },
    ...LABELS,
    ...POS,
  ],
  build(v) {
    const vals = steps(num(v, 'powerMin'), num(v, 'powerMax'), num(v, 'count'));
    return seriesPlan(v, vals.map((p) => ({ p, s: num(v, 'speed'), label: `${fmt(p)}%` })), `F${fmt(num(v, 'speed'))}`);
  },
};

const speed: CalibrationTest = {
  id: 'laser-speed',
  category: 'laser',
  analyzable: true,
  params: [
    MODE,
    { key: 'speedMin', kind: 'number', min: 10, max: 20000, step: 50, def: 500, unit: 'mm/min' },
    { key: 'speedMax', kind: 'number', min: 10, max: 20000, step: 50, def: 5000, unit: 'mm/min' },
    { key: 'count', kind: 'number', min: 2, max: 20, step: 1, def: 10, integer: true },
    { key: 'power', kind: 'number', min: 1, max: 100, step: 1, def: 50, unit: '%' },
    { key: 'interval', kind: 'number', min: 0.03, max: 1, step: 0.01, def: 0.1, unit: 'mm', advanced: true },
    { key: 'cell', kind: 'number', min: 4, max: 40, step: 1, def: 10, unit: 'mm' },
    ...LABELS,
    ...POS,
  ],
  build(v) {
    const vals = steps(num(v, 'speedMin'), num(v, 'speedMax'), num(v, 'count'));
    return seriesPlan(v, vals.map((s) => ({ p: num(v, 'power'), s, label: fmt(s) })), `S${fmt(num(v, 'power'))}%`);
  },
};

/** En rad rutor, en per värde, med en rubrik som säger vad som är lika i alla. */
function seriesPlan(v: CalValues, items: { p: number; s: number; label: string }[], title: string): CalibrationPlan {
  const cell = num(v, 'cell'), gap = Math.max(2, cell * 0.3), lh = Math.max(2.5, Math.min(5, cell * 0.25)), x = num(v, 'x'), y = num(v, 'y');
  const titleH = lh * 2;
  const L = rowLayout(items.length, cell, gap, lh, 10, x, y, titleH);
  const ops: LaserOp[] = [];
  const cells: CalCell[] = [];
  items.forEach((it, i) => {
    const r = L.at(i);
    ops.push(cellOp(str(v, 'mode'), r.x0, r.y0, r.x1, r.y1, it.p, it.s, num(v, 'interval')));
    ops.push(label(it.label, (r.x0 + r.x1) / 2, r.y0 - lh * 1.35, lh, v));
    cells.push({ id: `c${i}`, ...r, label: it.label, values: { power: it.p, speed: it.s } });
  });
  ops.push(label(title, x, y + L.height - lh, lh, v, 'left'));
  return laserPlan(ops, cells, x, y, L.width, L.height);
}

const matrix: CalibrationTest = {
  id: 'laser-matrix',
  category: 'laser',
  analyzable: true,
  params: [
    MODE,
    { key: 'powerMin', kind: 'number', min: 0, max: 100, step: 1, def: 10, unit: '%' },
    { key: 'powerMax', kind: 'number', min: 1, max: 100, step: 1, def: 100, unit: '%' },
    { key: 'powerSteps', kind: 'number', min: 2, max: 12, step: 1, def: 5, integer: true },
    { key: 'speedMin', kind: 'number', min: 10, max: 20000, step: 50, def: 500, unit: 'mm/min' },
    { key: 'speedMax', kind: 'number', min: 10, max: 20000, step: 50, def: 5000, unit: 'mm/min' },
    { key: 'speedSteps', kind: 'number', min: 2, max: 12, step: 1, def: 5, integer: true },
    { key: 'interval', kind: 'number', min: 0.03, max: 1, step: 0.01, def: 0.1, unit: 'mm', advanced: true },
    { key: 'cell', kind: 'number', min: 4, max: 30, step: 1, def: 8, unit: 'mm' },
    ...LABELS,
    ...POS,
  ],
  build(v) {
    const ps = steps(num(v, 'powerMin'), num(v, 'powerMax'), num(v, 'powerSteps'));
    const ss = steps(num(v, 'speedMin'), num(v, 'speedMax'), num(v, 'speedSteps'));
    const cell = num(v, 'cell'), gap = Math.max(1.5, cell * 0.25), lh = Math.max(2.2, Math.min(4, cell * 0.3));
    const x = num(v, 'x'), y = num(v, 'y');
    // Effekt på raderna (vänster), hastighet på kolumnerna (överst).
    const left = Math.max(...ps.map((p) => textWidth(`${fmt(p)}%`, lh))) + gap * 1.5;
    const top = lh * 2.6;
    const width = left + ss.length * cell + (ss.length - 1) * gap;
    const height = top + ps.length * cell + (ps.length - 1) * gap;
    const ops: LaserOp[] = [];
    const cells: CalCell[] = [];
    ps.forEach((p, r) => {
      const y1 = y + height - top - r * (cell + gap), y0 = y1 - cell;
      ops.push(label(`${fmt(p)}%`, x + left - gap * 1.2, y0 + cell / 2 - lh / 2, lh, v, 'right'));
      ss.forEach((s, c) => {
        const x0 = x + left + c * (cell + gap);
        ops.push(cellOp(str(v, 'mode'), x0, y0, x0 + cell, y1, p, s, num(v, 'interval')));
        cells.push({ id: `r${r}c${c}`, x0, y0, x1: x0 + cell, y1, label: `${fmt(p)}% · ${fmt(s)}`, values: { power: p, speed: s } });
      });
    });
    ss.forEach((s, c) => ops.push(label(fmt(s), x + left + c * (cell + gap) + cell / 2, y + height - lh * 1.4, lh * 0.85, v)));
    return laserPlan(ops, cells, x, y, width, height);
  },
};

const focus: CalibrationTest = {
  id: 'laser-focus',
  category: 'laser',
  params: [
    { key: 'focusMode', kind: 'choice', options: ['ramp', 'zsteps'], def: 'ramp' },
    { key: 'length', kind: 'number', min: 40, max: 400, step: 10, def: 100, unit: 'mm' },
    { key: 'zMin', kind: 'number', min: -20, max: 20, step: 0.5, def: -3, unit: 'mm' },
    { key: 'zMax', kind: 'number', min: -20, max: 20, step: 0.5, def: 3, unit: 'mm' },
    { key: 'count', kind: 'number', min: 2, max: 20, step: 1, def: 7, integer: true },
    { key: 'power', kind: 'number', min: 1, max: 100, step: 1, def: 30, unit: '%' },
    { key: 'speed', kind: 'number', min: 10, max: 20000, step: 50, def: 1500, unit: 'mm/min' },
    ...LABELS,
    ...POS,
  ],
  build(v) {
    const x = num(v, 'x'), y = num(v, 'y'), lh = 3;
    const ops: LaserOp[] = [];
    const cells: CalCell[] = [];
    if (str(v, 'focusMode') === 'ramp') {
      // Ramp: en lång linje på en lutande skiva. Skalstreck var 5 mm och siffror
      // var 10 mm visar var linjen är tunnast (där ligger fokus).
      const L = num(v, 'length'), yl = y + lh * 3;
      const pl: PolylineInput[] = [{ points: [x, yl, x + L, yl], closed: false }];
      ops.push({ kind: 'vector', polylines: pl, powerPct: num(v, 'power'), speed: num(v, 'speed'), passes: 1 });
      const ticks: PolylineInput[] = [];
      for (let d = 0; d <= L + 1e-6; d += 5) ticks.push({ points: [x + d, yl - (d % 10 === 0 ? 3 : 1.5), x + d, yl - 0.8], closed: false });
      ops.push({ kind: 'vector', polylines: ticks, powerPct: num(v, 'labelPower'), speed: num(v, 'labelSpeed'), passes: 1, label: true });
      for (let d = 0; d <= L + 1e-6; d += 10) ops.push(label(fmt(d), x + d, y, lh * 0.8, v));
      cells.push({ id: 'ramp', x0: x, y0: yl - 1, x1: x + L, y1: yl + 1, label: '', values: {} });
      return laserPlan(ops, cells, x, y, L, lh * 3 + 2);
    }
    // Z-steg: en kort linje per höjd (kräver motoriserad Z-axel).
    const zs = steps(num(v, 'zMin'), num(v, 'zMax'), num(v, 'count'), 2);
    const len = 30, rowH = lh * 2.2;
    zs.forEach((z, i) => {
      const yl = y + (zs.length - 1 - i) * rowH + lh * 0.6;
      ops.push({ kind: 'vector', polylines: [{ points: [x + 14, yl, x + 14 + len, yl], closed: false }], powerPct: num(v, 'power'), speed: num(v, 'speed'), passes: 1, z });
      ops.push(label(`Z${fmt(z, 1)}`, x + 12, yl - lh / 2, lh * 0.8, v, 'right'));
      cells.push({ id: `z${i}`, x0: x + 14, y0: yl - 1, x1: x + 14 + len, y1: yl + 1, label: `Z ${fmt(z, 1)}`, values: { z } });
    });
    // Tillbaka till Z 0 sist (före etiketterna graveras etiketterna på Z 0).
    const lab = ops.filter((o) => o.label);
    const lines = ops.filter((o) => !o.label);
    return laserPlan([...lab.map((o) => ({ ...o, z: 0 })), ...lines, { kind: 'vector', polylines: [], powerPct: 0, speed: 1000, passes: 1, z: 0 }], cells, x, y, len + 14, zs.length * rowH, { needsZ: true });
  },
};

const kerf: CalibrationTest = {
  id: 'laser-kerf',
  category: 'laser',
  params: [
    { key: 'size', kind: 'number', min: 10, max: 100, step: 1, def: 20, unit: 'mm' },
    { key: 'power', kind: 'number', min: 1, max: 100, step: 1, def: 100, unit: '%' },
    { key: 'speed', kind: 'number', min: 10, max: 20000, step: 10, def: 300, unit: 'mm/min' },
    { key: 'passes', kind: 'number', min: 1, max: 20, step: 1, def: 1, integer: true },
    ...LABELS,
    ...POS,
  ],
  build(v) {
    // En kvadrat skärs ut på linjen: biten blir en snittbredd mindre, hålet en snittbredd större.
    const N = num(v, 'size'), x = num(v, 'x'), y = num(v, 'y'), m = 8, lh = 3;
    const ops: LaserOp[] = [
      label(`${fmt(N)} mm`, x + m + N / 2, y + m + N + 2, lh, v),
      { kind: 'vector', polylines: [rectPl(x + m, y + m, x + m + N, y + m + N)], powerPct: num(v, 'power'), speed: num(v, 'speed'), passes: num(v, 'passes') },
    ];
    const plan = laserPlan(ops, [{ id: 'square', x0: x + m, y0: y + m, x1: x + m + N, y1: y + m + N, label: '', values: {} }], x, y, N + 2 * m, N + 2 * m + lh + 2);
    plan.measures = [
      { key: 'pieceX', nominal: N, unit: 'mm' },
      { key: 'pieceY', nominal: N, unit: 'mm' },
      { key: 'holeX', nominal: N, unit: 'mm' },
      { key: 'holeY', nominal: N, unit: 'mm' },
    ];
    return plan;
  },
  evaluate(plan, m) {
    return kerfFromSquare(plan.measures[0].nominal!, m, 'laserKerf');
  },
};

/**
 * Snittbredd ur en utskuren kvadrat: biten = N − k, hålet = N + k. Medelvärdet
 * av de mått som är ifyllda. Hålets och bitens skillnad ger också hur mycket
 * snittet varierar.
 */
export function kerfFromSquare(N: number, m: Record<string, number>, apply: 'laserKerf' | 'plasmaKerf'): CalOutcome[] {
  const ks: number[] = [];
  for (const k of ['pieceX', 'pieceY']) if (m[k] > 0) ks.push(N - m[k]);
  for (const k of ['holeX', 'holeY']) if (m[k] > 0) ks.push(m[k] - N);
  if (!ks.length) return [];
  const kerfMm = ks.reduce((a, b) => a + b, 0) / ks.length;
  const out: CalOutcome[] = [{ key: 'kerf', value: +kerfMm.toFixed(3), unit: 'mm', apply }];
  if (ks.length > 1) out.push({ key: 'kerfSpread', value: +(Math.max(...ks) - Math.min(...ks)).toFixed(3), unit: 'mm' });
  return out;
}

const interval: CalibrationTest = {
  id: 'laser-interval',
  category: 'laser',
  analyzable: true,
  params: [
    { key: 'intervalMin', kind: 'number', min: 0.02, max: 1, step: 0.01, def: 0.05, unit: 'mm' },
    { key: 'intervalMax', kind: 'number', min: 0.03, max: 2, step: 0.01, def: 0.3, unit: 'mm' },
    { key: 'count', kind: 'number', min: 2, max: 16, step: 1, def: 6, integer: true },
    { key: 'power', kind: 'number', min: 1, max: 100, step: 1, def: 40, unit: '%' },
    { key: 'speed', kind: 'number', min: 10, max: 20000, step: 50, def: 3000, unit: 'mm/min' },
    { key: 'cell', kind: 'number', min: 5, max: 40, step: 1, def: 12, unit: 'mm' },
    ...LABELS,
    ...POS,
  ],
  build(v) {
    const vals = steps(num(v, 'intervalMin'), num(v, 'intervalMax'), num(v, 'count'), 3);
    const cell = num(v, 'cell'), gap = Math.max(2, cell * 0.3), lh = Math.max(2.5, Math.min(5, cell * 0.22)), x = num(v, 'x'), y = num(v, 'y');
    const L = rowLayout(vals.length, cell, gap, lh, 8, x, y, lh * 2);
    const ops: LaserOp[] = [];
    const cells: CalCell[] = [];
    vals.forEach((iv, i) => {
      const r = L.at(i);
      ops.push(cellOp('engrave', r.x0, r.y0, r.x1, r.y1, num(v, 'power'), num(v, 'speed'), iv));
      ops.push(label(fmt(iv, 2), (r.x0 + r.x1) / 2, r.y0 - lh * 1.35, lh, v));
      cells.push({ id: `c${i}`, ...r, label: fmt(iv, 2), values: { interval: iv } });
    });
    ops.push(label(`S${fmt(num(v, 'power'))}% F${fmt(num(v, 'speed'))}`, x, y + L.height - lh, lh, v, 'left'));
    return laserPlan(ops, cells, x, y, L.width, L.height);
  },
};

const grayscale: CalibrationTest = {
  id: 'laser-grayscale',
  category: 'laser',
  analyzable: true,
  params: [
    { key: 'powerMin', kind: 'number', min: 0, max: 100, step: 1, def: 0, unit: '%' },
    { key: 'powerMax', kind: 'number', min: 1, max: 100, step: 1, def: 60, unit: '%' },
    { key: 'count', kind: 'number', min: 4, max: 32, step: 1, def: 16, integer: true },
    { key: 'speed', kind: 'number', min: 10, max: 20000, step: 50, def: 3000, unit: 'mm/min' },
    { key: 'interval', kind: 'number', min: 0.03, max: 1, step: 0.01, def: 0.1, unit: 'mm' },
    { key: 'cell', kind: 'number', min: 3, max: 20, step: 1, def: 6, unit: 'mm' },
    ...LABELS,
    ...POS,
  ],
  build(v) {
    // Tätt intill varandra (som i en bild): visar hela tonskalan i ett band.
    const vals = steps(num(v, 'powerMin'), num(v, 'powerMax'), num(v, 'count'));
    const cell = num(v, 'cell'), lh = 2.5, x = num(v, 'x'), y = num(v, 'y'), h = cell * 2.5;
    const ops: LaserOp[] = [];
    const cells: CalCell[] = [];
    vals.forEach((p, i) => {
      const x0 = x + i * cell;
      ops.push(cellOp('engrave', x0, y + lh * 1.8, x0 + cell, y + lh * 1.8 + h, p, num(v, 'speed'), num(v, 'interval')));
      if (i % Math.max(1, Math.round(vals.length / 8)) === 0 || i === vals.length - 1) ops.push(label(`${fmt(p)}`, x0 + cell / 2, y, lh, v));
      cells.push({ id: `g${i}`, x0, y0: y + lh * 1.8, x1: x0 + cell, y1: y + lh * 1.8 + h, label: `${fmt(p)}%`, values: { power: p } });
    });
    return laserPlan(ops, cells, x, y, vals.length * cell, h + lh * 1.8);
  },
};

const passes: CalibrationTest = {
  id: 'laser-passes',
  category: 'laser',
  params: [
    { key: 'passesMin', kind: 'number', min: 1, max: 30, step: 1, def: 1, integer: true },
    { key: 'passesMax', kind: 'number', min: 1, max: 30, step: 1, def: 5, integer: true },
    { key: 'power', kind: 'number', min: 1, max: 100, step: 1, def: 100, unit: '%' },
    { key: 'speed', kind: 'number', min: 10, max: 20000, step: 10, def: 400, unit: 'mm/min' },
    { key: 'cell', kind: 'number', min: 5, max: 40, step: 1, def: 12, unit: 'mm' },
    ...LABELS,
    ...POS,
  ],
  build(v) {
    const a = Math.round(num(v, 'passesMin')), b = Math.max(a, Math.round(num(v, 'passesMax')));
    const vals = Array.from({ length: Math.min(20, b - a + 1) }, (_, i) => a + i);
    const cell = num(v, 'cell'), gap = Math.max(3, cell * 0.4), lh = Math.max(2.5, Math.min(5, cell * 0.22)), x = num(v, 'x'), y = num(v, 'y');
    const L = rowLayout(vals.length, cell, gap, lh, 8, x, y, lh * 2);
    const ops: LaserOp[] = [];
    const cells: CalCell[] = [];
    vals.forEach((n, i) => {
      const r = L.at(i);
      ops.push(label(`${n}x`, (r.x0 + r.x1) / 2, r.y0 - lh * 1.35, lh, v));
      // Etiketten graveras före skärningen (annars kan biten falla ur först).
      ops.push(cellOp('cut', r.x0, r.y0, r.x1, r.y1, num(v, 'power'), num(v, 'speed'), 0.1, n));
      cells.push({ id: `p${n}`, ...r, label: `${n}x`, values: { passes: n } });
    });
    ops.push(label(`S${fmt(num(v, 'power'))}% F${fmt(num(v, 'speed'))}`, x, y + L.height - lh, lh, v, 'left'));
    return laserPlan(ops, cells, x, y, L.width, L.height);
  },
};

export const LASER_TESTS: CalibrationTest[] = [power, speed, matrix, focus, kerf, interval, grayscale, passes];

/* ───────── G-kod ───────── */

/**
 * Laserns G-kod för en plan, i maskinens dialekt (M4 med dynamisk effekt
 * eller M3). Effekten skrivs som S i maskinens skala (sMax), hastigheten som F.
 * Etiketterna graveras först, sedan rutorna – skärningar sist i varje ruta.
 */
export function laserCalibrationGcode(plan: CalibrationPlan, machine: MachineProfile): string {
  const p = machine.postprocessor;
  const f = (n: number) => formatNumber(n, p.decimals);
  const sMax = machine.laser?.sMax ?? 1000;
  const S = (pct: number) => f((Math.max(0, Math.min(100, pct)) / 100) * sMax);
  const out: string[] = ['; desktopCAM kalibrering – laser', ...p.header, 'G21', 'G90', `${p.laserDynamicPower ? 'M4' : 'M3'} S0`];
  let lastF = -1;
  const F = (v: number) => {
    if (Math.abs(v - lastF) < 1e-9) return '';
    lastF = v;
    return ` F${f(v)}`;
  };
  let pos: [number, number] | null = null;
  for (const op of plan.laser ?? []) {
    if (op.z !== undefined) out.push(`G0 Z${f(op.z)}`);
    if (!op.polylines.length) continue;
    if (!op.label) out.push(`; S${Math.round(op.powerPct)}% F${Math.round(op.speed)}${op.passes > 1 ? ` x${op.passes}` : ''}${op.kind === 'fill' ? ` interval ${op.interval}` : ''}`);
    for (let pass = 0; pass < Math.max(1, Math.round(op.passes)); pass++) {
      if (op.kind === 'fill' && op.rect && op.interval) {
        const { x0, y0, x1, y1 } = op.rect;
        const n = Math.max(1, Math.floor((y1 - y0) / op.interval));
        const step = (y1 - y0) / n;
        for (let i = 0; i < n; i++) {
          const yy = y0 + step * (i + 0.5);
          const [a, b] = i % 2 ? [x1, x0] : [x0, x1];
          // Nästa rad: laser av längs korta förflyttningen (jämn rörelse).
          if (pos && Math.hypot(pos[0] - a, pos[1] - yy) < 10) out.push(`G1 X${f(a)} Y${f(yy)} S0${F(op.speed)}`);
          else out.push(`G0 X${f(a)} Y${f(yy)} S0`);
          out.push(`G1 X${f(b)} S${S(op.powerPct)}${F(op.speed)}`);
          pos = [b, yy];
        }
        continue;
      }
      for (const pl of op.polylines) {
        const pts = pl.points;
        if (pts.length < 4) continue;
        out.push(`G0 X${f(pts[0])} Y${f(pts[1])} S0`);
        for (let k = 2; k + 1 < pts.length; k += 2) out.push(`G1 X${f(pts[k])} Y${f(pts[k + 1])} S${S(op.powerPct)}${F(op.speed)}`);
        if (pl.closed) out.push(`G1 X${f(pts[0])} Y${f(pts[1])} S${S(op.powerPct)}`);
        pos = pl.closed ? [pts[0], pts[1]] : [pts[pts.length - 2], pts[pts.length - 1]];
      }
    }
  }
  out.push('M5', ...p.footer);
  return out.join('\n') + '\n';
}

export { circlePl };
