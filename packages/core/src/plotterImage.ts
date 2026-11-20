/**
 * Bild till linjer för penplotter. En penna kan inte rita gråtoner – tonen
 * byggs av linjer:
 *
 *  - Skraffering: lager av parallella linjer i olika vinklar. Mörkare
 *    partier får fler lager (1–4).
 *  - Spiral: en enda spiral från mitten som vågar sig mer där bilden är
 *    mörk.
 *  - Prickar: prickar fördelade efter tonen med viktad Voronoi-stippling
 *    (Secord 2002): punkterna flyttas mot tyngdpunkten i sin Voronoi-cell,
 *    viktad med bildens mörkhet. Prickarna kan bindas ihop till en enda
 *    linje.
 *
 * Bildens Delaunay/Voronoi räknas med d3-delaunay (ISC).
 */
import { Delaunay } from 'd3-delaunay';
import type { PolylineInput } from './protocol';

export interface PenImageSettings {
  method: 'hatch' | 'spiral' | 'stipple';
  /** Linjeavstånd (skraffering), varvavstånd (spiral) (mm). */
  spacing: number;
  /** Skraffering: antal tonlager 1–4. */
  levels: number;
  /** Prickar: antal. */
  dots: number;
  /** Prickar: bind ihop till en enda linje. */
  connect: boolean;
  /** Ljust blir bläck (för mörkt papper eller ljus penna). */
  invert: boolean;
  /** Kontrast runt mellantonerna, 0,5–3. */
  contrast: number;
}

export interface PenImageInput {
  /** Gråskala 0–255, rad för rad uppifrån. */
  gray: Uint8Array;
  width: number;
  height: number;
  /** Bildens nedre vänstra hörn och bredd på papperet (mm). */
  x: number;
  y: number;
  widthMm: number;
  settings: PenImageSettings;
}

/** Mörkhet 0–1 i en punkt (mm), bilinjärt, med kontrast. Utanför bilden: 0. */
function darknessSampler(inp: PenImageInput) {
  const { gray, width: w, height: h, x: x0, y: y0, widthMm } = inp;
  const k = w / widthMm; // bildpunkter per mm
  const heightMm = (h * widthMm) / w;
  const c = Math.max(0.1, inp.settings.contrast);
  return (x: number, y: number) => {
    const u = (x - x0) * k - 0.5, v = (y0 + heightMm - y) * k - 0.5; // v: rader uppifrån
    if (u < -0.5 || v < -0.5 || u > w - 0.5 || v > h - 0.5) return 0;
    const i = Math.max(0, Math.min(w - 2, Math.floor(u))), j = Math.max(0, Math.min(h - 2, Math.floor(v)));
    const fu = Math.max(0, Math.min(1, u - i)), fv = Math.max(0, Math.min(1, v - j));
    const g = (gray[j * w + i] * (1 - fu) + gray[j * w + i + 1] * fu) * (1 - fv) + (gray[(j + 1) * w + i] * (1 - fu) + gray[(j + 1) * w + i + 1] * fu) * fv;
    let d = inp.settings.invert ? g / 255 : 1 - g / 255;
    d = Math.max(0, Math.min(1, (d - 0.5) * c + 0.5));
    return d;
  };
}

const SKRAFF_ANGLES = [45, 135, 0, 90];

/** Skraffering i tonlager: lager i (av n) ritas där mörkheten är över (i + 1) / (n + 1). */
function hatchImage(inp: PenImageInput, D: (x: number, y: number) => number): PolylineInput[] {
  const { x: x0, y: y0, widthMm } = inp;
  const heightMm = (inp.height * widthMm) / inp.width;
  const n = Math.max(1, Math.min(4, Math.round(inp.settings.levels)));
  const sp = Math.max(0.1, inp.settings.spacing);
  const step = sp / 3;
  const out: PolylineInput[] = [];
  const cx = x0 + widthMm / 2, cy = y0 + heightMm / 2;
  const R = Math.hypot(widthMm, heightMm) / 2;
  for (let l = 0; l < n; l++) {
    const thr = (l + 1) / (n + 1);
    const a = (SKRAFF_ANGLES[l] * Math.PI) / 180;
    const dx = Math.cos(a), dy = Math.sin(a); // längs linjen
    const nx = -dy, ny = dx; // tvärs
    for (let o = -R; o <= R; o += sp) {
      let run: number[] | null = null;
      for (let t = -R; t <= R + 1e-9; t += step) {
        const px = cx + nx * o + dx * t, py = cy + ny * o + dy * t;
        const inside = px >= x0 && px <= x0 + widthMm && py >= y0 && py <= y0 + heightMm;
        const ink = inside && D(px, py) > thr;
        if (ink) {
          if (!run) run = [px, py, px, py];
          else run.splice(2, 2, px, py);
        } else if (run) {
          if (Math.hypot(run[2] - run[0], run[3] - run[1]) >= sp / 2) out.push({ points: run, closed: false });
          run = null;
        }
      }
      if (run && Math.hypot(run[2] - run[0], run[3] - run[1]) >= sp / 2) out.push({ points: run, closed: false });
    }
  }
  return out;
}

