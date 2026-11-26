/**
 * Mikrobryggor (laser): korta oskurna bitar i ytterkonturerna, så att delar
 * sitter kvar i skivan och inte tippar eller faller ner. Konturen delas i
 * öppna bitar med ett mellanrum (bryggan) mellan dem; strålen är släckt där.
 *
 * Bryggorna läggs jämnt fördelade, med första bryggan en halv delning in, så
 * att ingen hamnar i startpunkten. Konturer som är för korta för bryggorna
 * (omkrets under tre gånger bryggornas sammanlagda bredd) lämnas hela.
 */
import type { PolylineInput } from './protocol';

export interface BridgeSettings {
  /** Antal bryggor per ytterkontur (0 = av). */
  count: number;
  /** Bryggans längd längs konturen (mm). */
  width: number;
}

const pointInPolygon = (x: number, y: number, pts: number[]) => {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Ytterkontur: ligger inuti ett jämnt antal andra slutna konturer (0, 2 …). */
export function outerLoops(polys: PolylineInput[]): boolean[] {
  const closed = polys.map((p) => p.closed && p.points.length >= 6);
  return polys.map((p, i) => {
    if (!closed[i]) return false;
    let n = 0;
    for (let k = 0; k < polys.length; k++) if (k !== i && closed[k] && pointInPolygon(p.points[0], p.points[1], polys[k].points)) n++;
    return n % 2 === 0;
  });
}

/** Punkterna längs en sluten kontur från längden a till b (b > a, får gå förbi slutet). */
function slice(pts: number[], cum: number[], L: number, a: number, b: number): number[] {
  const n = pts.length / 2;
  const at = (u: number): [number, number] => {
    const uu = ((u % L) + L) % L;
    let k = 1;
    while (k < cum.length && cum[k] < uu) k++;
    const i0 = (k - 1) % n, i1 = k % n;
    const seg = cum[k] - cum[k - 1] || 1;
    const t = (uu - cum[k - 1]) / seg;
    return [pts[2 * i0] + (pts[2 * i1] - pts[2 * i0]) * t, pts[2 * i0 + 1] + (pts[2 * i1 + 1] - pts[2 * i0 + 1]) * t];
  };
  const out: number[] = [...at(a)];
  // Alla hörn strikt mellan a och b (även efter ett varv).
  for (let lap = 0; lap <= 1; lap++)
    for (let k = 1; k < cum.length; k++) {
      const u = cum[k] + lap * L;
      if (u > a + 1e-9 && u < b - 1e-9) out.push(pts[2 * (k % n)], pts[2 * (k % n) + 1]);
    }
  out.push(...at(b));
  return out;
}

/** Delar ytterkonturerna i öppna bitar med `count` bryggor. Övriga banor oförändrade. */
export function applyBridges(polys: PolylineInput[], b: BridgeSettings): PolylineInput[] {
  if (!b || b.count < 1 || b.width <= 0) return polys;
  const outer = outerLoops(polys);
  const out: PolylineInput[] = [];
  polys.forEach((p, i) => {
    if (!outer[i]) return void out.push(p);
    const pts = p.points;
    const n = pts.length / 2;
    // Kumulativ längd, med sträckan tillbaka till första punkten sist.
    const cum = [0];
    for (let k = 1; k <= n; k++) {
      const a = (k - 1) % n, c = k % n;
      cum.push(cum[k - 1] + Math.hypot(pts[2 * c] - pts[2 * a], pts[2 * c + 1] - pts[2 * a + 1]));
    }
    const L = cum[n];
    if (L < 3 * b.count * b.width) return void out.push(p);
    const step = L / b.count;
    for (let g = 0; g < b.count; g++) {
      // Biten mellan brygga g och g+1 (bryggornas mitt: (g + 0,5)·delning).
      const a = (g + 0.5) * step + b.width / 2;
      const e = (g + 1.5) * step - b.width / 2;
      out.push({ points: slice(pts, cum, L, a, e), closed: false });
    }
  });
  return out;
}
