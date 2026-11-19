/**
 * Limma och plana ett V-inlägg i simuleringen.
 *
 * Pluggens yta (inläggsträet efter fräsningen) vänds upp och ner, speglas
 * tillbaka och sänks ner i fickan tills den tar i någonstans. Sedan planas
 * allt ovanför grundträets yta bort. För varje punkt på ytan blir resultatet
 * grundträ, inlägg eller en glipa – och hur tjockt inlägget är där.
 */
import type { StockSimulator } from './simulation';

export interface InlayPlacement {
  /** Inläggsträets nedre vänstra hörn i ritningens koordinater (speglat). */
  x0: number;
  y0: number;
  /** Spegelaxelns X (formernas mitt). */
  cx: number;
}

export interface InlayFitResult {
  /** Hur djupt pluggens ursprungliga ovansida hamnar under grundträets yta (mm). */
  sink: number;
  /** Största limspalt mellan plugg och ficka (mm). */
  maxGap: number;
  /** Andel av fickans yta som täcks av inlägget, som har glipor och som blir tunnare än 0,3 mm. */
  filled: number;
  voids: number;
  thin: number;
  /** Pluggens ovansida ligger över grundträets yta – den kan inte sänkas ner alls. */
  blocked: boolean;
}

/** Tunnare inlägg än så här efter planing markeras (mm). */
export const THIN_INLAY = 0.3;
/** Andel av pluggens punkter som får ge efter (tryckas ihop) när den sänks ner. */
const CRUSH_SHARE = 0.002;
/** Grundare än så här räknas inte som ficka (rutnätets och kantens tolerans, mm). */
const POCKET_TOL = 0.3;

export type CellKind = 0 | 1 | 2 | 3; // 0 grundträ, 1 inlägg, 2 glipa, 3 tunt inlägg

/**
 * Lägger pluggen i fickan. Returnerar passningen och vad som syns i varje
 * punkt av grundträet efter planingen (kind) samt höjden där (0 eller glipans djup).
 */
export function assembleInlay(base: StockSimulator, plug: StockSimulator, at: InlayPlacement, kind: Uint8Array, heights: Float32Array): InlayFitResult {
  const hb = base.heights;
  const hp = plug.heights;
  const pnx = plug.nx, pny = plug.ny, pc = plug.cell;

  // Inläggsträet sågas ut i den djupast frästa ringen runt pluggen före
  // limningen: fyll från kanten genom allt som är grundare än ringen. Det
  // som blir kvar innanför är pluggen (med ringen som fläns).
  const rim = new Uint8Array(pnx * pny);
  const stack: number[] = [];
  let deepest = 0;
  for (let k = 0; k < hp.length; k++) deepest = Math.min(deepest, hp[k]);
  // Marginal: rutnätet mellan fräsens varv står några tiondelar högre än botten.
  const limit = deepest + Math.max(0.3, 0.15 * -deepest);
  const uncut = (k: number) => hp[k] > limit;
  for (let i = 0; i < pnx; i++) stack.push(i, (pny - 1) * pnx + i);
  for (let j = 0; j < pny; j++) stack.push(j * pnx, j * pnx + pnx - 1);
  while (stack.length) {
    const k = stack.pop()!;
    if (rim[k] || !uncut(k)) continue;
    rim[k] = 1;
    const i = k % pnx, j = (k - i) / pnx;
    if (i > 0) stack.push(k - 1);
    if (i < pnx - 1) stack.push(k + 1);
    if (j > 0) stack.push(k - pnx);
    if (j < pny - 1) stack.push(k + pnx);
  }

  // Pluggens höjd under en punkt i grundträet (NaN där pluggen inte finns).
  const ox = base.origin.x, oy = base.origin.y;
  const plugAt = (x: number, y: number) => {
    const lx = 2 * at.cx - at.x0 - x, ly = y - at.y0;
    const i = Math.round(lx / pc), j = Math.round(ly / pc);
    if (i < 0 || j < 0 || i >= pnx || j >= pny) return NaN;
    const k = j * pnx + i;
    return rim[k] ? NaN : hp[k];
  };

  const n = base.nx * base.ny;
  const under = new Float32Array(n).fill(NaN);
  // Pluggen sänks tills den tar i: d = max(hb + hp) över alla punkter där den
  // finns. Enstaka punkter får ge efter: vid hårfina streck är V-spåret
  // smalare än rutnätet, så både spårets botten och pluggens spets blir för
  // trubbiga – och i verkligheten pressas så fina spetsar ihop vid limningen.
  const contact: number[] = [];
  for (let j = 0; j < base.ny; j++) {
    for (let i = 0; i < base.nx; i++) {
      const k = j * base.nx + i;
      const p = plugAt(ox + i * base.cell, oy + j * base.cell);
      if (Number.isNaN(p)) continue;
      under[k] = p;
      contact.push(hb[k] + p);
    }
  }
  if (!contact.length) return { sink: 0, maxGap: 0, filled: 0, voids: 0, thin: 0, blocked: false };
  contact.sort((a, b) => b - a);
  const d = contact[Math.min(contact.length - 1, Math.floor(contact.length * CRUSH_SHARE))];
  const result: InlayFitResult = { sink: 0, maxGap: 0, filled: 0, voids: 0, thin: 0, blocked: false };
  result.sink = -d;
  result.blocked = d >= -1e-3;

  let pocket = 0;
  for (let k = 0; k < n; k++) {
    const p = under[k];
    // Närmast fickans kant är både fickan och inlägget naturligt tunna, och
    // simuleringens rutnät ger några tiondelars avvikelse – räkna bara där
    // fickan är djupare än toleransen.
    const inPocket = hb[k] < -POCKET_TOL;
    // Pluggens undersida här (efter vändning): d − hp.
    const bottom = Number.isNaN(p) ? Infinity : d - p;
    if (inPocket && !Number.isNaN(p)) pocket++;
    if (bottom < -1e-3) {
      const thick = -bottom;
      kind[k] = thick < THIN_INLAY && hb[k] < -2 * THIN_INLAY ? 3 : 1;
      heights[k] = 0;
      if (inPocket) {
        result.maxGap = Math.max(result.maxGap, bottom - hb[k]);
        if (kind[k] === 3) result.thin++;
        else result.filled++;
      }
    } else if (inPocket && !Number.isNaN(p)) {
      // Fickan syns i ytan: pluggen når inte ner hit.
      kind[k] = 2;
      heights[k] = hb[k];
      result.voids++;
    }
  }
  if (pocket) {
    result.filled /= pocket;
    result.voids /= pocket;
    result.thin /= pocket;
  }
  return result;
}
