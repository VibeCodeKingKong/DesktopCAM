/**
 * Text längs en form (cirkel, kurva, linje): varje tecken byggs för sig och
 * placeras med sin mitt på formen, vridet efter formens riktning.
 *
 * För slutna former går texten medurs, så att den står på utsidan och läses
 * rätt ovanpå (t.ex. överst på en cirkel). "Vänd" lägger den på andra sidan.
 */
import { multiply, rotate, shapesBounds, shapeToPolylines, transformShape, translate, uid, type TextParams, type VectorShape } from '@desktopcam/core';
import { buildTextShape } from './textShape';

export interface TextPathOptions {
  /** Var texten centreras: andel av formens längd (0–1), eller null = överst (sluten form) eller mitten (öppen). */
  position: number | null;
  /** Vänd: texten på andra sidan och åt andra hållet. */
  flip: boolean;
  /** Avstånd från formen till textens baslinje (mm, positivt = bort från formen). */
  offset: number;
}

/** Formens längsta bana som punkter, och om den är sluten. */
function pathOf(shape: VectorShape): { pts: [number, number][]; closed: boolean } | null {
  const pls = shapeToPolylines(shape, 0.05);
  let best: (typeof pls)[number] | null = null;
  let bestLen = 0;
  for (const p of pls) {
    let L = 0;
    for (let i = 2; i < p.points.length; i += 2) L += Math.hypot(p.points[i] - p.points[i - 2], p.points[i + 1] - p.points[i - 1]);
    if (L > bestLen) {
      bestLen = L;
      best = p;
    }
  }
  if (!best || bestLen < 1) return null;
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < best.points.length; i += 2) pts.push([best.points[i], best.points[i + 1]]);
  if (best.closed) pts.push(pts[0]);
  return { pts, closed: best.closed };
}

export function canFollow(shape: VectorShape | undefined): boolean {
  return !!shape && !!pathOf(shape);
}

/** Bygger texten längs formen. Ger en form (inte redigerbar som text), eller null. */
export function textOnPath(p: TextParams, shape: VectorShape, o: TextPathOptions): VectorShape | null {
  const path = pathOf(shape);
  if (!path) return null;
  let pts = path.pts;
  // Slutna former: medurs (negativ area) så att texten står utanpå; vänd = moturs.
  if (path.closed) {
    let a = 0;
    for (let i = 1; i < pts.length; i++) a += pts[i - 1][0] * pts[i][1] - pts[i][0] * pts[i - 1][1];
    const ccw = a > 0;
    if (ccw !== o.flip) pts = [...pts].reverse();
  } else if (o.flip) pts = [...pts].reverse();
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  const at = (u: number): { x: number; y: number; ang: number } => {
    let uu = path.closed ? ((u % L) + L) % L : Math.max(0, Math.min(L, u));
    let k = 1;
    while (k < cum.length - 1 && cum[k] < uu) k++;
    const a = pts[k - 1], b = pts[k];
    const seg = cum[k] - cum[k - 1] || 1;
    uu = Math.max(cum[k - 1], Math.min(cum[k], uu));
    const t = (uu - cum[k - 1]) / seg;
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, ang: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
  };

  // Tecknen för sig, med bredd (mellanslag får en fast bredd).
  const chars = [...p.content.replace(/\n+/g, ' ')];
  const gap = p.height * 0.12 + (p.spacing ?? 0);
  const glyphs = chars.map((ch) => {
    if (!ch.trim()) return { shape: null as VectorShape | null, w: p.height * 0.4 };
    const g = buildTextShape({ ...p, content: ch, x: 0, y: 0, align: 'left' });
    const b = shapesBounds([g]);
    return { shape: g, w: b ? Math.max(b.max.x, p.height * 0.2) : p.height * 0.5, x0: b ? Math.min(0, b.min.x) : 0 };
  });
  const total = glyphs.reduce((a, g) => a + g.w, 0) + gap * Math.max(0, glyphs.length - 1);
  // Centrerad kring vald position – annars överst på en sluten form, mitt på en öppen.
  let center = L / 2;
  if (o.position !== null) center = o.position * L;
  else if (path.closed) {
    let top = 0;
    for (let i = 1; i < pts.length; i++) if (pts[i][1] > pts[top][1]) top = i;
    center = cum[top];
  }
  let u = center - total / 2;
  const paths: VectorShape['paths'] = [];
  for (const g of glyphs) {
    const mid = u + g.w / 2;
    if (g.shape) {
      const q = at(mid);
      // Tecknets mitt (x) och baslinje (y = 0) till formen, sedan avstånd ut från den.
      const m = multiply(translate(q.x, q.y), multiply(rotate(q.ang), translate(-g.w / 2, o.offset)));
      for (const pp of transformShape(g.shape, m).paths) paths.push({ ...pp, id: uid('path') });
    }
    u += g.w + gap;
  }
  if (!paths.length) return null;
  return { id: uid('shape'), name: p.content.replace(/\s+/g, ' ').slice(0, 24), kind: 'imported', paths };
}
