import type { ProfileJob, RasterJob, ReliefJob } from './protocol';
import type { DitherMethod } from './types';

/**
 * Gemensamt gränssnitt för CAM-motorer. Implementeras av:
 *  - Rust/Wasm-motorn (crates/cam-engine), laddas i workern om den är byggd
 *  - TypeScript-referensmotorn (referenceEngine.ts), används som reserv
 * Båda ska ge identisk G-kod för samma indata.
 */
export interface CamEngine {
  readonly kind: 'wasm' | 'typescript';
  readonly version: string;
  profileGcode(job: ProfileJob): string;
  /** Returnerar 1 = bränn, 0 = hoppa över. */
  dither(gray: Uint8Array, width: number, height: number, method: DitherMethod, threshold: number): Uint8Array;
  rasterGcode(bits: Uint8Array, job: RasterJob): string;
  /** 3D-bana för en relief (grovbearbetning + finish). */
  reliefGcode(job: ReliefJob): string;
}
