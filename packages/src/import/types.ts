import type { Vec2, VectorShape } from '../types';

export type ImportFormat = 'svg' | 'dxf';

export interface ImportOptions {
  /** Pixlar per tum för SVG utan enheter. Inkscape/webben: 96, äldre Illustrator: 72. */
  svgDpi: number;
  /** mm per ritningsenhet. null = läs från filen. */
  unitScale: number | null;
  /** Sammanfoga lösa linjer och bågar till sammanhängande konturer. */
  join: boolean;
  joinTolerance: number;
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = { svgDpi: 96, unitScale: null, join: true, joinTolerance: 0.02 };

export interface ImportedLayer {
  name: string;
  shapes: VectorShape[];
}

export interface ImportResult {
  format: ImportFormat;
  layers: ImportedLayer[];
  warnings: string[];
  bounds: { min: Vec2; max: Vec2 } | null;
  /** Hur enheten bestämdes, visas i importdialogen. */
  unitsNote: string;
  shapeCount: number;
  openPathCount: number;
}
