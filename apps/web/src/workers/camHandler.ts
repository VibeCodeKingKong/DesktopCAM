/**
 * CAM-beräkningarna för workern, utan koppling till själva workern – så att
 * samma kod kan köras i regressionstesterna (Node) som i appen.
 */
import {
  optimizeGcode,
  plasmaGcode,
  drillGcode,
  facingGcode,
  plotterGcode,
  penImagePaths,
  orderPaths,
  importVectorFile,
  offsetShapes,
  parseGcode,
  pocketGcode,
  pocketStrategyGcode,
  routerProfileGcode,
  vcarveGcode,
  detectPaper,
  warpQuad,
  traceImage,
  traceToMm,
  type TracedObjectMm,
  type TraceResultMm,
  type CamEngine,
  type CamRequest,
  type EngineInfo,
  type RasterPayload,
  type ToolpathPayload,
} from '@desktopcam/core';

export type Progress = (value: number, message?: string) => void;
export interface Handled {
  result: unknown;
  transfer: Transferable[];
}

/**
 * Mindre G-kod: raka följder slås ihop och cirkelbågar blir G2/G3 (om
 * maskinens postprocessor tillåter bågar). Banan ändras högst 0,01 mm.
 */
function compact(gcode: string, request: CamRequest): string {
  const post = 'job' in request && request.job && 'post' in request.job ? request.job.post : null;
  if (!post) return gcode;
  return optimizeGcode(gcode, { arcs: post.arcs !== false, tolerance: 0.01, decimals: post.decimals });
}

/** Maskinens hastighetsgränser för tidsberäkningen (om jobbet har dem). */
function limitsOf(request: CamRequest): { xy: number; z: number } | undefined {
  return 'job' in request && request.job && 'post' in request.job ? request.job.post.maxFeed : undefined;
}

