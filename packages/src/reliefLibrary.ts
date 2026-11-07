/**
 * Reliefbiblioteket. Varje relief är en höjdfunktion h(u, v) → 0…1 på
 * enhetskvadraten (v uppåt). Funktionerna är egna, matematiskt genererade
 * motiv – inga externa modeller – och samplas till höjdkartor i valfri upplösning.
 */
import type { ReliefCategory } from './types';

export interface ReliefDefinition {
  id: string;
  name: string;
  category: ReliefCategory;
  description: string;
  /** Bredd/höjd-förhållande för standardstorleken. */
  aspect: number;
  defaultWidth: number;
  defaultDepth: number;
  height: (u: number, v: number) => number;
}

export const RELIEF_CATEGORIES: { id: ReliefCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Alla' },
  { id: 'geometric', label: 'Geometriskt' },
  { id: 'pattern', label: 'Mönster' },
  { id: 'nature', label: 'Natur' },
];

const TAU = Math.PI * 2;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const frac = (x: number) => x - Math.floor(x);
/** Polära koordinater runt mitten, r = 1 vid kanten av den inskrivna cirkeln. */
const polar = (u: number, v: number) => {
  const x = (u - 0.5) * 2;
  const y = (v - 0.5) * 2;
  return { r: Math.hypot(x, y), a: Math.atan2(y, x), x, y };
};
/** Mjuk avtoning mot kanterna så att mönster inte slutar i en vägg. */
const edgeFade = (u: number, v: number, w = 0.06) => smooth(0, w, u) * smooth(0, w, 1 - u) * smooth(0, w, v) * smooth(0, w, 1 - v);

