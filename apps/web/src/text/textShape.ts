/** Bygger en textform från textparametrarna – enkellinjigt eller kontur-typsnitt. */
import { textToShape, type TextParams, type VectorShape } from '@desktopcam/core';
import { getLoadedFont, isOutlineFont, loadFont } from './fonts';
import { fontTextToShape } from './fontText';

/** Kräver att ett kontur-typsnitt redan är inläst (se ensureTextFont). */
export function buildTextShape(p: TextParams): VectorShape {
  if (isOutlineFont(p.font)) {
    const f = getLoadedFont(p.font!);
    if (!f) throw new Error('FONT_MISSING');
    return fontTextToShape(f, p.content, p.x, p.y, { height: p.height, spacing: p.spacing, align: p.align });
  }
  return textToShape(p.content, p.x, p.y, { height: p.height, spacing: p.spacing, align: p.align, weight: p.weight ?? 0 });
}

/** Läser in typsnittet om det behövs. Egna typsnitt måste läsas in på nytt efter omstart. */
export async function ensureTextFont(font?: string): Promise<boolean> {
  if (!isOutlineFont(font) || getLoadedFont(font!)) return true;
  if (font!.startsWith('custom:')) return false;
  await loadFont(font!);
  return true;
}
