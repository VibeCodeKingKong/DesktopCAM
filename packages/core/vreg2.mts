import { writeFileSync } from 'node:fs';
import * as C from './src/index';
const S = process.argv[2];
const lib = (id: string, w: number, h: number, cx: number, cy: number) => C.buildLibraryShape(C.SHAPE_LIBRARY.find((x) => x.id === id)!, id, w, h, C.DEFAULT_SHAPE_PARAMS, cx, cy);
const post = { name: 'grbl', header: [], footer: [], safeZ: 5, decimals: 3 } as any;
const cases: [string, any[], number][] = [['heart-deep', [lib('heart', 60, 55, 60, 60)], 11]];
for (const [name, shapes, D] of cases) for (const strategy of ['contours', 'centerline'] as const) {
  const groups = shapes.map((sh) => C.shapeToPolylines(sh, 0.005).filter((p: any) => p.closed)).filter((g) => g.length);
  const g = C.vcarveGcode({ groups, mode: 'pocket', angle: 60, maxDepth: D, startDepth: 0, margin: 0, contourStep: 0.1, stepDown: 2, feedRate: 880, plungeRate: 300, spindleRpm: 18000, post, strategy });
  writeFileSync(`${S}/v2-${name}-${strategy}.nc`, g);
}
