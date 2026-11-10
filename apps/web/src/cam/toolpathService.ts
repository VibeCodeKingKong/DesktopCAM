import {
  shapeToPolylines,
  shapesBounds,
  transformShape,
  type VCarveJob,
  type DrillJob,
  type PocketJob,
  type PolylineInput,
  type ProfileJob,
  type RasterJob,
  type ReliefJob,
  type ToolpathConfig,
  type VectorShape,
} from '@desktopcam/core';
import { camClient } from '../engine/camClient';
import { errorText, getT } from '../i18n';
import { allShapes, getMachine, useAppStore } from '../store/useAppStore';
import { rasterizeGray } from '../utils/image';
import { heightmapFor } from './reliefs';
import { toolReachWarnings } from './toolReach';

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Räkna om efter en kort paus – används när användaren ändrar parametrar. */
export function scheduleCompute(id: string, delay = 350) {
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => void computeToolpath(id), delay));
}

export async function computeToolpath(id: string): Promise<void> {
  const s = useAppStore.getState();
  const tp = s.toolpaths.find((t) => t.id === id);
  if (!tp) return;
  const t = getT();
  const onProgress = (value: number, message?: string) =>
    useAppStore.getState().setProgress(id, { value, message: message ? (getT().progress[message] ?? message) : undefined });

  s.setProgress(id, { value: 0, message: t.progress.start });
  s.setStatus(t.status.computing(tp.name));
  try {
    let payload;
    switch (tp.operation) {
      case 'laserRaster':
        payload = await camClient.request({ type: 'raster', job: buildRasterJob(tp) }, { onProgress });
        break;
      case 'relief':
        payload = await camClient.request({ type: 'relief', job: buildReliefJob(tp) }, { onProgress });
        break;
      case 'pocket':
        payload = await camClient.request({ type: 'pocket', job: buildPocketJob(tp) }, { onProgress });
        break;
      case 'drill':
        payload = await camClient.request({ type: 'drill', job: buildDrillJob(tp) }, { onProgress });
        break;
      case 'vcarve':
      case 'inlay':
        payload = await camClient.request({ type: 'vcarve', job: buildVCarveJob(tp) }, { onProgress });
        break;
      case 'profile':
      case 'laserCut':
        payload = await camClient.request({ type: 'profile', job: buildProfileJob(tp) }, { onProgress });
        break;
      default:
        throw new Error('NOT_IMPLEMENTED');
    }
    const st = useAppStore.getState();
    const warnings = toolReachWarnings(st.tools.find((x) => x.id === tp.toolId), payload.preview.stats, getT());
    st.setResult(id, {
      warnings,
      gcode: payload.gcode,
      rapids: payload.preview.rapids,
      cuts: payload.preview.cuts,
      stats: payload.preview.stats,
      engine: st.engine?.engine ?? 'typescript',
      computedAt: Date.now(),
    });
    st.setStatus(warnings.length ? `${tp.name}: ${warnings[0]}` : getT().status.computed(tp.name, payload.preview.stats.lineCount.toLocaleString(getT().locale)));
  } catch (err) {
    const tt = getT();
    const message = errorText(tt, err instanceof Error ? err.message : String(err));
    useAppStore.getState().setError(id, message);
    useAppStore.getState().setStatus(tt.status.error(tp.name, message));
  } finally {
    useAppStore.getState().setProgress(id, null);
  }
}

function shapesOf(tp: ToolpathConfig): VectorShape[] {
  const shapes = allShapes(useAppStore.getState().layers).filter((sh) => tp.shapeIds.includes(sh.id));
  if (!shapes.length) throw new Error('NO_SHAPES');
  return shapes;
}

const groupsOf = (shapes: VectorShape[]): PolylineInput[][] => shapes.map((sh) => shapeToPolylines(sh));

