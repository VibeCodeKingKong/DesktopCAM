import { importDxf } from './dxf';
import { importSvg } from './svg';
import type { ImportFormat, ImportOptions, ImportResult } from './types';

export * from './types';
export { parseXml } from './xml';
export { parsePathData } from './svgPath';
export { importSvg, importDxf };

export function detectFormat(fileName: string, text: string): ImportFormat | null {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'svg') return 'svg';
  if (ext === 'dxf') return 'dxf';
  if (/<svg[\s>]/i.test(text.slice(0, 4096))) return 'svg';
  if (/^\s*0\s*\r?\n\s*SECTION/.test(text)) return 'dxf';
  return null;
}

export function importVectorFile(format: ImportFormat, text: string, options: ImportOptions): ImportResult {
  return format === 'svg' ? importSvg(text, options) : importDxf(text, options);
}
