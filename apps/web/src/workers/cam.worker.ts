/**
 * CAM-worker. All tung beräkning sker här så att UI:t aldrig fryser.
 * Kommunikation: WorkerInbound in, WorkerOutbound ut (se @desktopcam/core/protocol).
 */
import {
  drillGcode,
  importVectorFile,
  offsetShapes,
  parseGcode,
  pocketGcode,
  routerProfileGcode,
  vcarveGcode,
  type CamEngine,
  type CamRequest,
  type EngineInfo,
  type RasterPayload,
  type ToolpathPayload,
  type WorkerInbound,
  type WorkerOutbound,
} from '@desktopcam/core';
import { loadEngine } from '../engine/loadEngine';

interface WorkerScope {
  postMessage(message: WorkerOutbound, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<WorkerInbound>) => void) | null;
}

const scope = self as unknown as WorkerScope;
const enginePromise = loadEngine();

type Progress = (value: number, message?: string) => void;
interface Handled {
  result: unknown;
  transfer: Transferable[];
}

async function handle(engine: CamEngine, request: CamRequest, progress: Progress): Promise<Handled> {
  switch (request.type) {
    case 'ping': {
      const info: EngineInfo = {
        engine: engine.kind,
        version: engine.version,
        threads: navigator.hardwareConcurrency ?? 1,
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
      const preview = parseGcode(gcode);
      const result: ToolpathPayload = { gcode, preview };
      return { result, transfer: [preview.rapids.buffer as ArrayBuffer, preview.cuts.buffer as ArrayBuffer] };
    }
    case 'relief': {
      progress(0.1, 'relief');
      const gcode = engine.reliefGcode(request.job);
      progress(0.75, 'preview');
      const preview = parseGcode(gcode);
      const result: ToolpathPayload = { gcode, preview };
      return { result, transfer: [preview.rapids.buffer as ArrayBuffer, preview.cuts.buffer as ArrayBuffer] };
    }
    case 'pocket':
    case 'drill':
    case 'vcarve':
    case 'routerProfile': {
      progress(0.1, request.type === 'routerProfile' ? 'offset' : request.type);
      const gcode =
        request.type === 'pocket'
          ? pocketGcode(request.job)
          : request.type === 'drill'
            ? drillGcode(request.job)
            : request.type === 'vcarve'
              ? vcarveGcode(request.job)
              : routerProfileGcode(request.job);
      progress(0.8, 'preview');
      const preview = parseGcode(gcode);
      const result: ToolpathPayload = { gcode, preview };
      return { result, transfer: [preview.rapids.buffer as ArrayBuffer, preview.cuts.buffer as ArrayBuffer] };
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
      const preview = parseGcode(gcode);
      const result: RasterPayload = { gcode, preview, bits, width: job.width, height: job.height };
      return {
        result,
        transfer: [preview.rapids.buffer as ArrayBuffer, preview.cuts.buffer as ArrayBuffer, bits.buffer as ArrayBuffer],
      };
    }
  }
}

scope.onmessage = async (event) => {
  const { id, request } = event.data;
  const progress: Progress = (value, message) => scope.postMessage({ id, kind: 'progress', value, message });
  try {
    const engine = await enginePromise;
    const { result, transfer } = await handle(engine, request, progress);
    scope.postMessage({ id, kind: 'result', result }, transfer);
  } catch (err) {
    scope.postMessage({ id, kind: 'error', error: err instanceof Error ? err.message : String(err) });
  }
};
