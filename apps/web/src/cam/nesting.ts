/**
 * Placera ut delar på skivan: de markerade formerna (en grupp är en del), i
 * valfritt antal kopior, packas tätt på arbetsstycket med ett avstånd mellan
 * delarna och till kanten.
 *
 * Packningen görs med maxrects-packer (MIT) på delarnas omslutande
 * rektanglar, med valfri vridning 90°. Det är inte äkta formutplacering
 * (delar flätas inte in i varandra) – men snabbt, förutsägbart och bra för
 * de flesta skivor med rektangulära eller kompakta delar.
 */
import { MaxRectsBin } from 'maxrects-packer';
import { multiply, rotate, shapesBounds, transformShape, translate, uid, type Mat2D, type VectorShape } from '@desktopcam/core';
import { getT } from '../i18n';
import { allShapes, useAppStore } from '../store/useAppStore';
import { scheduleCompute } from './toolpathService';

export interface NestOptions {
  /** Antal av varje markerad del (1 = bara originalen). */
  copies: number;
  /** Avstånd mellan delarna (mm). */
  spacing: number;
  /** Avstånd till arbetsstyckets kant (mm). */
  margin: number;
  /** Får vridas 90° om det ger bättre plats. */
  rotate: boolean;
}

interface Unit {
  shapes: VectorShape[];
  x0: number;
  y0: number;
  w: number;
  h: number;
}

export interface NestPlacement {
  unit: number;
  copy: number;
  /** Transform från delens nuvarande läge till den nya platsen. */
  m: Mat2D;
  rotated: boolean;
}

export interface NestPlan {
  units: Unit[];
  placements: NestPlacement[];
  /** Antal delar som skulle placeras (units × copies). */
  wanted: number;
  /** Andel av arbetsstycket som delarnas rektanglar täcker (0–1). */
  usage: number;
}

function selectedUnits(): Unit[] {
  const s = useAppStore.getState();
  const sel = allShapes(s.layers).filter((sh) => s.selectedShapeIds.includes(sh.id));
  const byKey = new Map<string, VectorShape[]>();
  for (const sh of sel) byKey.set(sh.groupId ?? sh.id, [...(byKey.get(sh.groupId ?? sh.id) ?? []), sh]);
  const out: Unit[] = [];
  for (const shapes of byKey.values()) {
    const b = shapesBounds(shapes);
    if (b && b.max.x - b.min.x > 1e-6 && b.max.y - b.min.y > 1e-6) out.push({ shapes, x0: b.min.x, y0: b.min.y, w: b.max.x - b.min.x, h: b.max.y - b.min.y });
  }
  return out;
}

/** Räknar ut placeringen utan att ändra något (för förhandsvisningen). */
export function planNesting(o: NestOptions): NestPlan {
  const { material } = useAppStore.getState();
  const units = selectedUnits();
  const copies = Math.max(1, Math.round(o.copies));
  const W = material.width - 2 * o.margin + o.spacing;
  const H = material.height - 2 * o.margin + o.spacing;
  const items: { unit: number; copy: number; w: number; h: number }[] = [];
  units.forEach((u, i) => {
    for (let c = 0; c < copies; c++) items.push({ unit: i, copy: c, w: u.w + o.spacing, h: u.h + o.spacing });
  });
  const placements: NestPlacement[] = [];
  let area = 0;
  if (W > 0 && H > 0) {
    // Största delarna först – då blir packningen tätast.
    items.sort((a, b) => b.w * b.h - a.w * a.h || b.h - a.h);
    const bin = new MaxRectsBin(W, H, 0, { smart: false, pot: false, square: false, allowRotation: o.rotate });
    for (const it of items) {
      const r = bin.add(it.w, it.h, it);
      if (!r) continue;
      const u = units[it.unit];
      const rotated = !!r.rot;
      // Vrid kring delens mitt, flytta sedan nedre vänstra hörnet till platsen.
      const cx = u.x0 + u.w / 2, cy = u.y0 + u.h / 2;
      const w = rotated ? u.h : u.w, h = rotated ? u.w : u.h;
      const turn = rotated ? multiply(translate(cx, cy), multiply(rotate(90), translate(-cx, -cy))) : translate(0, 0);
      const minX = cx - w / 2, minY = cy - h / 2;
      const m = multiply(translate(o.margin + r.x - minX, o.margin + r.y - minY), turn);
      placements.push({ unit: it.unit, copy: it.copy, m, rotated });
      area += u.w * u.h;
    }
  }
  return { units, placements, wanted: items.length, usage: material.width * material.height > 0 ? area / (material.width * material.height) : 0 };
}

/** Utför placeringen: originalen flyttas, kopiorna läggs till (i samma lager och banor). */
export function applyNesting(o: NestOptions): NestPlan {
  const plan = planNesting(o);
  const s = useAppStore.getState();
  const t = getT();
  if (!plan.placements.length) {
    s.setStatus(t.nesting.noneFit);
    return plan;
  }
  const moved = new Map<string, VectorShape>();
  const added = new Map<string, VectorShape[]>(); // original-id → kopior
  for (const p of plan.placements) {
    const u = plan.units[p.unit];
    const group = p.copy > 0 && u.shapes[0].groupId ? uid('group') : undefined;
    for (const sh of u.shapes) {
      const out = transformShape(sh, p.m);
      const isTranslate = !p.rotated;
      const text = sh.text && isTranslate ? { ...sh.text, x: sh.text.x + p.m[4], y: sh.text.y + p.m[5] } : undefined;
      if (p.copy === 0) moved.set(sh.id, { ...out, text, frameAngle: isTranslate ? sh.frameAngle : undefined });
      else
        added.set(sh.id, [
          ...(added.get(sh.id) ?? []),
          { ...out, id: uid('shape'), name: `${sh.name} ${p.copy + 1}`, groupId: group, text, frameAngle: isTranslate ? sh.frameAngle : undefined, paths: out.paths.map((pp) => ({ ...pp, id: uid('path') })) },
        ]);
    }
  }
  // Delar som inte fick plats (originalen) står kvar där de var.
  s.checkpoint();
  const layers = s.layers.map((l) => {
    if (!l.shapes.some((sh) => moved.has(sh.id) || added.has(sh.id))) return l;
    const shapes: VectorShape[] = [];
    for (const sh of l.shapes) {
      shapes.push(moved.get(sh.id) ?? sh);
    }
    for (const sh of l.shapes) shapes.push(...(added.get(sh.id) ?? []));
    return { ...l, shapes };
  });
  // Banor som använder en del använder också dess kopior.
  const toolpaths = s.toolpaths.map((tp) => {
    const extra = tp.shapeIds.flatMap((id) => (added.get(id) ?? []).map((c) => c.id));
    return extra.length ? { ...tp, shapeIds: [...tp.shapeIds, ...extra] } : tp;
  });
  const selected = [...moved.keys(), ...[...added.values()].flat().map((c) => c.id)];
  useAppStore.setState({ layers, toolpaths, selectedShapeIds: selected, selectedNode: null });
  for (const tp of toolpaths) if (tp.shapeIds.some((id) => moved.has(id) || selected.includes(id))) scheduleCompute(tp.id, 50);
  const pct = Math.round(plan.usage * 100).toLocaleString(t.locale);
  s.setStatus(
    plan.placements.length < plan.wanted
      ? t.nesting.partial(String(plan.placements.length), String(plan.wanted), pct)
      : t.nesting.done(String(plan.placements.length), pct),
  );
  return plan;
}
