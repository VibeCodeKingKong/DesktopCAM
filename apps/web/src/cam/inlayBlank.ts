/**
 * Inläggsträet (pluggens ämne) i ett V-inlägg.
 *
 * Pluggen fräses i ett eget stycke trä. Dess G-kod räknas därför från
 * inläggsträets eget nollpunkt – nere till vänster och Z0 på ovansidan –
 * precis som grundträets. Storleken räknas fram automatiskt: pluggens yta
 * (spegelvänd), plus den bortfrästa marginalen runt den, plus en kant att
 * spänna fast i. I 3D-vyn och simuleringen ligger inläggsträet bredvid
 * grundträet.
 */
import { shapesBounds, transformShape, type InlayToolpath, type MaterialSetup, type ReliefInstance, type VectorShape } from '@desktopcam/core';

/** Kant utanför den bortfrästa marginalen (mm). */
export const PLUG_BLANK_BORDER = 5;
/** Avstånd mellan grundträet och inläggsträet i 3D-vyn (mm). */
export const PLUG_BLANK_GAP = 20;
export const DEFAULT_PLUG_MATERIAL = 'walnut';

export interface PlugBlank {
  /** Inläggsträets nedre vänstra hörn i ritningens koordinater (efter spegling). */
  x0: number;
  y0: number;
  width: number;
  height: number;
  thickness: number;
  /** Var inläggsträet visas i 3D-vyn (dess nedre vänstra hörn). */
  displayX: number;
  displayY: number;
}

/** Spegelvänder former runt deras gemensamma mitt (pluggen är spegelvänd). */
export function mirrorInPlace(shapes: VectorShape[]): VectorShape[] {
  const b = shapesBounds(shapes);
  if (!b) return shapes;
  const cx = (b.min.x + b.max.x) / 2;
  return shapes.map((s) => transformShape(s, [-1, 0, 0, 1, 2 * cx, 0]));
}

/** Spegelaxelns X (formernas mitt) – behövs för att lägga pluggen på plats i fickan. */
export function mirrorAxis(shapes: VectorShape[]): number {
  const b = shapesBounds(shapes);
  return b ? (b.min.x + b.max.x) / 2 : 0;
}

/** Inläggsträets mått för en plugg, räknat från de (ospeglade) formerna. */
export function plugBlank(tp: Pick<InlayToolpath, 'margin' | 'plugDepth'>, shapes: VectorShape[], material: MaterialSetup): PlugBlank | null {
  const b = shapesBounds(mirrorInPlace(shapes));
  if (!b) return null;
  const border = tp.margin + PLUG_BLANK_BORDER;
  const width = Math.ceil(b.max.x - b.min.x + 2 * border);
  const height = Math.ceil(b.max.y - b.min.y + 2 * border);
  return {
    x0: b.min.x - border,
    y0: b.min.y - border,
    width,
    height,
    // Tjockt nog för pluggen plus minst 3 mm att hålla ihop den, minst 6 mm.
    thickness: Math.max(6, Math.ceil(tp.plugDepth + 3)),
    displayX: material.width + PLUG_BLANK_GAP,
    displayY: 0,
  };
}

/**
 * Inläggsträet för pluggen i ett reliefinlägg. Pluggens relief (redan
 * spegelvänd) ligger på samma ställe som fickan i ritningen; inläggsträet är
 * den ytan plus en kant att spänna fast i, och lika tjockt som pluggbrädan
 * plus minst 3 mm att hålla ihop den.
 */
export function reliefPlugBlank(r: ReliefInstance, material: MaterialSetup): PlugBlank | null {
  if (!r.plug || !(r.width > 0) || !(r.height > 0)) return null;
  const B = PLUG_BLANK_BORDER;
  return {
    x0: r.x - B,
    y0: r.y - B,
    width: Math.ceil(r.width + 2 * B),
    height: Math.ceil(r.height + 2 * B),
    thickness: Math.max(6, Math.ceil(r.depth + 3)),
    displayX: material.width + PLUG_BLANK_GAP,
    displayY: 0,
  };
}

/** Spegelaxeln för en reliefplugg: fickans mitt (pluggen vänds runt den). */
export const reliefMirrorAxis = (r: ReliefInstance) => r.x + r.width / 2;
