/**
 * Kalibreringstester för plasma: skärhastighet, snittbredd, hål, hörn,
 * genomstickning, skärhöjd och höjdreglering (THC).
 *
 * G-koden kommer från appens plasmamotor (samma inlöp, genomstickning,
 * höjdavkänning och postprocessor som vanliga plasmabanor). Startvärdena
 * tas ur materialets skärtabell – inga egna, oprövade processdata.
 */
import { minHoleDiameter } from '../features';
import { defaultPlasmaSettings, plasmaGcode, type PlasmaSettings } from '../plasma';
import type { CutSide } from '../types';
import type { PolylineInput } from '../protocol';
import { combineGcodeParts } from './gcode';
import { circlePl, num, plShape, rectPl, steps, type CalCell, type CalibrationContext, type CalibrationPlan, type CalibrationTest, type CalParam, type CalValues } from './types';
import { kerfFromSquare } from './laser';

const BASE: CalParam[] = [
  { key: 'feed', kind: 'number', min: 50, max: 15000, step: 50, def: 2000, unit: 'mm/min' },
  { key: 'kerf', kind: 'number', min: 0.3, max: 5, step: 0.05, def: 1.5, unit: 'mm' },
  { key: 'pierceDelay', kind: 'number', min: 0, max: 5, step: 0.1, def: 0.4, unit: 's', advanced: true },
  { key: 'pierceHeight', kind: 'number', min: 0.5, max: 10, step: 0.1, def: 3.8, unit: 'mm', advanced: true },
  { key: 'cutHeight', kind: 'number', min: 0.3, max: 6, step: 0.1, def: 1.5, unit: 'mm', advanced: true },
];
const POS: CalParam[] = [
  { key: 'x', kind: 'number', min: 0, max: 3000, step: 1, def: 10, unit: 'mm', advanced: true },
  { key: 'y', kind: 'number', min: 0, max: 3000, step: 1, def: 10, unit: 'mm', advanced: true },
];

/** Startvärden ur skärtabellen. */
function chartDefaults(ctx: CalibrationContext): Partial<CalValues> {
  const c = ctx.plasma;
  return c ? { feed: c.feedRate, kerf: c.kerf, pierceDelay: c.pierceDelay, pierceHeight: c.pierceHeight, cutHeight: c.cutHeight } : {};
}

function settings(v: CalValues, ctx: CalibrationContext, patch: Partial<PlasmaSettings> = {}): PlasmaSettings {
  const s = defaultPlasmaSettings();
  return {
    ...s,
    pierceDelay: num(v, 'pierceDelay'),
    pierceHeight: num(v, 'pierceHeight'),
    cutHeight: num(v, 'cutHeight'),
    ihs: ctx.machine.plasma?.ihs ?? s.ihs,
    leadInLength: Math.max(3, Math.min(8, Math.round(ctx.thickness))),
    ...patch,
  };
}

function cut(groups: PolylineInput[][], side: CutSide, v: CalValues, ctx: CalibrationContext, patch: Partial<PlasmaSettings> = {}, feed = num(v, 'feed')): string {
  return plasmaGcode({
    groups,
    side,
    kerf: num(v, 'kerf'),
    feedRate: feed,
    plungeRate: 1000,
    settings: settings(v, ctx, patch),
    zAxis: ctx.machine.plasma?.zAxis ?? true,
    thickness: ctx.thickness,
    post: ctx.machine.postprocessor,
  });
}

function plan(x: number, y: number, width: number, height: number, cutPl: PolylineInput[], cells: CalCell[], gcodes: string[], ctx: CalibrationContext, extra: Partial<CalibrationPlan> = {}): CalibrationPlan {
  return { x, y, width, height, cells, measures: [], gcode: combineGcodeParts(gcodes, ctx.machine.postprocessor), layers: [{ name: 'cut', color: '#d1242f', shapes: [plShape('cut', cutPl)] }], ...extra };
}

const line = (x0: number, y0: number, x1: number, y1: number): PolylineInput => ({ points: [x0, y0, x1, y1], closed: false });

