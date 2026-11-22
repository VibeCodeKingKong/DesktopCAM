/** Formbiblioteket: varje motiv ger giltig geometri som går att skära. */
import { describe, expect, it } from 'vitest';
import { buildLibraryShape, DEFAULT_SHAPE_PARAMS, fingerBox, offsetShapes, SHAPE_LIBRARY, shapeToPolylines, type ShapeLibraryItem } from '@desktopcam/core';

const area = (pts: number[]) => {
  let a = 0;
  for (let i = 0, n = pts.length / 2; i < n; i++) {
    const j = (i + 1) % n;
    a += pts[2 * i] * pts[2 * j + 1] - pts[2 * j] * pts[2 * i + 1];
  }
  return a / 2;
};
const bbox = (item: ShapeLibraryItem, values?: Record<string, number | string>) => {
  const sh = buildLibraryShape(item, 'x', item.size.w, item.size.h, { ...DEFAULT_SHAPE_PARAMS, values }, 0, 0);
  const pls = shapeToPolylines(sh, 0.05);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pls) for (let i = 0; i < p.points.length; i += 2) {
    x0 = Math.min(x0, p.points[i]); x1 = Math.max(x1, p.points[i]); y0 = Math.min(y0, p.points[i + 1]); y1 = Math.max(y1, p.points[i + 1]);
  }
  return { pls, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
};

describe('formbiblioteket', () => {
  for (const item of SHAPE_LIBRARY) {
    it(item.id, () => {
      const g = bbox(item);
      expect(g.pls.length).toBeGreaterThan(0);
      for (const p of g.pls) for (const v of p.points) expect(Number.isFinite(v)).toBe(true);
      // Mitten hamnar där motivet läggs in.
      expect(Math.abs(g.cx)).toBeLessThan(Math.max(g.w, g.h) * 0.08 + 0.5);
      expect(Math.abs(g.cy)).toBeLessThan(Math.max(g.w, g.h) * 0.08 + 0.5);
      if (!item.fixedSize) {
        expect(g.w).toBeLessThanOrEqual(item.size.w + 0.5);
        expect(g.h).toBeLessThanOrEqual(item.size.h + 0.5);
      }
      if (item.kind === 'area') {
        const closed = g.pls.filter((p) => p.closed);
        expect(closed.length).toBe(g.pls.length);
        for (const p of closed) expect(Math.abs(area(p.points))).toBeGreaterThan(0.5);
        // Går att skära ut med 3 mm fräs (utsida).
        expect(offsetShapes([closed], 1.5).length).toBeGreaterThan(0);
      }
      // Reglagens ytterlägen ger också giltig geometri.
      for (const c of item.controls ?? []) {
        const vals = 'options' in c ? c.options : [c.min, c.max];
        for (const v of vals) {
          const gg = bbox(item, { [c.key]: v });
          for (const p of gg.pls) for (const x of p.points) expect(Number.isFinite(x), `${c.key}=${v}`).toBe(true);
        }
      }
    });
  }

  it('lådan med fingerskarvar: delarna fyller väggarna exakt (inga glapp eller överlapp)', () => {
    const polyArea = (pts: { x: number; y: number }[]) => Math.abs(pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p.x * q.y - q.x * p.y; }, 0) / 2);
    for (const [L, W, H, t, f, lid] of [[160, 100, 60, 6, 12, false], [160, 100, 60, 6, 12, true], [300, 87, 45, 3, 8, true], [120, 120, 120, 12, 20, false]] as const) {
      const panels = fingerBox(L, W, H, t, f, lid);
      const vol = panels.reduce((a, q) => a + polyArea(q.pts) * t, 0);
      const shell = L * W * H - (L - 2 * t) * (W - 2 * t) * (H - (lid ? 2 : 1) * t);
      expect(vol).toBeCloseTo(shell, 3);
      expect(panels.length).toBe(lid ? 6 : 5);
    }
  });

  it('lådan med fingerskarvar: varje punkt i väggarna tillhör exakt en del', () => {
    const inside = (pts: { x: number; y: number }[], x: number, y: number) => {
      let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i], b = pts[j];
        if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
      }
      return c;
    };
    for (const lid of [false, true]) {
      const L = 100, W = 70, H = 50, t = 6;
      const [front, back, left, right, base, top] = fingerBox(L, W, H, t, 10, lid);
      const parts: ((x: number, y: number, z: number) => boolean)[] = [
        (x, y, z) => y < t && inside(front.pts, x, z),
        (x, y, z) => y > W - t && inside(back.pts, x, z),
        (x, y, z) => x < t && inside(left.pts, y, z),
        (x, y, z) => x > L - t && inside(right.pts, y, z),
        (x, y, z) => z < t && inside(base.pts, x, y),
        ...(top ? [(x: number, y: number, z: number) => z > H - t && inside(top.pts, x, y)] : []),
      ];
      let bad = 0;
      const step = 1.37;
      for (let x = 0.31; x < L; x += step)
        for (let y = 0.29; y < W; y += step)
          for (let z = 0.23; z < H; z += step) {
            const shell = x < t || x > L - t || y < t || y > W - t || z < t || (lid && z > H - t);
            const n = parts.filter((f) => f(x, y, z)).length;
            if (n !== (shell ? 1 : 0)) bad++;
          }
      expect(bad, lid ? 'med lock' : 'utan lock').toBe(0);
    }
  });

  it('mått från reglagen: fläns, fästplatta, fingerskarv', () => {
    const f = SHAPE_LIBRARY.find((x) => x.id === 'flange')!;
    expect(bbox(f, { outerDia: 200 }).w).toBeCloseTo(200, 0);
    const m = SHAPE_LIBRARY.find((x) => x.id === 'mount-plate')!;
    const g = bbox(m, { width: 120, height: 80, cols: 2, rows: 2 });
    expect([Math.round(g.w), Math.round(g.h), g.pls.length]).toEqual([120, 80, 5]);
  });
});
