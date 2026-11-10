import type { Vec2, VectorShape } from '../types';

export type ImportFormat = 'svg' | 'dxf';

export type ImportWarningCode =
  | 'textSkipped'
  | 'imagesSkipped'
  | 'pathUnreadable'
  | 'noUnits'
  | 'unsupportedEntity'
  | 'nothingFound'
  | 'openPaths';

export interface ImportWarning {
  code: ImportWarningCode;
  count?: number;
  /** T.ex. DXF-typen som inte stöds. */
  detail?: string;
}

export type UnitsNote =
  | { code: 'manual'; value: number }
  | { code: 'fromFile'; value: string }
  | { code: 'pixels'; value: number }
  | { code: 'none' };

/** Namn på importerade former, skickas från gränssnittet på valt språk. */
export interface ImportLabels {
  contour: string;
  openPath: string;
  path: string;
  rect: string;
  circle: string;
  ellipse: string;
  line: string;
  polyline: string;
  polygon: string;
  layer: string;
}

export const DEFAULT_IMPORT_LABELS: ImportLabels = {
  contour: 'Contour',
  openPath: 'Open path',
  path: 'Path',
  rect: 'Rectangle',
  circle: 'Circle',
  ellipse: 'Ellipse',
  line: 'Line',
  polyline: 'Polyline',
  polygon: 'Polygon',
  layer: 'Imported',
};

export interface ImportOptions {
  /** Pixlar per tum för SVG utan enheter. Inkscape/webben: 96, äldre Illustrator: 72. */
  svgDpi: number;
  /** mm per ritningsenhet. null = läs från filen. */
  unitScale: number | null;
  /** Sammanfoga lösa linjer och bågar till sammanhängande konturer. */
  join: boolean;
  joinTolerance: number;
  labels?: ImportLabels;
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = { svgDpi: 96, unitScale: null, join: true, joinTolerance: 0.02 };

export interface ImportedLayer {
  name: string;
  shapes: VectorShape[];
}

export interface ImportResult {
  format: ImportFormat;
  layers: ImportedLayer[];
  warnings: ImportWarning[];
  bounds: { min: Vec2; max: Vec2 } | null;
  /** Hur enheten bestämdes, visas i importdialogen. */
  unitsNote: UnitsNote;
  shapeCount: number;
  openPathCount: number;
}