const speed: CalibrationTest = {
  id: 'plasma-speed',
  category: 'plasma',
  params: [
    { key: 'feedMin', kind: 'number', min: 50, max: 15000, step: 50, def: 1500, unit: 'mm/min' },
    { key: 'feedMax', kind: 'number', min: 50, max: 15000, step: 50, def: 2500, unit: 'mm/min' },
    { key: 'count', kind: 'number', min: 2, max: 10, step: 1, def: 5, integer: true },
    { key: 'length', kind: 'number', min: 30, max: 300, step: 10, def: 80, unit: 'mm' },
    ...BASE.filter((p) => p.key !== 'feed'),
    ...POS,
  ],
  defaults: (ctx) => {
    const f = ctx.plasma?.feedRate ?? 2000;
    return { ...chartDefaults(ctx), feedMin: Math.round((f * 0.75) / 50) * 50, feedMax: Math.round((f * 1.25) / 50) * 50 };
  },
  build(v, ctx) {
    // Raka snitt med olika hastighet, minst 15 mm isär: jämför slagg och snittvinkel.
    const fs = steps(num(v, 'feedMin'), num(v, 'feedMax'), num(v, 'count'));
    const L = num(v, 'length'), x = num(v, 'x'), y = num(v, 'y'), gap = Math.max(15, ctx.thickness * 3);
    const cells: CalCell[] = [];
    const pls: PolylineInput[] = [];
    const gc: string[] = [];
    fs.forEach((f, i) => {
      const yy = y + i * gap;
      const pl = line(x, yy, x + L, yy);
      pls.push(pl);
      gc.push(cut([[pl]], 'on', v, ctx, { leadIn: 'none', leadOut: 'none' }, f));
      cells.push({ id: `f${i}`, x0: x, y0: yy - gap / 2, x1: x + L, y1: yy + gap / 2, label: `F${f}`, values: { feed: f } });
    });
    return plan(x, y, L, (fs.length - 1) * gap, pls, cells, gc, ctx);
  },
};

const kerf: CalibrationTest = {
  id: 'plasma-kerf',
  category: 'plasma',
  params: [{ key: 'size', kind: 'number', min: 20, max: 150, step: 5, def: 50, unit: 'mm' }, ...BASE, ...POS],
  defaults: chartDefaults,
  build(v, ctx) {
    // En kvadrat på linjen (ingen kompensation): biten blir en snittbredd mindre.
    const N = num(v, 'size'), x = num(v, 'x'), y = num(v, 'y');
    const sq = rectPl(x, y, x + N, y + N);
    // "På linjen" ger ingen kompensation; inlöpet hamnar utanför biten.
    const p = plan(x, y, N, N, [sq], [{ id: 'square', x0: x, y0: y, x1: x + N, y1: y + N, label: '', values: {} }], [cut([[sq]], 'on', v, ctx)], ctx);
    p.measures = [
      { key: 'pieceX', nominal: N, unit: 'mm' },
      { key: 'pieceY', nominal: N, unit: 'mm' },
      { key: 'holeX', nominal: N, unit: 'mm' },
      { key: 'holeY', nominal: N, unit: 'mm' },
    ];
    return p;
  },
  evaluate(p, m) {
    return kerfFromSquare(p.measures[0].nominal!, m, 'plasmaKerf');
  },
};