function buildProfileJob(tp: ToolpathConfig): ProfileJob {
  const s = useAppStore.getState();
  const machine = getMachine();
  const tool = s.tools.find((t) => t.id === tp.toolId);
  const groups = groupsOf(shapesOf(tp));
  const polylines = groups.flat();
  const sMax = machine.laser?.sMax ?? 1000;

  if (tp.operation === 'profile') {
    const r = (tool?.diameter ?? 0) / 2;
    return {
      polylines,
      groups,
      offset: tp.side === 'outside' ? r : tp.side === 'inside' ? -r : 0,
      mode: 'router',
      cutDepth: tp.cutDepth,
      stepDown: tp.params.stepDown,
      feedRate: tp.params.feedRate,
      plungeRate: tp.params.plungeRate,
      spindleRpm: tp.params.spindleRpm ?? 18000,
      laserS: 0,
      passes: 1,
      post: machine.postprocessor,
    };
  }
  if (tp.operation === 'laserCut') {
    const half = tp.kerf / 2;
    return {
      polylines,
      groups,
      offset: tp.side === 'outside' ? half : tp.side === 'inside' ? -half : 0,
      mode: 'laser',
      cutDepth: 0,
      stepDown: 0,
      feedRate: tp.params.feedRate,
      plungeRate: 0,
      spindleRpm: 0,
      laserS: ((tp.params.laserPowerPct ?? 100) / 100) * sMax,
      passes: tp.passes,
      post: machine.postprocessor,
    };
  }
  throw new Error('NOT_IMPLEMENTED');
}

function buildPocketJob(tp: ToolpathConfig): PocketJob {
  if (tp.operation !== 'pocket') throw new Error('NOT_IMPLEMENTED');
  const s = useAppStore.getState();
  const tool = s.tools.find((t) => t.id === tp.toolId);
  if (!tool || tool.kind === 'laser') throw new Error('WRONG_TOOL');
  const groups = groupsOf(shapesOf(tp)).map((g) => g.filter((p) => p.closed)).filter((g) => g.length);
  if (!groups.length) throw new Error('NO_CLOSED');
  return {
    groups,
    toolDiameter: tool.diameter,
    stepOver: tp.params.stepOver,
    cutDepth: tp.cutDepth,
    stepDown: tp.params.stepDown,
    feedRate: tp.params.feedRate,
    plungeRate: tp.params.plungeRate,
    spindleRpm: tp.params.spindleRpm ?? 18000,
    post: getMachine().postprocessor,
  };
}

/** Borrpunkter: mitten av varje sluten bana i de valda formerna. */
export function drillPoints(shapes: VectorShape[]) {
  const pts: { x: number; y: number }[] = [];
  for (const sh of shapes) {
    for (const pl of shapeToPolylines(sh, 0.2)) {
      if (!pl.closed) continue;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i + 1 < pl.points.length; i += 2) {
        minX = Math.min(minX, pl.points[i]); maxX = Math.max(maxX, pl.points[i]);
        minY = Math.min(minY, pl.points[i + 1]); maxY = Math.max(maxY, pl.points[i + 1]);
      }
      pts.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
    }
  }
  return pts;
}

function buildDrillJob(tp: ToolpathConfig): DrillJob {
  if (tp.operation !== 'drill') throw new Error('NOT_IMPLEMENTED');
  return {
    points: drillPoints(shapesOf(tp)),
    depth: tp.depth,
    peckDepth: tp.peckDepth,
    plungeRate: tp.params.plungeRate,
    spindleRpm: tp.params.spindleRpm ?? 12000,
    post: getMachine().postprocessor,
  };
}

/** Spegelvänder former runt deras gemensamma mitt (för inläggets plugg). */
export function mirrorInPlace(shapes: VectorShape[]): VectorShape[] {
  const b = shapesBounds(shapes);
  if (!b) return shapes;
  const cx = (b.min.x + b.max.x) / 2;
  return shapes.map((s) => transformShape(s, [-1, 0, 0, 1, 2 * cx, 0]));
}

function buildVCarveJob(tp: ToolpathConfig): VCarveJob {
  if (tp.operation !== 'vcarve' && tp.operation !== 'inlay') throw new Error('NOT_IMPLEMENTED');
  const s = useAppStore.getState();
  const tool = s.tools.find((t) => t.id === tp.toolId);
  if (!tool || tool.kind !== 'vbit') throw new Error('NEEDS_VBIT');
  const shapes = shapesOf(tp);
  const plug = tp.operation === 'inlay' && tp.part === 'plug';
  const groups = groupsOf(plug ? mirrorInPlace(shapes) : shapes)
    .map((g) => g.filter((p) => p.closed))
    .filter((g) => g.length);
  if (!groups.length) throw new Error('NO_CLOSED');
  const common = {
    groups,
    angle: tool.angle ?? 60,
    stepDown: tp.params.stepDown,
    feedRate: tp.params.feedRate,
    plungeRate: tp.params.plungeRate,
    spindleRpm: tp.params.spindleRpm ?? 18000,
    post: getMachine().postprocessor,
  };
  if (tp.operation === 'vcarve') {
    return { ...common, mode: 'pocket', maxDepth: tp.flatDepth > 0 ? tp.flatDepth : s.material.thickness, startDepth: 0, margin: 0, contourStep: tp.contourStep };
  }
  return {
    ...common,
    mode: tp.part,
    maxDepth: tp.part === 'pocket' ? tp.pocketDepth : tp.plugDepth,
    startDepth: tp.startDepth,
    margin: tp.margin,
    contourStep: tp.contourStep,
  };
}

