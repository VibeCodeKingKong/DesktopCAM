import type { FeatureIssue } from './features';
import type { TraceOptions } from './trace';
/**
 * Meddelandeprotokoll mellan UI-tråden och CAM-workern.
 * Allt här måste vara strukturkloningsbart (inga funktioner/klasser).
 */
import type { PlotterJob } from './plotter';
import type { PenImageInput } from './plotterImage';

/** Bild till linjer: bilden och pennans inställningar (linjerna räknas i workern). */
export interface PlotterImageJob extends Omit<PlotterJob, 'paths'> {
  input: PenImageInput;
}
import type { ImportFormat, ImportOptions, ImportResult } from './import/types';
import type { VCarveJob } from './vcarve';
import type { RouterProfileJob } from './profileStrategy';
import type { PlasmaJob } from './plasma';
import type { DitherMethod, PocketStrategy, PostprocessorConfig, ToolKind, ToolpathStats } from './types';

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
  /** Materialets tjocklek (för kontrollen av små detaljer). */
  materialThickness?: number;
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
  /** Materialets tjocklek (för kontrollen av små detaljer). */
  materialThickness?: number;
  toolDiameter: number;
  /** Andel av diametern. */
  stepOver: number;
  cutDepth: number;
  stepDown: number;
  feedRate: number;
  plungeRate: number;
  spindleRpm: number;
  post: PostprocessorConfig;
  /** Strategi; saknas den rensas fickan konturparallellt utan finpass. */
  strategy?: PocketStrategy;
}

export interface DrillJob {
  points: { x: number; y: number }[];
  depth: number;
  peckDepth: number;
  plungeRate: number;
  spindleRpm: number;
  post: PostprocessorConfig;
}

export interface FacingJob {
  /** Ytan som ska planas (mm). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  toolDiameter: number;
  /** Sidstegning som andel av diametern. */
  stepOver: number;
  depth: number;
  stepDown: number;
  feedRate: number;
  plungeRate: number;
  spindleRpm: number;
  pattern: 'zigzag' | 'oneway';
  direction: 'x' | 'y';
  overhang: number;
  post: PostprocessorConfig;
}

/** Spåra en bild (Smart Trace). Gråskalan i pixlar, resultatet i mm. */
export interface TraceJob {
  gray: Uint8Array;
  /** Färgmättnad per bildpunkt (för skuggfiltret), samma storlek som gray. */
  chroma?: Uint8Array;
  width: number;
  height: number;
  options: TraceOptions;
  /** Kalibrering: mm per pixel i den här bilden. */
  mmPerPx: number;
  /** Förskjutning av konturerna (mm): positivt utåt, negativt inåt, 0 = ingen. */
  offsetMm: number;
}

export interface TracedObjectMm {
  id: number;
  /** Slutna konturer i mm, y uppåt, bildens nedre vänstra hörn = (0, 0). */
  loops: number[][];
  /** Öppna linjer (mittlinje) i mm. */
  lines: number[][];
  /** Yta i mm² (före förskjutning). */
  area: number;
  /** Omslutande rektangel i mm: [x0, y0, x1, y1]. */
  bbox: [number, number, number, number];
}

export interface TraceResultMm {
  threshold: number;
  objects: TracedObjectMm[];
}

export type CamRequest =
  | { type: 'ping' }
  | { type: 'profile'; job: ProfileJob }
  | { type: 'raster'; job: RasterJob }
  | { type: 'relief'; job: ReliefJob }
  | { type: 'pocket'; job: PocketJob }
  | { type: 'drill'; job: DrillJob }
  | { type: 'facing'; job: FacingJob }
  | { type: 'plotter'; job: PlotterJob }
  | { type: 'plotterImage'; job: PlotterImageJob }
  | { type: 'vcarve'; job: VCarveJob }
  | { type: 'routerProfile'; job: RouterProfileJob }
  | { type: 'plasma'; job: PlasmaJob }
  | { type: 'import'; format: ImportFormat; text: string; options: ImportOptions }
  | { type: 'traceDetect'; gray: Uint8Array; width: number; height: number }
  | { type: 'traceRectify'; rgba: Uint8ClampedArray; width: number; height: number; quad: [number, number][]; outW: number; outH: number }
  | { type: 'trace'; job: TraceJob };

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
  /** Detaljer som är för små för verktyget (plasma, laser, fräsprofil, ficka). */
  features?: FeatureIssue[];
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
  facing: ToolpathPayload;
  plotter: ToolpathPayload;
  plotterImage: ToolpathPayload;
  vcarve: ToolpathPayload;
  routerProfile: ToolpathPayload;
  plasma: ToolpathPayload;
  import: ImportResult;
  traceDetect: [number, number][] | null;
  traceRectify: Uint8ClampedArray;
  trace: TraceResultMm;
}

export interface WorkerInbound {
  id: number;
  request: CamRequest;
}

export type WorkerOutbound =
  | { id: number; kind: 'result'; result: unknown }
  | { id: number; kind: 'progress'; value: number; message?: string }
  | { id: number; kind: 'error'; error: string };
