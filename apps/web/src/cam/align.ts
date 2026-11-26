/**
 * Justera och fördela markerade former.
 *
 * En grupp (samma groupId) flyttas som en enhet. Är bara en enhet markerad
 * justeras den mot arbetsstycket, annars mot hela markeringens ram (som i
 * vanliga ritprogram). Spårade foton som hör till formerna följer med.
 */
import { shapesBounds, transformShape, translate, type VectorShape } from '@desktopcam/core';
import { getT } from '../i18n';
import { allShapes, useAppStore } from '../store/useAppStore';

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';
type Box = { x0: number; y0: number; x1: number; y1: number };
interface Unit {
  shapes: VectorShape[];
  b: Box;
}

function selectedUnits(): Unit[] {
  const s = useAppStore.getState();
  const sel = allShapes(s.layers).filter((sh) => s.selectedShapeIds.includes(sh.id));
  const byKey = new Map<string, VectorShape[]>();
  for (const sh of sel) {
    const k = sh.groupId ?? sh.id;
    byKey.set(k, [...(byKey.get(k) ?? []), sh]);
  }
  const units: Unit[] = [];
  for (const shapes of byKey.values()) {
    const b = shapesBounds(shapes);
    if (b) units.push({ shapes, b: { x0: b.min.x, y0: b.min.y, x1: b.max.x, y1: b.max.y } });
  }
  return units;
}

/** Flyttar varje enhet med sin förskjutning – ett ångra-steg för formerna. */
function moveUnits(moves: { u: Unit; dx: number; dy: number }[]) {
  const s = useAppStore.getState();
  const real = moves.filter((m) => Math.abs(m.dx) > 1e-9 || Math.abs(m.dy) > 1e-9);
  if (!real.length) return false;
  const shapes: VectorShape[] = [];
  const imageMoves: { id: string; dx: number; dy: number }[] = [];
  for (const { u, dx, dy } of real) {
    for (const sh of u.shapes) {
      const out = transformShape(sh, translate(dx, dy));
      shapes.push(sh.text ? { ...out, frameAngle: sh.frameAngle, text: { ...sh.text, x: sh.text.x + dx, y: sh.text.y + dy } } : { ...out, frameAngle: sh.frameAngle });
      if (sh.linkedImageId && !imageMoves.some((m) => m.id === sh.linkedImageId)) imageMoves.push({ id: sh.linkedImageId, dx, dy });
    }
  }
  s.replaceShapes(shapes);
  for (const m of imageMoves) {
    const im = useAppStore.getState().imageObjects.find((x) => x.id === m.id);
    if (im) useAppStore.getState().updateImageObject(im.id, { x: +(im.x + m.dx).toFixed(4), y: +(im.y + m.dy).toFixed(4) });
  }
  return true;
}

export function alignSelection(mode: AlignMode): void {
  const s = useAppStore.getState();
  const t = getT();
  const units = selectedUnits();
  if (!units.length) {
    s.setStatus(t.reasons.needsSelection);
    return;
  }
  // En form: mot arbetsstycket. Flera: mot markeringens gemensamma ram.
  const ref: Box =
    units.length === 1
      ? { x0: 0, y0: 0, x1: s.material.width, y1: s.material.height }
      : {
          x0: Math.min(...units.map((u) => u.b.x0)),
          y0: Math.min(...units.map((u) => u.b.y0)),
          x1: Math.max(...units.map((u) => u.b.x1)),
          y1: Math.max(...units.map((u) => u.b.y1)),
        };
  const moves = units.map((u) => {
    let dx = 0, dy = 0;
    if (mode === 'left') dx = ref.x0 - u.b.x0;
    else if (mode === 'right') dx = ref.x1 - u.b.x1;
    else if (mode === 'hcenter') dx = (ref.x0 + ref.x1) / 2 - (u.b.x0 + u.b.x1) / 2;
    else if (mode === 'bottom') dy = ref.y0 - u.b.y0;
    else if (mode === 'top') dy = ref.y1 - u.b.y1;
    else dy = (ref.y0 + ref.y1) / 2 - (u.b.y0 + u.b.y1) / 2;
    return { u, dx, dy };
  });
  moveUnits(moves);
  s.setStatus(units.length === 1 ? t.align.doneStock : t.align.done(String(units.length)));
}

/** Lika stora mellanrum mellan formerna, vågrätt eller lodrätt. De yttersta står still. */
export function distributeSelection(axis: 'h' | 'v'): void {
  const s = useAppStore.getState();
  const t = getT();
  const units = selectedUnits();
  if (units.length < 3) {
    s.setStatus(t.align.needThree);
    return;
  }
  const lo = (u: Unit) => (axis === 'h' ? u.b.x0 : u.b.y0);
  const hi = (u: Unit) => (axis === 'h' ? u.b.x1 : u.b.y1);
  const sorted = [...units].sort((a, b) => lo(a) + hi(a) - (lo(b) + hi(b)));
  const span = hi(sorted[sorted.length - 1]) - lo(sorted[0]);
  const sizes = sorted.reduce((a, u) => a + hi(u) - lo(u), 0);
  const gap = (span - sizes) / (sorted.length - 1);
  let at = lo(sorted[0]);
  const moves = sorted.map((u) => {
    const d = at - lo(u);
    at += hi(u) - lo(u) + gap;
    return { u, dx: axis === 'h' ? d : 0, dy: axis === 'v' ? d : 0 };
  });
  moveUnits(moves);
  // Får formerna inte plats bredvid varandra blir mellanrummet negativt – säg det i klartext.
  s.setStatus(gap < -0.005 ? t.align.distributedOverlap(String(units.length)) : t.align.distributed(String(units.length), (Math.round(gap * 100) / 100).toLocaleString(t.locale)));
}
