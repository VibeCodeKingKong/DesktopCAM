/**
 * Kalibreringstester för fräs: måttnoggrannhet, spårbredd (verkligt
 * fräsdiameter), djup, matning, ytfinish, planfräsning för spindelns
 * vinkel och en cirkel för glapp och axlarnas skala.
 *
 * G-koden kommer från appens vanliga banmotorer (profil, ficka, planfräsning),
 * så den följer samma postprocessor och säkerhetsregler som andra banor.
 */
import { facingGcode, pocketGcode } from '../camOps';
import { defaultStrategy, defaultTabs, routerProfileGcode } from '../profileStrategy';
import type { CutSide, MachineProfile } from '../types';
import type { PolylineInput } from '../protocol';
import { combineGcodeParts } from './gcode';
import { circlePl, num, plShape, rectPl, steps, type CalCell, type CalibrationContext, type CalibrationPlan, type CalibrationTest, type CalOutcome, type CalParam, type CalValues } from './types';

const CUT: CalParam[] = [
  { key: 'depth', kind: 'number', min: 0.1, max: 50, step: 0.1, def: 3, unit: 'mm' },
  { key: 'stepDown', kind: 'number', min: 0.1, max: 20, step: 0.1, def: 1.5, unit: 'mm', advanced: true },
  { key: 'feed', kind: 'number', min: 10, max: 20000, step: 50, def: 1000, unit: 'mm/min' },
  { key: 'plunge', kind: 'number', min: 10, max: 5000, step: 10, def: 300, unit: 'mm/min', advanced: true },
  { key: 'rpm', kind: 'number', min: 0, max: 60000, step: 500, def: 18000, unit: 'rpm', advanced: true },
];
const POS: CalParam[] = [
  { key: 'x', kind: 'number', min: 0, max: 3000, step: 1, def: 10, unit: 'mm', advanced: true },
  { key: 'y', kind: 'number', min: 0, max: 3000, step: 1, def: 10, unit: 'mm', advanced: true },
];

/** Startvärden ur verktyget och materialet; djupet högst halva tjockleken. */
function cutDefaults(ctx: CalibrationContext): Partial<CalValues> {
  const r = ctx.router;
  return {
    depth: Math.min(3, Math.max(0.5, ctx.thickness / 2)),
    ...(r ? { feed: r.feedRate, plunge: r.plungeRate, rpm: r.spindleRpm, stepDown: r.stepDown } : {}),
  };
}

const D = (ctx: CalibrationContext) => {
  if (!(ctx.toolDiameter && ctx.toolDiameter > 0)) throw new Error('NO_TOOL');
  return ctx.toolDiameter;
};

/** Profilbana (utsida, insida eller på linjen) med appens profilmotor. */
function profile(groups: PolylineInput[][], side: CutSide, v: CalValues, ctx: CalibrationContext, feed = num(v, 'feed')): string {
  return routerProfileGcode({
    groups,
    side,
    toolDiameter: D(ctx),
    cutDepth: num(v, 'depth'),
    stepDown: num(v, 'stepDown'),
    feedRate: feed,
    plungeRate: num(v, 'plunge'),
    spindleRpm: num(v, 'rpm'),
    // Inget finpass: provet ska visa vad fräsen gör i ett enda djup per pass.
    strategy: { ...defaultStrategy('fast'), entry: 'plunge' },
    tabs: { ...defaultTabs(false, ctx.thickness), enabled: false },
    post: ctx.machine.postprocessor,
  });
}

/** Ficka (konturparallell) med appens fickmotor. */
function pocket(groups: PolylineInput[][], v: CalValues, ctx: CalibrationContext, depth = num(v, 'depth'), stepOver = 0.45, feed = num(v, 'feed')): string {
  return pocketGcode({ groups, toolDiameter: D(ctx), stepOver, cutDepth: depth, stepDown: num(v, 'stepDown'), feedRate: feed, plungeRate: num(v, 'plunge'), spindleRpm: num(v, 'rpm'), post: ctx.machine.postprocessor });
}

