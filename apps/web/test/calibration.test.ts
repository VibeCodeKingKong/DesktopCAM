/**
 * Kalibrering: varje prov byggs med standardvärden för en verklig maskin av
 * rätt typ och kontrolleras – planen, G-koden och säkerhetsreglerna.
 */
import { describe, expect, it } from 'vitest';
import {
  analyzeGrid,
  bestCells,
  CALIBRATION_TESTS,
  calibrationGcode,
  defaultValues,
  findCalibrationTest,
  hasErrors,
  parseGcode,
  validateGcode,
  validatePlan,
  type CalibrationCategory,
  type CalibrationContext,
  type MachineProfile,
} from '@desktopcam/core';
import machines from '../src/data/machines.json';

const M = machines as unknown as MachineProfile[];
const machineFor: Record<CalibrationCategory, MachineProfile> = {
  laser: M.find((m) => m.id === 'creality-falcon2-22w')!,
  router: M.find((m) => m.id === 'genmitsu-4040-pro')!,
  plasma: M.find((m) => m.id === 'langmuir-crossfire-pro')!,
};
const ctxFor = (c: CalibrationCategory): CalibrationContext => ({
  machine: machineFor[c],
  thickness: c === 'plasma' ? 3 : c === 'router' ? 12 : 3,
  toolDiameter: c === 'router' ? 3.175 : undefined,
  router: { feedRate: 1200, plungeRate: 300, spindleRpm: 18000, stepDown: 1.5 },
  plasma: { feedRate: 2050, kerf: 1.5, pierceDelay: 0.4, pierceHeight: 3.8, cutHeight: 1.5 },
});