/** Spiral från mitten; vågen tvärs spiralen är större där bilden är mörk. */
function spiralImage(inp: PenImageInput, D: (x: number, y: number) => number): PolylineInput[] {
  const { x: x0, y: y0, widthMm } = inp;
  const heightMm = (inp.height * widthMm) / inp.width;
  const pitch = Math.max(0.2, inp.settings.spacing);
  const cx = x0 + widthMm / 2, cy = y0 + heightMm / 2;
  const R = Math.hypot(widthMm, heightMm) / 2;
  const wave = pitch * 0.6; // våglängd längs spiralen
  // Fyra punkter per våg räcker för en penna (sicksack) och håller nere G-kodens storlek.
  const ds = Math.min(pitch, wave) / 4;
  const out: PolylineInput[] = [];
  let run: number[] = [];
  let theta = 0.0001, s = 0;
  const flush = () => {
    if (run.length >= 4) out.push({ points: run, closed: false });
    run = [];
  };
  while (true) {
    const r = (pitch * theta) / (2 * Math.PI);
    if (r > R) break;
    const bx = cx + r * Math.cos(theta), by = cy + r * Math.sin(theta);
    const inside = bx >= x0 && bx <= x0 + widthMm && by >= y0 && by <= y0 + heightMm;
    if (inside) {
      // Normal (utåt) mot spiralen ≈ radiell riktning.
      const amp = D(bx, by) * pitch * 0.45;
      const off = amp * Math.sin((2 * Math.PI * s) / wave);
      run.push(bx + off * Math.cos(theta), by + off * Math.sin(theta));
    } else flush();
    // Vinkelsteg så att bågen blir ds lång.
    const dtheta = ds / Math.max(r, pitch / 4);
    theta += dtheta;
    s += ds;
  }
  flush();
  return out;
}

/** Viktad Voronoi-stippling: prickar tätare där bilden är mörk. */
function stippleImage(inp: PenImageInput, D: (x: number, y: number) => number): PolylineInput[] {
  const { x: x0, y: y0, widthMm } = inp;
  const heightMm = (inp.height * widthMm) / inp.width;
  const N = Math.max(10, Math.min(30000, Math.round(inp.settings.dots)));
  // Täthetsrutnät (högst ~320 rutor på bredden) för tyngdpunkterna.
  const gw = Math.min(320, Math.max(40, Math.round(Math.sqrt(N) * 4)));
  const gh = Math.max(2, Math.round((gw * heightMm) / widthMm));
  const cw = widthMm / gw, ch = heightMm / gh;
  const dens = new Float32Array(gw * gh);
  let total = 0;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const d = D(x0 + (i + 0.5) * cw, y0 + (j + 0.5) * ch);
    dens[j * gw + i] = d * d; // kvadrat: ljusa partier blir luftigare
    total += d * d;
  }
  if (total <= 0) return [];
  // Startpunkter: dras efter tätheten (deterministiskt slumptal).
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const cum = new Float64Array(gw * gh);
  let acc = 0;
  for (let k = 0; k < dens.length; k++) cum[k] = acc += dens[k];
  const pts = new Float64Array(2 * N);
  for (let p = 0; p < N; p++) {
    const r = rnd() * acc;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    pts[2 * p] = (lo % gw + rnd()) * cw;
    pts[2 * p + 1] = (Math.floor(lo / gw) + rnd()) * ch;
  }
  // Lloyd-steg viktade med tätheten.
  const sx = new Float64Array(N), sy = new Float64Array(N), sw = new Float64Array(N);
  for (let it = 0; it < 30; it++) {
    const del = new Delaunay(pts);
    sx.fill(0); sy.fill(0); sw.fill(0);
    let guess = 0;
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const w = dens[j * gw + i];
        if (w <= 0) continue;
        const px = (i + 0.5) * cw, py = (j + 0.5) * ch;
        guess = del.find(px, py, guess);
        sx[guess] += w * px; sy[guess] += w * py; sw[guess] += w;
      }
    }
    for (let p = 0; p < N; p++) if (sw[p] > 0) { pts[2 * p] = sx[p] / sw[p]; pts[2 * p + 1] = sy[p] / sw[p]; }
  }
  const dots: PolylineInput[] = [];
  for (let p = 0; p < N; p++) {
    const x = x0 + pts[2 * p], y = y0 + pts[2 * p + 1];
    // En prick: pennan ner och upp på samma ställe (en kort linje på 0,01 mm).
    dots.push({ points: [x, y, x + 0.01, y], closed: false });
  }
  return dots;
}

/** Linjerna för en bild. Med connect bindas prickarna ihop till en enda linje i ritordning. */
export function penImagePaths(inp: PenImageInput, order?: (paths: PolylineInput[]) => number[][]): PolylineInput[] {
  const D = darknessSampler(inp);
  const m = inp.settings.method;
  if (m === 'hatch') return hatchImage(inp, D);
  if (m === 'spiral') return spiralImage(inp, D);
  const dots = stippleImage(inp, D);
  if (!inp.settings.connect || !order) return dots;
  // En enda linje genom prickarna i närmaste-granne-ordning.
  const strokes = order(dots);
  const line: number[] = [];
  for (const s of strokes) line.push(s[0], s[1]);
  return line.length >= 4 ? [{ points: line, closed: false }] : [];
}