function plan(x: number, y: number, width: number, height: number, cut: PolylineInput[], cells: CalCell[], gcodes: string[], machine: MachineProfile, measures: CalibrationPlan['measures'] = []): CalibrationPlan {
  return {
    x,
    y,
    width,
    height,
    cells,
    measures,
    gcode: combineGcodeParts(gcodes, machine.postprocessor),
    layers: [{ name: 'cut', color: '#d1242f', shapes: [plShape('cut', cut)] }],
  };
}

/** Effektiv fräsdiameter: utvändigt mått blir mindre, invändigt större, med (verklig − nominell) diameter. */
function effectiveDiameter(nominalTool: number, pairs: { nominal: number; measured: number; inside: boolean }[]): CalOutcome[] {
  const ds = pairs.filter((p) => p.measured > 0).map((p) => nominalTool + (p.inside ? p.measured - p.nominal : p.nominal - p.measured));
  if (!ds.length) return [];
  const avg = ds.reduce((a, b) => a + b, 0) / ds.length;
  return [
    { key: 'toolDiameter', value: +avg.toFixed(3), unit: 'mm', apply: 'toolDiameter' },
    { key: 'toolDiameterChange', value: +(avg - nominalTool).toFixed(3), unit: 'mm' },
  ];
}

const accuracy: CalibrationTest = {
  id: 'router-accuracy',
  category: 'router',
  params: [{ key: 'size', kind: 'number', min: 10, max: 100, step: 1, def: 30, unit: 'mm' }, ...CUT, ...POS],
  defaults: cutDefaults,
  build(v, ctx) {
    // Utvändig kvadrat (tapp), invändig kvadrat (ficka) och ett runt hål.
    const N = num(v, 'size'), x = num(v, 'x'), y = num(v, 'y'), d = D(ctx), gap = Math.max(10, 2 * d + 4);
    const boss = rectPl(x + d + 2, y + d + 2, x + d + 2 + N, y + d + 2 + N);
    const x2 = x + 2 * d + 4 + N + gap;
    const inner = rectPl(x2, y + d + 2, x2 + N, y + d + 2 + N);
    const x3 = x2 + N + gap;
    const hole = circlePl(x3 + N / 2, y + d + 2 + N / 2, N / 2);
    const width = x3 + N - x + 2, height = N + 2 * d + 4;
    return plan(
      x,
      y,
      width,
      height,
      [boss, inner, hole],
      [
        { id: 'outer', x0: x + d + 2, y0: y + d + 2, x1: x + d + 2 + N, y1: y + d + 2 + N, label: 'A', values: {} },
        { id: 'inner', x0: x2, y0: y + d + 2, x1: x2 + N, y1: y + d + 2 + N, label: 'B', values: {} },
        { id: 'hole', x0: x3, y0: y + d + 2, x1: x3 + N, y1: y + d + 2 + N, label: 'C', values: {} },
      ],
      [profile([[boss]], 'outside', v, ctx), pocket([[inner]], v, ctx), pocket([[hole]], v, ctx)],
      ctx.machine,
      [
        { key: 'outerX', nominal: N, unit: 'mm' },
        { key: 'outerY', nominal: N, unit: 'mm' },
        { key: 'innerX', nominal: N, unit: 'mm' },
        { key: 'innerY', nominal: N, unit: 'mm' },
        { key: 'holeX', nominal: N, unit: 'mm' },
        { key: 'holeY', nominal: N, unit: 'mm' },
      ],
    );
  },
  evaluate(p, m, _v, ctx) {
    const N = p.measures[0].nominal!;
    const out = effectiveDiameter(D(ctx), [
      { nominal: N, measured: m.outerX, inside: false },
      { nominal: N, measured: m.outerY, inside: false },
      { nominal: N, measured: m.innerX, inside: true },
      { nominal: N, measured: m.innerY, inside: true },
      { nominal: N, measured: m.holeX, inside: true },
      { nominal: N, measured: m.holeY, inside: true },
    ]);
    // Skillnad mellan axlarna (samma fräs, så skillnaden kommer från maskinen: steg/mm eller glapp).
    const pairs = [[m.outerX, m.outerY], [m.innerX, m.innerY], [m.holeX, m.holeY]].filter(([a, b]) => a > 0 && b > 0).map(([a, b]) => a - b);
    if (pairs.length) out.push({ key: 'axisDiff', value: +(pairs.reduce((a, b) => a + b, 0) / pairs.length).toFixed(3), unit: 'mm' });
    return out;
  },
};

