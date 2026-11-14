import type { GcodePreview } from './protocol';
import type { ToolpathStats } from './types';
import { arcPoints } from './gcodeOptimize';

const WORD = /([A-Za-z])\s*([-+]?(?:\d+\.?\d*|\.\d+))/g;
/** Antagen snabbförflyttningshastighet för tidsuppskattning (mm/min). */
const RAPID_RATE = 3000;

export const formatNumber = (n: number, decimals: number): string => {
  const s = Number(n.toFixed(decimals)).toString();
  return s === '-0' ? '0' : s;
};

/**
 * Tolkar G-kod (G0/G1, absolut, mm) till linjesegment för 3D-förhandsvisning
 * och statistik. G-koden är "sanningen" – förhandsvisningen visar exakt det
 * som exporteras, oavsett vilken motor som skapade den.
 */
export function parseGcode(src: string): GcodePreview {
  const rapids: number[] = [];
  const cuts: number[] = [];
  let x = 0;
  let y = 0;
  let z = 0;
  let mode = 0;
  let feed = 1000;
  let cutLen = 0;
  let rapidLen = 0;
  let seconds = 0;
  let lineCount = 0;
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  const grow = (px: number, py: number, pz: number) => {
    min.x = Math.min(min.x, px); min.y = Math.min(min.y, py); min.z = Math.min(min.z, pz);
    max.x = Math.max(max.x, px); max.y = Math.max(max.y, py); max.z = Math.max(max.z, pz);
  };

  for (const raw of src.split('\n')) {
    const line = raw.replace(/\(.*?\)/g, '').split(';')[0].trim();
    if (!line) continue;
    lineCount++;
    let nx = x;
    let ny = y;
    let nz = z;
    let moved = false;
    // G92 sätter om koordinaterna (t.ex. efter höjdavkänning) – ingen rörelse.
    if (/\bG92\b/i.test(line)) continue;
    let dwell = false;
    let probe = false;
    let ai = 0, aj = 0;
    WORD.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WORD.exec(line))) {
      const letter = m[1].toUpperCase();
      const value = parseFloat(m[2]);
      switch (letter) {
        case 'G':
          if (value === 0 || value === 1 || value === 2 || value === 3) mode = value;
          else if (value === 4) dwell = true;
          else if (value >= 38 && value < 39) probe = true;
          break;
        case 'P':
          if (dwell) seconds += value;
          break;
        case 'X': nx = value; moved = true; break;
        case 'Y': ny = value; moved = true; break;
        case 'Z': nz = value; moved = true; break;
        case 'I': ai = value; break;
        case 'J': aj = value; break;
        case 'F': feed = value > 0 ? value : feed; break;
      }
    }
    if (!moved || probe) continue;
    if (mode === 2 || mode === 3) {
      // Bågen delas upp i korta delar för förhandsvisningen.
      let px = x, py = y, pz = z;
      for (const [qx, qy, qz] of arcPoints(x, y, z, nx, ny, nz, ai, aj, mode === 2)) {
        cuts.push(px, py, pz, qx, qy, qz);
        const l = Math.hypot(qx - px, qy - py, qz - pz);
        cutLen += l;
        seconds += (l / feed) * 60;
        grow(px, py, pz);
        grow(qx, qy, qz);
        px = qx; py = qy; pz = qz;
      }
      x = nx; y = ny; z = nz;
      continue;
    }
    const len = Math.hypot(nx - x, ny - y, nz - z);
    if (len > 0) {
      if (mode === 0) {
        rapids.push(x, y, z, nx, ny, nz);
        rapidLen += len;
        seconds += (len / RAPID_RATE) * 60;
      } else {
        cuts.push(x, y, z, nx, ny, nz);
        cutLen += len;
        seconds += (len / feed) * 60;
        grow(x, y, z);
        grow(nx, ny, nz);
      }
    }
    x = nx; y = ny; z = nz;
  }

  const empty = !Number.isFinite(min.x);
  const stats: ToolpathStats = {
    cutLengthMm: cutLen,
    rapidLengthMm: rapidLen,
    estimatedSeconds: seconds,
    lineCount,
    bounds: empty ? { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } } : { min, max },
  };
  return { rapids: Float32Array.from(rapids), cuts: Float32Array.from(cuts), stats };
}