const holes: CalibrationTest = {
  id: 'plasma-holes',
  category: 'plasma',
  params: [
    { key: 'holeMin', kind: 'number', min: 2, max: 100, step: 0.5, def: 6, unit: 'mm' },
    { key: 'holeMax', kind: 'number', min: 3, max: 150, step: 0.5, def: 25, unit: 'mm' },
    { key: 'count', kind: 'number', min: 2, max: 8, step: 1, def: 5, integer: true },
    ...BASE,
    ...POS,
  ],
  defaults: (ctx) => {
    const c = chartDefaults(ctx);
    const min = Math.ceil(minHoleDiameter('plasma', Number(c.kerf ?? 1.5), ctx.thickness));
    return { ...c, holeMin: min, holeMax: Math.max(min + 10, Math.round(ctx.thickness * 5)) };
  },
  build(v, ctx) {
    // En provbit med hål i olika storlek: mät hålen och jämför rundhet och konicitet.
    const ds = steps(num(v, 'holeMin'), num(v, 'holeMax'), num(v, 'count'), 1);
    const x = num(v, 'x'), y = num(v, 'y'), pad = Math.max(10, ctx.thickness * 3);
    const big = Math.max(...ds);
    let cx = x + pad;
    const cells: CalCell[] = [];
    const hs: PolylineInput[] = [];
    ds.forEach((d, i) => {
      const c = cx + d / 2, cy = y + pad + big / 2;
      hs.push(circlePl(c, cy, d / 2));
      cells.push({ id: `h${i}`, x0: c - d / 2, y0: cy - d / 2, x1: c + d / 2, y1: cy + d / 2, label: `Ø${d}`, values: { diameter: d } });
      cx += d + pad;
    });
    const plate = rectPl(x, y, cx, y + big + 2 * pad);
    const p = plan(x, y, cx - x, big + 2 * pad, [plate, ...hs], cells, [cut([[plate, ...hs]], 'outside', v, ctx, { smallHoles: 'contour' })], ctx);
    p.measures = ds.map((d, i) => ({ key: `hole${i}`, nominal: d, unit: 'mm' as const }));
    return p;
  },
  evaluate(p, m) {
    const errs = p.measures.map((ms) => (m[ms.key] > 0 ? m[ms.key] - ms.nominal! : NaN)).filter(Number.isFinite);
    if (!errs.length) return [];
    return [{ key: 'holeError', value: +(errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(3), unit: 'mm' }];
  },
};

const corners: CalibrationTest = {
  id: 'plasma-corners',
  category: 'plasma',
  params: [{ key: 'size', kind: 'number', min: 40, max: 200, step: 5, def: 80, unit: 'mm' }, ...BASE, ...POS],
  defaults: chartDefaults,
  build(v, ctx) {
    // Samma sågtandade bit två gånger: utan och med inbromsning i hörnen.
    // Tänderna ger 90°, 60° och 30° hörn.
    const S = num(v, 'size'), x = num(v, 'x'), y = num(v, 'y'), h = S * 0.5, gap = Math.max(15, ctx.thickness * 3);
    const piece = (ox: number): PolylineInput => {
      const t = S / 6;
      return {
        points: [ox, y, ox + S, y, ox + S, y + h, ox + 5 * t, y + h, ox + 4.5 * t, y + h * 0.55, ox + 4 * t, y + h, ox + 3 * t, y + h, ox + 2.9 * t, y + h * 0.4, ox + 2 * t, y + h, ox + t, y + h, ox + t, y + h * 0.6, ox, y + h * 0.6],
        closed: true,
      };
    };
    const a = piece(x), b = piece(x + S + gap);
    return plan(
      x,
      y,
      2 * S + gap,
      h,
      [a, b],
      [
        { id: 'off', x0: x, y0: y, x1: x + S, y1: y + h, label: 'A', values: { cornerSlowdown: 0 } },
        { id: 'on', x0: x + S + gap, y0: y, x1: x + 2 * S + gap, y1: y + h, label: 'B', values: { cornerSlowdown: 1 } },
      ],
      [cut([[a]], 'outside', v, ctx, { cornerSlowdown: false }), cut([[b]], 'outside', v, ctx, { cornerSlowdown: true })],
      ctx,
    );
  },
};

const pierce: CalibrationTest = {
  id: 'plasma-pierce',
  category: 'plasma',
  params: [
    { key: 'delayMin', kind: 'number', min: 0, max: 5, step: 0.1, def: 0.1, unit: 's' },
    { key: 'delayMax', kind: 'number', min: 0.1, max: 5, step: 0.1, def: 1, unit: 's' },
    { key: 'count', kind: 'number', min: 2, max: 10, step: 1, def: 5, integer: true },
    ...BASE.filter((p) => p.key !== 'pierceDelay'),
    ...POS,
  ],
  defaults: (ctx) => {
    const d = ctx.plasma?.pierceDelay ?? 0.4;
    return { ...chartDefaults(ctx), delayMin: +Math.max(0, d * 0.5).toFixed(1), delayMax: +Math.max(0.2, d * 2).toFixed(1) };
  },
  build(v, ctx) {
    // Korta snitt som var och en börjar med en genomstickning med olika väntetid.
    const ds = steps(num(v, 'delayMin'), num(v, 'delayMax'), num(v, 'count'), 2);
    const x = num(v, 'x'), y = num(v, 'y'), L = 20, gap = Math.max(15, ctx.thickness * 3);
    const cells: CalCell[] = [];
    const pls: PolylineInput[] = [];
    const gc: string[] = [];
    ds.forEach((d, i) => {
      const xx = x + i * gap;
      const pl = line(xx, y, xx, y + L);
      pls.push(pl);
      gc.push(cut([[pl]], 'on', { ...v, pierceDelay: d }, ctx, { leadIn: 'none', leadOut: 'none' }));
      cells.push({ id: `p${i}`, x0: xx - gap / 2, y0: y, x1: xx + gap / 2, y1: y + L, label: `${d}s`, values: { pierceDelay: d } });
    });
    return plan(x, y, (ds.length - 1) * gap, L, pls, cells, gc, ctx);
  },
};

const height: CalibrationTest = {
  id: 'plasma-height',
  category: 'plasma',
  params: [
    { key: 'heightMin', kind: 'number', min: 0.3, max: 6, step: 0.1, def: 0.8, unit: 'mm' },
    { key: 'heightMax', kind: 'number', min: 0.5, max: 8, step: 0.1, def: 3, unit: 'mm' },
    { key: 'count', kind: 'number', min: 2, max: 8, step: 1, def: 5, integer: true },
    { key: 'length', kind: 'number', min: 30, max: 300, step: 10, def: 60, unit: 'mm' },
    ...BASE.filter((p) => p.key !== 'cutHeight'),
    ...POS,
  ],
  defaults: (ctx) => {
    const h = ctx.plasma?.cutHeight ?? 1.5;
    return { ...chartDefaults(ctx), heightMin: +Math.max(0.5, h - 0.7).toFixed(1), heightMax: +(h + 1).toFixed(1) };
  },
  build(v, ctx) {
    // Raka snitt på olika skärhöjd (kräver motoriserad Z-axel): jämför snittvinkeln.
    const hs = steps(num(v, 'heightMin'), num(v, 'heightMax'), num(v, 'count'), 1);
    const L = num(v, 'length'), x = num(v, 'x'), y = num(v, 'y'), gap = Math.max(15, ctx.thickness * 3);
    const cells: CalCell[] = [];
    const pls: PolylineInput[] = [];
    const gc: string[] = [];
    hs.forEach((h, i) => {
      const yy = y + i * gap;
      const pl = line(x, yy, x + L, yy);
      pls.push(pl);
      gc.push(cut([[pl]], 'on', v, ctx, { cutHeight: h, leadIn: 'none', leadOut: 'none' }));
      cells.push({ id: `z${i}`, x0: x, y0: yy - gap / 2, x1: x + L, y1: yy + gap / 2, label: `${h} mm`, values: { cutHeight: h } });
    });
    return plan(x, y, L, (hs.length - 1) * gap, pls, cells, gc, ctx, { needsZ: true });
  },
};

const thc: CalibrationTest = {
  id: 'plasma-thc',
  category: 'plasma',
  params: [{ key: 'length', kind: 'number', min: 100, max: 1000, step: 10, def: 300, unit: 'mm' }, ...BASE, ...POS],
  defaults: chartDefaults,
  build(v, ctx) {
    // Ett långt rakt snitt med höjdregleringen påslagen hela vägen (inga hål,
    // ingen inbromsning): följer brännaren plåten jämnt, eller dyker den?
    const L = num(v, 'length'), x = num(v, 'x'), y = num(v, 'y');
    const pl = line(x, y, x + L, y);
    return plan(x, y, L, 0, [pl], [{ id: 'line', x0: x, y0: y - 5, x1: x + L, y1: y + 5, label: '', values: {} }], [cut([[pl]], 'on', v, ctx, { cornerSlowdown: false, thcOffInHoles: false })], ctx);
  },
};

export const PLASMA_TESTS: CalibrationTest[] = [speed, kerf, holes, corners, pierce, height, thc];