export const RELIEF_LIBRARY: ReliefDefinition[] = [
  {
    id: 'dome',
    name: 'Kupol',
    category: 'geometric',
    description: 'Halvsfärisk kupol. Bra första test av en kulfräs.',
    aspect: 1,
    defaultWidth: 60,
    defaultDepth: 6,
    height: (u, v) => {
      const { r } = polar(u, v);
      return r < 1 ? Math.sqrt(1 - r * r) : 0;
    },
  },
  {
    id: 'pyramid',
    name: 'Pyramid',
    category: 'geometric',
    description: 'Fyrsidig pyramid med skarp topp och raka fasetter.',
    aspect: 1,
    defaultWidth: 60,
    defaultDepth: 8,
    height: (u, v) => clamp01(1 - 2 * Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) / 0.96),
  },
  {
    id: 'star',
    name: 'Stjärna',
    category: 'geometric',
    description: 'Femuddig stjärna med fasade sidor som möts i en rygg.',
    aspect: 1,
    defaultWidth: 70,
    defaultDepth: 6,
    height: (u, v) => {
      const { r, a } = polar(u, v);
      const f = frac((a - Math.PI / 2) / (TAU / 5));
      const tri = Math.abs(f - 0.5) * 2;
      const R = 0.42 + 0.53 * tri ** 1.6;
      return clamp01(1 - r / R);
    },
  },
  {
    id: 'compass',
    name: 'Kompassros',
    category: 'geometric',
    description: 'Åttauddig kompassros med långa väderstreck och kortare mellanstreck.',
    aspect: 1,
    defaultWidth: 80,
    defaultDepth: 6,
    height: (u, v) => {
      const { r, a } = polar(u, v);
      const f = frac(a / (TAU / 8) + 0.5);
      const tri = Math.abs(f - 0.5) * 2;
      const longPoint = Math.round(a / (TAU / 8)) % 2 === 0;
      const R = 0.16 + (longPoint ? 0.8 : 0.5) * tri ** 3;
      const ridge = 0.65 + 0.35 * tri;
      const center = r < 0.12 ? Math.sqrt(1 - (r / 0.12) ** 2) * 0.35 : 0;
      return clamp01(Math.max((1 - r / R) * ridge, center + 0.65 * clamp01(1 - r / 0.16)));
    },
  },
  {
    id: 'waves',
    name: 'Vågor',
    category: 'pattern',
    description: 'Böljande vågmönster för paneler, brickor och lådlock.',
    aspect: 1.5,
    defaultWidth: 120,
    defaultDepth: 3,
    height: (u, v) => (0.5 + 0.5 * Math.sin(TAU * (u * 5 + 0.18 * Math.sin(TAU * v * 1.5)))) * edgeFade(u, v),
  },
  {
    id: 'ripples',
    name: 'Ringar',
    category: 'pattern',
    description: 'Koncentriska ringar som klingar av mot kanten, som en droppe i vatten.',
    aspect: 1,
    defaultWidth: 80,
    defaultDepth: 3,
    height: (u, v) => {
      const { r } = polar(u, v);
      return r < 1 ? (0.5 + 0.5 * Math.cos(r * 7 * Math.PI)) * (1 - r * r) : 0;
    },
  },
  {
    id: 'hexagons',
    name: 'Bikupa',
    category: 'pattern',
    description: 'Sexkantiga kuddar i bikupemönster med spår emellan.',
    aspect: 1.25,
    defaultWidth: 100,
    defaultDepth: 3,
    height: (u, v) => {
      const s = 5;
      const px = u * s * 1.25;
      const py = v * s;
      const rx = 1;
      const ry = Math.sqrt(3);
      const mod = (a: number, b: number) => a - b * Math.floor(a / b);
      const ax = mod(px, rx) - rx / 2;
      const ay = mod(py, ry) - ry / 2;
      const bx = mod(px - rx / 2, rx) - rx / 2;
      const by = mod(py - ry / 2, ry) - ry / 2;
      const [gx, gy] = ax * ax + ay * ay < bx * bx + by * by ? [ax, ay] : [bx, by];
      const d = Math.max(Math.abs(gx), Math.abs(gx) * 0.5 + Math.abs(gy) * 0.866);
      return clamp01(1 - (d / 0.5) ** 6) * edgeFade(u, v, 0.03);
    },
  },
  {
    id: 'pillows',
    name: 'Kuddar',
    category: 'pattern',
    description: 'Rutnät av mjuka kuddar, 4 × 3. Passar som lådfront.',
    aspect: 4 / 3,
    defaultWidth: 120,
    defaultDepth: 4,
    height: (u, v) => (Math.sin(Math.PI * frac(u * 4)) * Math.sin(Math.PI * frac(v * 3))) ** 0.6,
  },
  {
    id: 'spiral',
    name: 'Spiral',
    category: 'pattern',
    description: 'Arkimedisk spiral som tunnas ut mot kanten.',
    aspect: 1,
    defaultWidth: 80,
    defaultDepth: 3,
    height: (u, v) => {
      const { r, a } = polar(u, v);
      if (r >= 1) return 0;
      const phase = r * 6 - a / TAU;
      return (0.5 + 0.5 * Math.cos(TAU * phase)) * (1 - r) ** 0.35;
    },
  },
  {
    id: 'rosette',
    name: 'Rosett',
    category: 'nature',
    description: 'Blomrosett med åtta kronblad och en välvd mitt.',
    aspect: 1,
    defaultWidth: 80,
    defaultDepth: 6,
    height: (u, v) => {
      const { r, a } = polar(u, v);
      const petalR = 0.55 + 0.42 * Math.abs(Math.cos(a * 4));
      const rr = r / petalR;
      const petal = rr < 1 ? Math.sqrt(1 - rr * rr) * (0.55 + 0.25 * Math.abs(Math.cos(a * 4))) : 0;
      const center = r < 0.24 ? Math.sqrt(1 - (r / 0.24) ** 2) : 0;
      return clamp01(Math.max(petal, center));
    },
  },
  {
    id: 'leaf',
    name: 'Löv',
    category: 'nature',
    description: 'Välvt löv med mittnerv och sidonerver.',
    aspect: 0.62,
    defaultWidth: 50,
    defaultDepth: 5,
    height: (u, v) => {
      const x = (u - 0.5) * 2;
      const y = (v - 0.5) * 2;
      const w = 0.92 * (1 - y * y) ** 0.9 * (1 - 0.15 * y);
      if (Math.abs(x) >= w) return 0;
      const body = Math.sqrt(1 - (x / w) ** 2) * (1 - y * y) ** 0.25;
      const midrib = 0.18 * Math.exp(-((x / 0.035) ** 2));
      const vein = frac((y - 0.75 * Math.abs(x)) * 5);
      const veins = 0.1 * Math.exp(-(((vein - 0.5) / 0.07) ** 2)) * smooth(0.06, 0.2, Math.abs(x));
      return clamp01(body - midrib - veins);
    },
  },
  {
    id: 'heart',
    name: 'Hjärta',
    category: 'nature',
    description: 'Mjukt rundat hjärta, passar på skärbrädor och presenter.',
    aspect: 1.1,
    defaultWidth: 70,
    defaultDepth: 6,
    height: (u, v) => {
      const x = (u - 0.5) * 2.5;
      const y = (v - 0.5) * 2.5 + 0.15;
      const q = x * x + y * y - 1;
      const f = q * q * q - x * x * y * y * y;
      return f < 0 ? clamp01(Math.pow(-f, 0.22) * 1.05) : 0;
    },
  },
];

export const getReliefDefinition = (id: string) => RELIEF_LIBRARY.find((r) => r.id === id);

/** Samplar en relief till en höjdkarta (rad för rad nerifrån, värden 0…1). */
export function sampleRelief(def: ReliefDefinition, nx: number, ny: number, invert = false, mirror = false): Float32Array {
  const out = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const v = ny > 1 ? j / (ny - 1) : 0.5;
    for (let i = 0; i < nx; i++) {
      let u = nx > 1 ? i / (nx - 1) : 0.5;
      if (mirror) u = 1 - u;
      const h = clamp01(def.height(u, v));
      out[j * nx + i] = invert ? 1 - h : h;
    }
  }
  return out;
}