function buildRasterJob(tp: ToolpathConfig): RasterJob {
  if (tp.operation !== 'laserRaster') throw new Error('NOT_IMPLEMENTED');
  const s = useAppStore.getState();
  const machine = getMachine();
  const img = s.images[tp.imageId];
  if (!img) throw new Error('IMAGE_MISSING');
  const width = Math.max(1, Math.round(tp.widthMm / tp.lineIntervalMm));
  const height = Math.max(1, Math.round((width * img.bitmap.height) / img.bitmap.width));
  return {
    gray: rasterizeGray(img.bitmap, width, height),
    width,
    height,
    method: tp.dither,
    threshold: tp.threshold,
    pixelSizeMm: tp.lineIntervalMm,
    originX: tp.origin.x,
    originY: tp.origin.y,
    feedRate: tp.params.feedRate,
    laserS: ((tp.params.laserPowerPct ?? 30) / 100) * (machine.laser?.sMax ?? 1000),
    post: machine.postprocessor,
  };
}

function buildReliefJob(tp: ToolpathConfig): ReliefJob {
  if (tp.operation !== 'relief') throw new Error('NOT_IMPLEMENTED');
  const s = useAppStore.getState();
  const relief = s.reliefs.find((r) => r.id === tp.reliefId);
  if (!relief) throw new Error('RELIEF_MISSING');
  const tool = s.tools.find((t) => t.id === tp.toolId);
  if (!tool || tool.kind === 'laser' || tool.kind === 'drill') throw new Error('WRONG_TOOL');
  const hm = heightmapFor(relief);
  return {
    heights: hm.heights,
    nx: hm.nx,
    ny: hm.ny,
    x: relief.x,
    y: relief.y,
    width: relief.width,
    height: relief.height,
    depth: relief.depth,
    tool: { kind: tool.kind, diameter: tool.diameter, angle: tool.angle },
    stepOverMm: Math.max(0.02, tool.diameter * tp.params.stepOver),
    roughStepOverMm: Math.max(0.1, tool.diameter * 0.4),
    direction: tp.direction,
    roughing: tp.roughing,
    stepDown: tp.params.stepDown,
    allowance: tp.allowance,
    feedRate: tp.params.feedRate,
    plungeRate: tp.params.plungeRate,
    spindleRpm: tp.params.spindleRpm ?? 18000,
    post: getMachine().postprocessor,
  };
}

/**
 * Räknar om verktygsbanor automatiskt när deras former, reliefer, material
 * eller verktyg ändras (t.ex. efter flytt, nodredigering eller ångra).
 */
export function watchForChanges() {
  return useAppStore.subscribe((s, prev) => {
    if (s.layers === prev.layers && s.reliefs === prev.reliefs && s.tools === prev.tools && s.machineId === prev.machineId && s.material === prev.material && s.toolpaths === prev.toolpaths) return;
    const prevShapes = new Map(allShapes(prev.layers).map((sh) => [sh.id, sh]));
    const changedShapes = new Set(allShapes(s.layers).filter((sh) => prevShapes.get(sh.id) !== sh).map((sh) => sh.id));
    for (const id of prevShapes.keys()) if (!allShapes(s.layers).some((x) => x.id === id)) changedShapes.add(id);
    const prevTp = new Map(prev.toolpaths.map((t) => [t.id, t]));
    const global = s.tools !== prev.tools || s.machineId !== prev.machineId || s.material.thickness !== prev.material.thickness;
    for (const tp of s.toolpaths) {
      const configChanged = prevTp.get(tp.id) !== tp && prevTp.has(tp.id) && !s.progress[tp.id];
      const reliefChanged = tp.operation === 'relief' && s.reliefs !== prev.reliefs;
      if (global || configChanged || reliefChanged || tp.shapeIds.some((id) => changedShapes.has(id))) scheduleCompute(tp.id, 400);
    }
  });
}
