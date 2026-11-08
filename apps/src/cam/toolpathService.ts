import { shapeToPolylines, type ProfileJob, type RasterJob, type ReliefJob, type ToolpathConfig } from '@desktopcam/core';
import { camClient } from '../engine/camClient';
import { getMachine, useAppStore } from '../store/useAppStore';
import { rasterizeGray } from '../utils/image';
import { heightmapFor } from './reliefs';

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
  const onProgress = (value: number, message?: string) => useAppStore.getState().setProgress(id, { value, message });

  s.setProgress(id, { value: 0, message: 'Startar' });
  s.setStatus(`Beräknar ${tp.name}…`);
  try {
    const payload =
      tp.operation === 'laserRaster'
        ? await camClient.request({ type: 'raster', job: buildRasterJob(tp) }, { onProgress })
        : tp.operation === 'relief'
          ? await camClient.request({ type: 'relief', job: buildReliefJob(tp) }, { onProgress })
          : await camClient.request({ type: 'profile', job: buildProfileJob(tp) }, { onProgress });

    const st = useAppStore.getState();
    st.setResult(id, {
      gcode: payload.gcode,
      rapids: payload.preview.rapids,
      cuts: payload.preview.cuts,
      stats: payload.preview.stats,
      engine: st.engine?.engine ?? 'typescript',
      computedAt: Date.now(),
    });
    st.setStatus(`${tp.name} klar – ${payload.preview.stats.lineCount.toLocaleString('sv-SE')} rader G-kod`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    useAppStore.getState().setError(id, message);
    useAppStore.getState().setStatus(`Fel i ${tp.name}: ${message}`);
  } finally {
    useAppStore.getState().setProgress(id, null);
  }
}

function buildProfileJob(tp: ToolpathConfig): ProfileJob {
  const s = useAppStore.getState();
  const machine = getMachine();
  const tool = s.tools.find((t) => t.id === tp.toolId);
  const shapes = s.layers.flatMap((l) => l.shapes).filter((sh) => tp.shapeIds.includes(sh.id));
  if (!shapes.length) throw new Error('Verktygsbanan har inga former – markera former och skapa banan igen');
  const polylines = shapes.flatMap((sh) => shapeToPolylines(sh));
  const sMax = machine.laser?.sMax ?? 1000;

  if (tp.operation === 'profile') {
    const r = (tool?.diameter ?? 0) / 2;
    return {
      polylines,
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
  throw new Error('Den här operationen kommer i nästa version av motorn');
}

function buildRasterJob(tp: ToolpathConfig): RasterJob {
  if (tp.operation !== 'laserRaster') throw new Error('Fel operationstyp');
  const s = useAppStore.getState();
  const machine = getMachine();
  const img = s.images[tp.imageId];
  if (!img) throw new Error('Bilden saknas – importera den igen');
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
  if (tp.operation !== 'relief') throw new Error('Fel operationstyp');
  const s = useAppStore.getState();
  const relief = s.reliefs.find((r) => r.id === tp.reliefId);
  if (!relief) throw new Error('Reliefen har tagits bort – skapa banan igen');
  const tool = s.tools.find((t) => t.id === tp.toolId);
  if (!tool || tool.kind === 'laser') throw new Error('Välj en fräs för reliefbanan');
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