const slot: CalibrationTest = {
  id: 'router-slot',
  category: 'router',
  params: [{ key: 'length', kind: 'number', min: 10, max: 200, step: 1, def: 40, unit: 'mm' }, ...CUT, ...POS],
  defaults: cutDefaults,
  build(v, ctx) {
    // Ett rakt spår i X och ett i Y: spårets bredd = fräsens verkliga skärdiameter.
    const L = num(v, 'length'), x = num(v, 'x'), y = num(v, 'y'), d = D(ctx);
    const sx: PolylineInput = { points: [x + d, y + d, x + d + L, y + d], closed: false };
    const sy: PolylineInput = { points: [x + d + L + 3 * d + 6, y + d, x + d + L + 3 * d + 6, y + d + L], closed: false };
    return plan(
      x,
      y,
      L + 4 * d + 6,
      L + 2 * d,
      [sx, sy],
      [
        { id: 'x', x0: x, y0: y, x1: x + 2 * d + L, y1: y + 2 * d, label: 'X', values: {} },
        { id: 'y', x0: x + L + 2 * d + 6, y0: y, x1: x + L + 4 * d + 6, y1: y + L + 2 * d, label: 'Y', values: {} },
      ],
      [profile([[sx]], 'on', v, ctx), profile([[sy]], 'on', v, ctx)],
      ctx.machine,
      [
        { key: 'slotX', nominal: d, unit: 'mm' },
        { key: 'slotY', nominal: d, unit: 'mm' },
      ],
    );
  },
  evaluate(_p, m, _v, ctx) {
    const w = [m.slotX, m.slotY].filter((x) => x > 0);
    if (!w.length) return [];
    const avg = w.reduce((a, b) => a + b, 0) / w.length;
    const out: CalOutcome[] = [
      { key: 'toolDiameter', value: +avg.toFixed(3), unit: 'mm', apply: 'toolDiameter' },
      { key: 'toolDiameterChange', value: +(avg - D(ctx)).toFixed(3), unit: 'mm' },
    ];
    if (w.length === 2) out.push({ key: 'axisDiff', value: +(m.slotX - m.slotY).toFixed(3), unit: 'mm' });
    return out;
  },
};

const depth: CalibrationTest = {
  id: 'router-depth',
  category: 'router',
  params: [
    { key: 'depthMin', kind: 'number', min: 0.1, max: 30, step: 0.1, def: 1, unit: 'mm' },
    { key: 'depthMax', kind: 'number', min: 0.2, max: 50, step: 0.1, def: 5, unit: 'mm' },
    { key: 'count', kind: 'number', min: 2, max: 8, step: 1, def: 5, integer: true },
    { key: 'size', kind: 'number', min: 8, max: 40, step: 1, def: 14, unit: 'mm' },
    ...CUT.filter((p) => p.key !== 'depth'),
    ...POS,
  ],
  defaults: (ctx) => ({ ...cutDefaults(ctx), depthMax: Math.min(5, Math.max(1, ctx.thickness * 0.6)), depthMin: Math.min(1, ctx.thickness * 0.2) }),
  build(v, ctx) {
    // Fickor med stigande djup: mät djupet med skjutmått för att kontrollera Z.
    const ds = steps(num(v, 'depthMin'), num(v, 'depthMax'), num(v, 'count'), 2);
    const S = num(v, 'size'), x = num(v, 'x'), y = num(v, 'y'), gap = Math.max(6, D(ctx) + 4);
    const cells: CalCell[] = [];
    const cut: PolylineInput[] = [];
    const gc: string[] = [];
    ds.forEach((dd, i) => {
      const x0 = x + i * (S + gap);
      const r = rectPl(x0, y, x0 + S, y + S);
      cut.push(r);
      gc.push(pocket([[r]], v, ctx, dd));
      cells.push({ id: `d${i}`, x0, y0: y, x1: x0 + S, y1: y + S, label: `${dd}`, values: { depth: dd } });
    });
    return plan(x, y, ds.length * (S + gap) - gap, S, cut, cells, gc, ctx.machine, ds.map((dd, i) => ({ key: `depth${i}`, nominal: dd, unit: 'mm' as const })));
  },
  evaluate(p, m) {
    const pairs = p.measures.map((ms) => ({ n: ms.nominal!, m: m[ms.key] })).filter((q) => q.m > 0);
    if (!pairs.length) return [];
    const err = pairs.reduce((a, q) => a + (q.m - q.n), 0) / pairs.length;
    const out: CalOutcome[] = [{ key: 'depthError', value: +err.toFixed(3), unit: 'mm' }];
    if (pairs.length >= 2) {
      // Lutning (verkligt / nominellt): ≠ 1 tyder på fel steg/mm i Z, en konstant skillnad på nollställningen.
      const mx = pairs.reduce((a, q) => a + q.n, 0) / pairs.length, my = pairs.reduce((a, q) => a + q.m, 0) / pairs.length;
      const num_ = pairs.reduce((a, q) => a + (q.n - mx) * (q.m - my), 0), den = pairs.reduce((a, q) => a + (q.n - mx) ** 2, 0);
      if (den > 1e-9) out.push({ key: 'zScale', value: +(num_ / den).toFixed(4), unit: '' });
    }
    return out;
  },
};