describe('kalibreringsprov', () => {
  for (const [cat, tests] of Object.entries(CALIBRATION_TESTS) as [CalibrationCategory, typeof CALIBRATION_TESTS.laser][]) {
    for (const test of tests) {
      it(`${test.id}: standardvärden ger giltig G-kod`, () => {
        const ctx = ctxFor(cat);
        const v = defaultValues(test, ctx);
        const plan = test.build(v, ctx);
        expect(plan.width).toBeGreaterThan(0);
        expect(plan.layers.length).toBeGreaterThan(0);
        const issues = validatePlan(cat, v, plan, ctx);
        // Fokus med Z-steg kräver Z-axel; standard är rampen.
        expect(issues.filter((i) => i.level === 'error'), JSON.stringify(issues)).toEqual([]);
        const g = calibrationGcode(test, plan, ctx);
        const gi = validateGcode(g, cat, ctx);
        expect(hasErrors(gi), JSON.stringify(gi)).toBe(false);
        const { stats } = parseGcode(g);
        expect(stats.cutLengthMm).toBeGreaterThan(0);
        // Banorna håller sig inom provets yta (plus verktygsradien och inlöp).
        const pad = cat === 'plasma' ? 12 : 4;
        expect(stats.bounds.min.x).toBeGreaterThan(plan.x - pad);
        expect(stats.bounds.max.x).toBeLessThan(plan.x + plan.width + pad);
        if (cat === 'laser') {
          const sMax = machineFor.laser.laser!.sMax;
          for (const m of g.matchAll(/S([\d.]+)/g)) expect(Number(m[1])).toBeLessThanOrEqual(sMax);
          expect(g).toMatch(/^M4 S0$/m);
        }
        if (cat === 'router') expect(stats.bounds.min.z).toBeGreaterThanOrEqual(-(ctx.thickness + 1));
        if (cat === 'plasma') expect(stats.bounds.min.z).toBeGreaterThanOrEqual(0);
      });
    }
  }

  it('effekt × hastighet: rätt antal rutor och värden', () => {
    const t = findCalibrationTest('laser-matrix')!;
    const ctx = ctxFor('laser');
    const plan = t.build({ ...defaultValues(t, ctx), powerSteps: 3, speedSteps: 4, powerMin: 20, powerMax: 60, speedMin: 1000, speedMax: 4000 }, ctx);
    expect(plan.cells).toHaveLength(12);
    expect([...new Set(plan.cells.map((c) => c.values.power))]).toEqual([20, 40, 60]);
    expect([...new Set(plan.cells.map((c) => c.values.speed))]).toEqual([1000, 2000, 3000, 4000]);
    // Varje ruta får sin egen effekt (S) i G-koden: 20 % av 1000 = 200.
    const g = calibrationGcode(t, plan, ctx);
    expect(g).toMatch(/S200\b/);
    expect(g).toMatch(/S600\b/);
  });

  it('snittbredd ur uppmätt kvadrat', () => {
    const t = findCalibrationTest('laser-kerf')!;
    const ctx = ctxFor('laser');
    const plan = t.build(defaultValues(t, ctx), ctx);
    const out = t.evaluate!(plan, { pieceX: 19.84, pieceY: 19.86, holeX: 20.16, holeY: 20.14 }, {}, ctx);
    expect(out.find((o) => o.key === 'kerf')!.value).toBeCloseTo(0.15, 3);
    expect(out.find((o) => o.key === 'kerf')!.apply).toBe('laserKerf');
  });

  it('fräsens verkliga diameter ur måttprovet och spårprovet', () => {
    const ctx = ctxFor('router');
    const acc = findCalibrationTest('router-accuracy')!;
    const plan = acc.build(defaultValues(acc, ctx), ctx);
    // Fräsen skär 0,1 mm bredare: tappen 0,1 mindre, fickan och hålet 0,1 större.
    const out = acc.evaluate!(plan, { outerX: 29.9, outerY: 29.9, innerX: 30.1, innerY: 30.1, holeX: 30.1, holeY: 30.1 }, {}, ctx);
    expect(out.find((o) => o.key === 'toolDiameter')!.value).toBeCloseTo(3.275, 3);
    const slot = findCalibrationTest('router-slot')!;
    const sp = slot.build(defaultValues(slot, ctx), ctx);
    expect(slot.evaluate!(sp, { slotX: 3.3, slotY: 3.2 }, {}, ctx).find((o) => o.key === 'axisDiff')!.value).toBeCloseTo(0.1, 3);
  });

  it('djupprovet: konstant fel och skala i Z', () => {
    const t = findCalibrationTest('router-depth')!;
    const ctx = ctxFor('router');
    const plan = t.build({ ...defaultValues(t, ctx), depthMin: 1, depthMax: 4, count: 4 }, ctx);
    // Alla 0,2 mm för djupt: felet 0,2, skalan 1.
    const m = Object.fromEntries(plan.measures.map((ms) => [ms.key, ms.nominal! + 0.2]));
    const out = t.evaluate!(plan, m, {}, ctx);
    expect(out.find((o) => o.key === 'depthError')!.value).toBeCloseTo(0.2, 3);
    expect(out.find((o) => o.key === 'zScale')!.value).toBeCloseTo(1, 3);
  });

  it('kontrollerna stoppar ett prov utanför arbetsytan och varnar för för hög hastighet', () => {
    const t = findCalibrationTest('laser-power')!;
    const ctx = ctxFor('laser');
    const v = { ...defaultValues(t, ctx), x: 390, speed: 99999 };
    const issues = validatePlan('laser', v, t.build(v, ctx), ctx);
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(['outsideArea', 'speedAboveMax']));
    // Fokus med Z-steg på en laser utan Z-axel: stoppas.
    const f = findCalibrationTest('laser-focus')!;
    const fv = { ...defaultValues(f, ctx), focusMode: 'zsteps' };
    expect(validatePlan('laser', fv, f.build(fv, ctx), ctx).map((i) => i.code)).toContain('noZ');
  });

  it('bildanalysen: mörkare rutor och den som ligger närmast målet', () => {
    const t = findCalibrationTest('laser-power')!;
    const ctx = ctxFor('laser');
    const plan = t.build({ ...defaultValues(t, ctx), count: 5, powerMin: 20, powerMax: 100 }, ctx);
    // Syntetiskt foto: ljust material, rutorna allt mörkare med effekten.
    const w = 400, h = Math.round((400 * plan.height) / plan.width);
    const gray = new Uint8Array(w * h).fill(220);
    for (const c of plan.cells) {
      const shade = 220 - (c.values.power / 100) * 200;
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const x = plan.x + (i / (w - 1)) * plan.width, y = plan.y + plan.height - (j / (h - 1)) * plan.height;
          if (x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1) gray[j * w + i] = shade;
        }
    }
    const a = analyzeGrid(gray, w, h, plan);
    const ds = a.readings.map((r) => r.darkness);
    expect(ds).toEqual([...ds].sort((x, y) => x - y));
    expect(a.confidence).toBe('high');
    expect(bestCells(a, 0.55, 1)[0].values.power).toBe(60);
  });
});