export async function handle(engine: CamEngine, request: CamRequest, progress: Progress): Promise<Handled> {
  switch (request.type) {
    case 'ping': {
      const info: EngineInfo = {
        engine: engine.kind,
        version: engine.version,
        threads: globalThis.navigator?.hardwareConcurrency ?? 1,
        crossOriginIsolated: globalThis.crossOriginIsolated ?? false,
      };
      return { result: info, transfer: [] };
    }
    case 'profile': {
      progress(0.1, 'offset');
      let job = request.job;
      // Robust offset med avståndsfält; motorn får färdiga banor med offset 0.
      if (job.groups && Math.abs(job.offset) > 1e-9) {
        const open = job.groups.flat().filter((p) => !p.closed);
        const closedGroups = job.groups.map((g) => g.filter((p) => p.closed)).filter((g) => g.length);
        const offsetPaths = closedGroups.length ? offsetShapes(closedGroups, job.offset) : [];
        if (closedGroups.length && !offsetPaths.length) throw new Error('TOOL_TOO_LARGE');
        job = { ...job, polylines: [...offsetPaths, ...open], offset: 0, groups: undefined };
      }
      progress(0.5, 'gcode');
      const gcode = engine.profileGcode(job);
      progress(0.75, 'preview');
      const small = compact(gcode, request);
      const preview = parseGcode(small, limitsOf(request));
      const result: ToolpathPayload = { gcode: small, preview };
      return { result, transfer: [preview.rapids.buffer as ArrayBuffer, preview.cuts.buffer as ArrayBuffer] };
    }
    case 'relief': {
      progress(0.1, 'relief');
      const gcode = engine.reliefGcode(request.job);
      progress(0.75, 'preview');
      const small = compact(gcode, request);
      const preview = parseGcode(small, limitsOf(request));
      const result: ToolpathPayload = { gcode: small, preview };
      return { result, transfer: [preview.rapids.buffer as ArrayBuffer, preview.cuts.buffer as ArrayBuffer] };
    }
    case 'plasma': {
      progress(0.1, 'offset');
      const gcode = plasmaGcode(request.job);
      progress(0.8, 'preview');
      const small = compact(gcode, request);
      const preview = parseGcode(small, limitsOf(request));
      const result: ToolpathPayload = { gcode: small, preview };
      return { result, transfer: [preview.rapids.buffer as ArrayBuffer, preview.cuts.buffer as ArrayBuffer] };
    }
    case 'plotterImage': {
      progress(0.1, 'gcode');
      const { input, ...rest } = request.job;
      const paths = penImagePaths(input, (p) => orderPaths(p));
      progress(0.6, 'gcode');
      const small = compact(plotterGcode({ ...rest, paths }), request);
      progress(0.85, 'preview');
      const preview = parseGcode(small, limitsOf(request));
      const result: ToolpathPayload = { gcode: small, preview };
      return { result, transfer: [preview.rapids.buffer as ArrayBuffer, preview.cuts.buffer as ArrayBuffer] };
    }
    case 'plotter': {
      progress(0.1, 'gcode');
      const small = compact(plotterGcode(request.job), request);
      progress(0.8, 'preview');
      const preview = parseGcode(small, limitsOf(request));
      const result: ToolpathPayload = { gcode: small, preview };
      return { result, transfer: [preview.rapids.buffer as ArrayBuffer, preview.cuts.buffer as ArrayBuffer] };
    }
    case 'facing': {
      progress(0.1, 'gcode');
      const small = compact(facingGcode(request.job), request);
      progress(0.8, 'preview');
      const preview = parseGcode(small, limitsOf(request));
      const result: ToolpathPayload = { gcode: small, preview };
      return { result, transfer: [preview.rapids.buffer as ArrayBuffer, preview.cuts.buffer as ArrayBuffer] };
    }
    case 'pocket':
    case 'drill':
    case 'vcarve':
    case 'routerProfile': {
      progress(0.1, request.type === 'routerProfile' ? 'offset' : request.type);
      const gcode =
        request.type === 'pocket'
          ? request.job.strategy
            ? pocketStrategyGcode(request.job)
            : pocketGcode(request.job)
          : request.type === 'drill'
            ? drillGcode(request.job)
            : request.type === 'vcarve'
              ? vcarveGcode(request.job)
              : routerProfileGcode(request.job);
      progress(0.8, 'preview');
      const small = compact(gcode, request);
      const preview = parseGcode(small, limitsOf(request));
      const result: ToolpathPayload = { gcode: small, preview };
      return { result, transfer: [preview.rapids.buffer as ArrayBuffer, preview.cuts.buffer as ArrayBuffer] };
    }
    case 'traceDetect': {
      progress(0.3, 'trace');
      return { result: detectPaper(request.gray, request.width, request.height), transfer: [] };
    }
    case 'traceRectify': {
      progress(0.2, 'trace');
      const out = warpQuad(request.rgba, request.width, request.height, request.quad, request.outW, request.outH);
      return { result: out, transfer: [out.buffer as ArrayBuffer] };
    }
    case 'trace': {
      const { gray, chroma, width, height, options, mmPerPx, offsetMm } = request.job;
      progress(0.2, 'trace');
      const res = traceImage(gray, width, height, options, chroma);
      progress(0.7, 'offset');
      const objects: TracedObjectMm[] = res.objects.map((o) => {
        let loops = o.loops.map((l) => traceToMm(l, mmPerPx, height));
        // Förskjutning med avståndsfältet (håller sig giltig även vid självskärningar).
        if (Math.abs(offsetMm) > 1e-6 && loops.length) {
          const off = offsetShapes([loops.map((points) => ({ points, closed: true }))], offsetMm);
          loops = off.map((p) => p.points);
        }
        const all = [...loops, ...o.lines.map((l) => traceToMm(l, mmPerPx, height))];
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const l of all)
          for (let i = 0; i < l.length; i += 2) {
            x0 = Math.min(x0, l[i]); x1 = Math.max(x1, l[i]);
            y0 = Math.min(y0, l[i + 1]); y1 = Math.max(y1, l[i + 1]);
          }
        return { id: o.id, loops, lines: o.lines.map((l) => traceToMm(l, mmPerPx, height)), area: o.area * mmPerPx * mmPerPx, bbox: [x0, y0, x1, y1] };
      });
      return { result: { threshold: res.threshold, objects } satisfies TraceResultMm, transfer: [] };
    }
    case 'import': {
      // Filtolkning är ren TypeScript – den är snabb nog och lättare att felsöka.
      progress(0.2, 'import');
      const result = importVectorFile(request.format, request.text, request.options);
      return { result, transfer: [] };
    }
    case 'raster': {
      const { job } = request;
      progress(0.1, 'dither');
      const bits = engine.dither(job.gray, job.width, job.height, job.method, job.threshold);
      progress(0.45, 'gcode');
      const gcode = engine.rasterGcode(bits, job);
      progress(0.8, 'preview');
      const preview = parseGcode(gcode, limitsOf(request));
      const result: RasterPayload = { gcode, preview, bits, width: job.width, height: job.height };
      return {
        result,
        transfer: [preview.rapids.buffer as ArrayBuffer, preview.cuts.buffer as ArrayBuffer, bits.buffer as ArrayBuffer],
      };
    }
  }
}

