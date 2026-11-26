import { describe, expect, it } from 'vitest';
import { applyBridges, plasmaGcode, defaultPlasmaSettings, type PolylineInput } from '@desktopcam/core';

const square = (x: number, y: number, s: number): PolylineInput => ({ points: [x, y, x + s, y, x + s, y + s, x, y + s], closed: true });
const len = (p: PolylineInput) => {
  let L = 0;
  for (let i = 2; i < p.points.length; i += 2) L += Math.hypot(p.points[i] - p.points[i - 2], p.points[i + 1] - p.points[i - 1]);
  return L;
};

describe('mikrobryggor', () => {
  it('laser: ytterkonturen delas i bitar med bryggorna oskurna, hål lämnas hela', () => {
    const out = applyBridges([square(0, 0, 100), square(40, 40, 20)], { count: 4, width: 2 });
    const open = out.filter((p) => !p.closed);
    const closed = out.filter((p) => p.closed);
    expect(open).toHaveLength(4);
    expect(closed).toHaveLength(1); // hålet
    // Summan av bitarna = omkretsen minus fyra bryggor.
    expect(open.reduce((a, p) => a + len(p), 0)).toBeCloseTo(400 - 8, 6);
  });

  it('laser: för korta konturer får inga bryggor', () => {
    const out = applyBridges([square(0, 0, 3)], { count: 4, width: 2 });
    expect(out[0].closed).toBe(true);
  });

  it('plasma: brännaren tänds en gång per bit (första genomstick + en per brygga)', () => {
    const post = { name: 'Test', flavor: 'grbl', header: ['G21', 'G90'], footer: ['M2'], decimals: 3, safeZ: 10 } as never;
    const job = (bridgeCount: number) => ({
      groups: [[square(0, 0, 100)]],
      side: 'outside' as const,
      kerf: 1.5,
      feedRate: 2000,
      plungeRate: 1000,
      settings: { ...defaultPlasmaSettings(), bridgeCount, bridgeWidth: 1.5, smallHoles: 'contour' as const },
      zAxis: true,
      thickness: 3,
      post,
    });
    const on = (g: string) => g.split('\n').filter((l) => /^M0?3\b/.test(l.trim())).length;
    expect(on(plasmaGcode(job(0)))).toBe(1);
    expect(on(plasmaGcode(job(3)))).toBe(4);
  });
});
