/**
 * Meddelandeprotokoll mellan UI-tråden och CAM-workern.
 * Allt här måste vara strukturkloningsbart (inga funktioner/klasser).
 */
import type { ImportFormat, ImportOptions, ImportResult } from './import/types';
import type { VCarveJob } from './vcarve';
import type { RouterProfileJob } from './profileStrategy';
import type { DitherMethod, PostprocessorConfig, ToolKind, ToolpathStats } from './types';

export interface PolylineInput {
  /** Platta koordinater: [x0, y0, x1, y1, …] */
  points: number[];
  closed: boolean;
}

export interface ProfileJob {
  polylines: PolylineInput[];
  /** Polylinjer per form. Om satt beräknas offset robust med avståndsfält i workern. */
  groups?: PolylineInput[][];
  /** Positiv = utåt, negativ = inåt, 0 = på linjen. */
  offset: number;
  mode: 'router' | 'laser';
  cutDepth: number;
  stepDown: number;
  feedRate: number;
  plungeRate: number;
  spindleRpm: number;
  /** Lasereffekt i maskinens S-skala (t.ex. 0–1000). */
  laserS: number;
  passes: number;
  post: PostprocessorConfig;
}

export interface RasterJob {
  /** Gråskala 0–255, rad för rad uppifrån. */
  gray: Uint8Array;
  width: number;
  height: number;
  method: DitherMethod;
  threshold: number;
  pixelSizeMm: number;
  originX: number;
  originY: number;
  feedRate: number;
  laserS: number;
  post: PostprocessorConfig;
}

export interface ReliefJob {
  /** Höjdkarta 0…1, rad för rad nerifrån. Z = (h − 1) · depth. */
  heights: Float32Array;
  nx: number;
  ny: number;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  tool: { kind: ToolKind; diameter: number; angle?: number };
  stepOverMm: number;
  roughStepOverMm: number;
  direction: 'x' | 'y';
  roughing: boolean;
  stepDown: number;
  allowance: number;
  feedRate: number;
  plungeRate: number;
  spindleRpm: number;
  post: PostprocessorConfig;
}

export interface PocketJob {
  /** En grupp per form; slutna banor i en grupp fylls jämn-udda (hål blir hål). */
  groups: PolylineInput[][];
  toolDiameter: number;
  /** Andel av diametern. */
  stepOver: number;
  cutDepth: number;
  stepDown: number;
  feedRate: number;
  plungeRate: number;
  spindleRpm: number;
  post: PostprocessorConfig;
}

export interface DrillJob {
  points: { x: number; y: number }[];
  depth: number;
  peckDepth: number;
  plungeRate: number;
  spindleRpm: number;
  post: PostprocessorConfig;
}

export type CamRequest =
  | { type: 'ping' }
  | { type: 'profile'; job: ProfileJob }
  | { type: 'raster'; job: RasterJob }
  | { type: 'relief'; job: ReliefJob }
  | { type: 'pocket'; job: PocketJob }
  | { type: 'drill'; job: DrillJob }
  | { type: 'vcarve'; job: VCarveJob }
  | { type: 'routerProfile'; job: RouterProfileJob }
  | { type: 'import'; format: ImportFormat; text: string; options: ImportOptions };

export interface EngineInfo {
  engine: 'wasm' | 'typescript';
  version: string;
  threads: number;
  crossOriginIsolated: boolean;
}

export interface GcodePreview {
  /** Linjesegment som par av punkter: [x0,y0,z0, x1,y1,z1, …] */
  rapids: Float32Array;
  cuts: Float32Array;
  stats: ToolpathStats;
}

export interface ToolpathPayload {
  gcode: string;
  preview: GcodePreview;
}

export interface RasterPayload extends ToolpathPayload {
  bits: Uint8Array;
  width: number;
  height: number;
}

export interface CamResponseMap {
  ping: EngineInfo;
  profile: ToolpathPayload;
  raster: RasterPayload;
  relief: ToolpathPayload;
  pocket: ToolpathPayload;
  drill: ToolpathPayload;
  vcarve: ToolpathPayload;
  routerProfile: ToolpathPayload;
  import: ImportResult;
}

export interface WorkerInbound {
  id: number;
  request: CamRequest;
}

export type WorkerOutbound =
  | { id: number; kind: 'result'; result: unknown }
  | { id: number; kind: 'progress'; value: number; message?: string }
  | { id: number; kind: 'error'; error: string };
