/**
 * Bildanalys av ett fotograferat prov (laser): hur mörk och hur jämn varje
 * ruta är, jämfört med det obearbetade materialet runt rutorna.
 *
 * Bilden ska först rätas upp så att den täcker exakt provets yta (fotospårningens
 * perspektivkorrigering). Analysen är en ren mätning av gråtoner i bilden –
 * ingen AI – och ger bara visuella observationer: ljus, kamera och materialets
 * färg påverkar resultatet. Mått (snittbredd, djup) kan inte läsas ur ett foto.
 */
import type { CalCell, CalibrationPlan } from './types';

export interface CellReading {
  id: string;
  label: string;
  values: Record<string, number>;
  /** 0 = som obearbetat material, 1 = svart. Relativt materialet runt rutorna. */
  darkness: number;
  /** Ojämnhet inom rutan (standardavvikelse, 0–1). Låg = jämn yta. */
  unevenness: number;
}

export interface GridAnalysis {
  readings: CellReading[];
  /** Materialets ljushet runt rutorna (0–1). */
  background: number;
  /** Hur säker analysen är, utifrån kontrasten mellan rutorna och bildens brus. */
  confidence: 'low' | 'medium' | 'high';
  /** Begränsningar att visa för användaren (koder). */
  limitations: string[];
}

/**
 * Mäter rutorna i en upprätad gråskalebild (bredd w, höjd h) som täcker
 * planens yta: x från plan.x till plan.x + width, y uppåt (bildens rad 0 är överkanten).
 */
export function analyzeGrid(gray: Uint8Array | Uint8ClampedArray, w: number, h: number, plan: CalibrationPlan): GridAnalysis {
  const toPx = (x: number, y: number) => [((x - plan.x) / plan.width) * (w - 1), ((plan.y + plan.height - y) / plan.height) * (h - 1)];
  const sample = (c: CalCell, inset: number) => {
    // Bara mitten av rutan: kanterna kan ligga lite fel efter upprätningen.
    const ix = (c.x1 - c.x0) * inset, iy = (c.y1 - c.y0) * inset;
    const [a0, b0] = toPx(c.x0 + ix, c.y1 - iy);
    const [a1, b1] = toPx(c.x1 - ix, c.y0 + iy);
    let sum = 0, sum2 = 0, n = 0;
    for (let j = Math.max(0, Math.floor(b0)); j <= Math.min(h - 1, Math.ceil(b1)); j++)
      for (let i = Math.max(0, Math.floor(a0)); i <= Math.min(w - 1, Math.ceil(a1)); i++) {
        const v = gray[j * w + i] / 255;
        sum += v;
        sum2 += v * v;
        n++;
      }
    const mean = n ? sum / n : 1;
    return { mean, sd: n ? Math.sqrt(Math.max(0, sum2 / n - mean * mean)) : 0, n };
  };
  // Materialet: smala remsor mellan rutorna och runt dem (ej i någon ruta).
  const inCell = (x: number, y: number) => plan.cells.some((c) => x >= c.x0 - 0.5 && x <= c.x1 + 0.5 && y >= c.y0 - 0.5 && y <= c.y1 + 0.5);
  let bs = 0, bs2 = 0, bn = 0;
  for (let j = 0; j < h; j += 2)
    for (let i = 0; i < w; i += 2) {
      const x = plan.x + (i / (w - 1)) * plan.width, y = plan.y + plan.height - (j / (h - 1)) * plan.height;
      if (inCell(x, y)) continue;
      const v = gray[j * w + i] / 255;
      bs += v;
      bs2 += v * v;
      bn++;
    }
  const bg = bn ? bs / bn : 1;
  const bgSd = bn ? Math.sqrt(Math.max(0, bs2 / bn - bg * bg)) : 0;
  const readings = plan.cells.map((c) => {
    const s = sample(c, 0.2);
    return { id: c.id, label: c.label, values: c.values, darkness: Math.max(0, Math.min(1, (bg - s.mean) / Math.max(0.05, bg))), unevenness: Math.min(1, s.sd * 2) };
  });
  const ds = readings.map((r) => r.darkness);
  const spread = ds.length ? Math.max(...ds) - Math.min(...ds) : 0;
  const limitations = ['visualOnly', 'lighting'];
  if (bgSd > 0.12) limitations.push('noisyBackground');
  if (spread < 0.1) limitations.push('lowContrast');
  const confidence: GridAnalysis['confidence'] = spread > 0.3 && bgSd < 0.08 ? 'high' : spread > 0.12 && bgSd < 0.14 ? 'medium' : 'low';
  return { readings, background: bg, confidence, limitations };
}

/**
 * Rutor som ligger närmast en önskad mörkhet (0–1), jämnast först. Vid lika
 * resultat vinner högre hastighet och lägre effekt (snabbare, skonsammare).
 */
export function bestCells(a: GridAnalysis, target: number, count = 3): CellReading[] {
  const score = (r: CellReading) => Math.abs(r.darkness - target) + 0.5 * r.unevenness - 1e-5 * (r.values.speed ?? 0) + 1e-4 * (r.values.power ?? 0);
  return [...a.readings].sort((x, y) => score(x) - score(y)).slice(0, count);
}