const feed: CalibrationTest = {
  id: 'router-feed',
  category: 'router',
  params: [
    { key: 'feedMin', kind: 'number', min: 10, max: 20000, step: 50, def: 500, unit: 'mm/min' },
    { key: 'feedMax', kind: 'number', min: 20, max: 20000, step: 50, def: 2500, unit: 'mm/min' },
    { key: 'count', kind: 'number', min: 2, max: 10, step: 1, def: 5, integer: true },
    { key: 'length', kind: 'number', min: 20, max: 200, step: 5, def: 50, unit: 'mm' },
    ...CUT.filter((p) => p.key !== 'feed'),
    ...POS,
  ],
  defaults: (ctx) => {
    const base = cutDefaults(ctx), f = ctx.router?.feedRate ?? 1000;
    return { ...base, feedMin: Math.round(f * 0.5), feedMax: Math.round(f * 1.5) };
  },
  build(v, ctx) {
    // Ett spår per matning: jämför ytan, kanterna, ljudet och spånen.
    const fs = steps(num(v, 'feedMin'), num(v, 'feedMax'), num(v, 'count'));
    const L = num(v, 'length'), x = num(v, 'x'), y = num(v, 'y'), d = D(ctx), gap = 2 * d + 6;
    const cells: CalCell[] = [];
    const cut: PolylineInput[] = [];
    const gc: string[] = [];
    fs.forEach((fr, i) => {
      const yy = y + d + i * gap;
      const pl: PolylineInput = { points: [x + d, yy, x + d + L, yy], closed: false };
      cut.push(pl);
      gc.push(profile([[pl]], 'on', v, ctx, fr));
      cells.push({ id: `f${i}`, x0: x, y0: yy - d, x1: x + L + 2 * d, y1: yy + d, label: `F${fr}`, values: { feed: fr } });
    });
    return plan(x, y, L + 2 * d, fs.length * gap - gap + 2 * d, cut, cells, gc, ctx.machine);
  },
};

const finish: CalibrationTest = {
  id: 'router-finish',
  category: 'router',
  params: [
    { key: 'stepOverMin', kind: 'number', min: 5, max: 90, step: 5, def: 15, unit: '%' },
    { key: 'stepOverMax', kind: 'number', min: 10, max: 95, step: 5, def: 60, unit: '%' },
    { key: 'count', kind: 'number', min: 2, max: 8, step: 1, def: 4, integer: true },
    { key: 'size', kind: 'number', min: 10, max: 60, step: 1, def: 25, unit: 'mm' },
    ...CUT,
    ...POS,
  ],
  defaults: (ctx) => ({ ...cutDefaults(ctx), depth: Math.min(1, ctx.thickness / 4) }),
  build(v, ctx) {
    // Fickor med olika sidosteg: jämför ytans räfflor och tiden.
    const so = steps(num(v, 'stepOverMin'), num(v, 'stepOverMax'), num(v, 'count'));
    const S = num(v, 'size'), x = num(v, 'x'), y = num(v, 'y'), gap = Math.max(6, D(ctx) + 4);
    const cells: CalCell[] = [];
    const cut: PolylineInput[] = [];
    const gc: string[] = [];
    so.forEach((s, i) => {
      const x0 = x + i * (S + gap);
      const r = rectPl(x0, y, x0 + S, y + S);
      cut.push(r);
      gc.push(pocket([[r]], v, ctx, num(v, 'depth'), s / 100));
      cells.push({ id: `s${i}`, x0, y0: y, x1: x0 + S, y1: y + S, label: `${s}%`, values: { stepOver: s } });
    });
    return plan(x, y, so.length * (S + gap) - gap, S, cut, cells, gc, ctx.machine);
  },
};

