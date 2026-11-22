/**
 * Kontrollen av små detaljer: hål, spår och tunna delar som verktyget inte
 * klarar, och plasmans val för små hål.
 */
import { describe, expect, it } from 'vitest';
import { analyzeFeatures, defaultPlasmaSettings, findSmallHoles, plasmaGcode, type PostprocessorConfig } from '@desktopcam/core';

const circle = (cx: number, cy: number, d: number) => {
  const points: number[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * 2 * Math.PI;
    points.push(cx + (d / 2) * Math.cos(a), cy + (d / 2) * Math.sin(a));
  }
  return { points, closed: true };
};
const box = (x: number, y: number, w: number, h: number) => ({ points: [x, y, x + w, y, x + w, y + h, x, y + h], closed: true });
const star = (cx: number, cy: number, R: number, r: number) => {
  const points: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R;
    points.push(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  }
  return { points, closed: true };
};

// Platta 160×80: hål 1,5/2,5/3/5/8, spår 1/2,5/4 mm, urtag 1 mm från överkanten, tunga 1 mm.
const outline = { points: [0, 0, 160, 0, 160, 80, 120.5, 80, 120.5, 65, 119.5, 65, 119.5, 80, 80, 80, 80, 95, 79, 95, 79, 80, 0, 80], closed: true };
const plate = [[outline, ...[1.5, 2.5, 3, 5, 8].map((d, i) => circle(15 + i * 20, 15, d)), box(20, 40, 1, 20), box(50, 40, 2.5, 20), box(80, 40, 4, 20)]];
const summary = (r: ReturnType<typeof analyzeFeatures>) => r.map((f) => `${f.severity}/${f.kind}@${Math.round(f.x)},${Math.round(f.y)}`).sort();

describe('små detaljer', () => {
  it('plasma: för små hål och spår, tunn tunga', () => {
    const r = analyzeFeatures({ groups: plate, side: 'outside', width: 1.7, thickness: 3, machine: 'plasma' });
    expect(summary(r)).toEqual(
      ['fail/gap@21,50', 'fail/gap@120,72', 'fail/hole@15,15', 'poor/hole@35,15', 'poor/gap@51,50', 'poor/hole@55,15', 'thin/part@79,88'].sort(),
    );
  });
  it('fräs: allt smalare än fräsen', () => {
    const r = analyzeFeatures({ groups: plate, side: 'outside', width: 3.175, thickness: 18, machine: 'router' });
    expect(r.filter((f) => f.severity === 'fail')).toHaveLength(6);
    expect(r.some((f) => f.severity === 'poor')).toBe(false);
  });
  it('laser: bara den tunna tungan', () => {
    const r = analyzeFeatures({ groups: plate, side: 'outside', width: 0.15, thickness: 3, machine: 'laser' });
    expect(r.map((f) => `${f.severity}/${f.kind}`)).toEqual(['thin/part']);
  });
  it('spetsiga hörn räknas inte', () => {
    const groups = [[box(0, 0, 120, 120), star(60, 60, 40, 16)]];
    expect(analyzeFeatures({ groups, side: 'outside', width: 1.5, thickness: 3, machine: 'plasma' })).toEqual([]);
  });
});

describe('plasma: små hål', () => {
  const post = { header: [], footer: [], decimals: 3, safeZ: 5 } as unknown as PostprocessorConfig;
  // Hål ritade som egna former inuti plattan blir hål i den.
  const groups = [[box(0, 0, 100, 50)], ...[1.5, 2.5, 3, 5, 8].map((d, i) => [circle(15 + i * 18, 25, d)])];
  const job = (smallHoles: 'mark' | 'cut' | 'skip') =>
    plasmaGcode({ groups, side: 'outside', kerf: 1.7, feedRate: 2000, plungeRate: 1000, settings: { ...defaultPlasmaSettings(), smallHoles }, zAxis: true, thickness: 3, post });
  const dwells = (g: string) => g.split('\n').filter((l) => l.startsWith('G4'));

  it('hittar hål under minsta bra storlek', () => {
    const nested = [[box(0, 0, 100, 50), ...groups.slice(1).flat()]];
    expect(findSmallHoles(nested, 'outside', 1.7, 3).map((h) => Math.round(h.diameter * 10) / 10)).toEqual([1.5, 2.5, 3]);
  });
  it('borrmärke, genomstick eller inget', () => {
    // 3 små hål + 2 hål + ytterkonturen skärs som konturer.
    expect(dwells(job('mark'))).toEqual([...Array(3).fill('G4 P0.1'), ...Array(3).fill('G4 P0.4')]);
    expect(dwells(job('cut'))).toEqual(Array(6).fill('G4 P0.4'));
    expect(dwells(job('skip'))).toEqual(Array(3).fill('G4 P0.4'));
  });
});
