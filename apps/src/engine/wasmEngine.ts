import type { CamEngine, PolylineInput, ProfileJob, RasterJob, ReliefJob } from '@desktopcam/core';

/** Signaturer som wasm-bindgen genererar från crates/cam-engine/src/lib.rs. */
interface WasmExports {
  default: (init?: { module_or_path: string | URL }) => Promise<unknown>;
  engine_version(): string;
  profile_gcode(points: Float64Array, counts: Uint32Array, closed: Uint8Array, paramsJson: string): string;
  dither(gray: Uint8Array, width: number, height: number, method: string, threshold: number): Uint8Array;
  raster_gcode(bits: Uint8Array, width: number, height: number, paramsJson: string): string;
  relief_gcode(heights: Float32Array, paramsJson: string): string;
}

function packPolylines(polylines: PolylineInput[]) {
  const total = polylines.reduce((n, p) => n + p.points.length, 0);
  const points = new Float64Array(total);
  const counts = new Uint32Array(polylines.length);
  const closed = new Uint8Array(polylines.length);
  let offset = 0;
  polylines.forEach((p, i) => {
    points.set(p.points, offset);
    offset += p.points.length;
    counts[i] = p.points.length / 2;
    closed[i] = p.closed ? 1 : 0;
  });
  return { points, counts, closed };
}

/**
 * Laddar motorn som `pnpm wasm:build` lägger i public/wasm/.
 * Kastar fel om filerna saknas – då används TypeScript-motorn i stället.
 */
export async function createWasmEngine(): Promise<CamEngine> {
  const base = new URL(import.meta.env.BASE_URL, self.location.origin);
  const jsUrl = new URL('wasm/cam_engine.js', base);
  const wasmUrl = new URL('wasm/cam_engine_bg.wasm', base);

  // Vite svarar med index.html för saknade filer, så kontrollera innehållstypen.
  const head = await fetch(jsUrl, { method: 'HEAD' });
  if (!head.ok || !(head.headers.get('content-type') ?? '').includes('javascript')) {
    throw new Error(`Ingen Wasm-motor på ${jsUrl.pathname}`);
  }

  const mod = (await import(/* @vite-ignore */ jsUrl.href)) as WasmExports;
  await mod.default({ module_or_path: wasmUrl });

  return {
    kind: 'wasm',
    version: mod.engine_version(),
    profileGcode(job: ProfileJob) {
      const { points, counts, closed } = packPolylines(job.polylines);
      const params = {
        offset: job.offset,
        mode: job.mode,
        cutDepth: job.cutDepth,
        stepDown: job.stepDown,
        feedRate: job.feedRate,
        plungeRate: job.plungeRate,
        spindleRpm: job.spindleRpm,
        laserS: job.laserS,
        passes: job.passes,
        post: job.post,
      };
      return mod.profile_gcode(points, counts, closed, JSON.stringify(params));
    },
    dither: (gray, width, height, method, threshold) => mod.dither(gray, width, height, method, threshold),
    rasterGcode(bits: Uint8Array, job: RasterJob) {
      const params = {
        pixelSizeMm: job.pixelSizeMm,
        originX: job.originX,
        originY: job.originY,
        feedRate: job.feedRate,
        laserS: job.laserS,
        post: job.post,
      };
      return mod.raster_gcode(bits, job.width, job.height, JSON.stringify(params));
    },
    reliefGcode(job: ReliefJob) {
      const params = {
        nx: job.nx,
        ny: job.ny,
        x: job.x,
        y: job.y,
        width: job.width,
        height: job.height,
        depth: job.depth,
        tool: job.tool,
        stepOverMm: job.stepOverMm,
        roughStepOverMm: job.roughStepOverMm,
        direction: job.direction,
        roughing: job.roughing,
        stepDown: job.stepDown,
        allowance: job.allowance,
        feedRate: job.feedRate,
        plungeRate: job.plungeRate,
        spindleRpm: job.spindleRpm,
        post: job.post,
      };
      return mod.relief_gcode(job.heights, JSON.stringify(params));
    },
  };
}