const tram: CalibrationTest = {
  id: 'router-tram',
  category: 'router',
  params: [
    { key: 'width', kind: 'number', min: 30, max: 1000, step: 10, def: 120, unit: 'mm' },
    { key: 'height', kind: 'number', min: 30, max: 1000, step: 10, def: 120, unit: 'mm' },
    { key: 'depth', kind: 'number', min: 0.05, max: 2, step: 0.05, def: 0.2, unit: 'mm' },
    { key: 'stepOver', kind: 'number', min: 10, max: 90, step: 5, def: 70, unit: '%' },
    ...CUT.filter((p) => p.key !== 'depth' && p.key !== 'stepDown'),
    ...POS,
  ],
  defaults: (ctx) => ({ ...cutDefaults(ctx), depth: 0.2 }),
  build(v, ctx) {
    // Planfräsning med stor fräs och litet djup: lutar spindeln syns det som
    // bågformiga räfflor eller ett trappsteg mellan raderna.
    const W = num(v, 'width'), H = num(v, 'height'), x = num(v, 'x'), y = num(v, 'y');
    const gcode = facingGcode({ x0: x, y0: y, x1: x + W, y1: y + H, toolDiameter: D(ctx), stepOver: num(v, 'stepOver') / 100, depth: num(v, 'depth'), stepDown: num(v, 'depth'), feedRate: num(v, 'feed'), plungeRate: num(v, 'plunge'), spindleRpm: num(v, 'rpm'), direction: 'x', overhang: 0, pattern: 'zigzag', post: ctx.machine.postprocessor } as Parameters<typeof facingGcode>[0]);
    return plan(x, y, W, H, [rectPl(x, y, x + W, y + H)], [{ id: 'area', x0: x, y0: y, x1: x + W, y1: y + H, label: '', values: {} }], [gcode], ctx.machine);
  },
};

const circle: CalibrationTest = {
  id: 'router-circle',
  category: 'router',
  params: [{ key: 'size', kind: 'number', min: 10, max: 200, step: 1, def: 50, unit: 'mm' }, ...CUT, ...POS],
  defaults: cutDefaults,
  build(v, ctx) {
    // Cirkel utvändigt: mät diametern i X och Y. Glapp ger platta partier där
    // en axel byter riktning; olika mått i X och Y tyder på fel steg/mm.
    const N = num(v, 'size'), x = num(v, 'x'), y = num(v, 'y'), d = D(ctx);
    const c = circlePl(x + d + 2 + N / 2, y + d + 2 + N / 2, N / 2);
    return plan(x, y, N + 2 * d + 4, N + 2 * d + 4, [c], [{ id: 'circle', x0: x + d + 2, y0: y + d + 2, x1: x + d + 2 + N, y1: y + d + 2 + N, label: '', values: {} }], [profile([[c]], 'outside', v, ctx)], ctx.machine, [
      { key: 'circleX', nominal: N, unit: 'mm' },
      { key: 'circleY', nominal: N, unit: 'mm' },
    ]);
  },
  evaluate(p, m) {
    const N = p.measures[0].nominal!;
    const out: CalOutcome[] = [];
    if (m.circleX > 0) out.push({ key: 'errorX', value: +(m.circleX - N).toFixed(3), unit: 'mm' });
    if (m.circleY > 0) out.push({ key: 'errorY', value: +(m.circleY - N).toFixed(3), unit: 'mm' });
    if (m.circleX > 0 && m.circleY > 0) out.push({ key: 'axisDiff', value: +(m.circleX - m.circleY).toFixed(3), unit: 'mm' });
    return out;
  },
};

export const ROUTER_TESTS: CalibrationTest[] = [accuracy, slot, depth, feed, finish, tram, circle];
