/**
 * Höjdkartor för reliefer i projektet: cache, miniatyrer och den samlade
 * materialytan som 3D-vyn visar.
 */
import {
  base64ToBytes,
  getReliefDefinition,
  imageReliefHeights,
  resampleHeights,
  sampleRelief,
  type ImageReliefSource,
  type MaterialSetup,
  type ReliefDefinition,
  type ReliefInstance,
} from '@desktopcam/core';

/** Upplösning för beräkning: ungefär 0,25 mm mellan punkterna, högst 600 per sida. */
const CAM_SPACING = 0.25;
const MAX_SAMPLES = 600;

export interface Heightmap {
  heights: Float32Array;
  nx: number;
  ny: number;
}

const cache = new Map<string, Heightmap>();

/** Bildreliefer: höjdfältet i bildens egen upplösning, cachat per inställning. */
const imageCache = new Map<string, Float32Array>();
function imageHeights(img: ImageReliefSource): Float32Array {
  const key = `${img.gray.length}:${img.gray.slice(0, 64)}:${img.gray.slice(-64)}:${JSON.stringify(img.settings)}`;
  let h = imageCache.get(key);
  if (!h) {
    h = imageReliefHeights(base64ToBytes(img.gray), img.width, img.height, img.settings);
    if (imageCache.size > 12) imageCache.delete(imageCache.keys().next().value!);
    imageCache.set(key, h);
  }
  return h;
}

export function heightmapFor(r: ReliefInstance, spacing = CAM_SPACING): Heightmap {
  if (r.image) {
    const nx = Math.min(MAX_SAMPLES, Math.max(16, Math.round(r.width / spacing) + 1));
    const ny = Math.min(MAX_SAMPLES, Math.max(16, Math.round(r.height / spacing) + 1));
    let src = imageHeights(r.image);
    const w = r.image.width;
    if (r.invert) src = src.map((v) => 1 - v);
    if (r.mirror) {
      const m = new Float32Array(src.length);
      for (let j = 0; j < r.image.height; j++) for (let i = 0; i < w; i++) m[j * w + i] = src[j * w + (w - 1 - i)];
      src = m;
    }
    return { heights: resampleHeights(src, w, r.image.height, nx, ny), nx, ny };
  }
  const def = getReliefDefinition(r.reliefId);
  if (!def) throw new Error(`Reliefen ${r.reliefId} finns inte i biblioteket`);
  const nx = Math.min(MAX_SAMPLES, Math.max(16, Math.round(r.width / spacing) + 1));
  const ny = Math.min(MAX_SAMPLES, Math.max(16, Math.round(r.height / spacing) + 1));
  const key = `${def.id}:${nx}:${ny}:${r.invert ? 1 : 0}:${r.mirror ? 1 : 0}`;
  let hm = cache.get(key);
  if (!hm) {
    hm = { heights: sampleRelief(def, nx, ny, r.invert, r.mirror), nx, ny };
    if (cache.size > 24) cache.delete(cache.keys().next().value!);
    cache.set(key, hm);
  }
  return hm;
}

function sample(hm: Heightmap, u: number, v: number): number {
  const fx = u * (hm.nx - 1);
  const fy = v * (hm.ny - 1);
  const i = Math.min(hm.nx - 2, Math.max(0, Math.floor(fx)));
  const j = Math.min(hm.ny - 2, Math.max(0, Math.floor(fy)));
  const tx = fx - i;
  const ty = fy - j;
  const h = hm.heights;
  const a = h[j * hm.nx + i] * (1 - tx) + h[j * hm.nx + i + 1] * tx;
  const b = h[(j + 1) * hm.nx + i] * (1 - tx) + h[(j + 1) * hm.nx + i + 1] * tx;
  return a * (1 - ty) + b * ty;
}

export interface StockSurface {
  nx: number;
  ny: number;
  /** Z för varje punkt, rad för rad nerifrån; 0 = orört material. */
  z: Float32Array;
}

/** Bygger materialets ovansida med alla synliga reliefer infrästa. */
export function composeStockSurface(material: MaterialSetup, reliefs: ReliefInstance[]): StockSurface | null {
  const visible = reliefs.filter((r) => r.visible && r.width > 0 && r.height > 0);
  if (!visible.length) return null;
  const step = Math.max(0.5, Math.max(material.width, material.height) / 360);
  const nx = Math.round(material.width / step) + 1;
  const ny = Math.round(material.height / step) + 1;
  const dx = material.width / (nx - 1);
  const dy = material.height / (ny - 1);
  const z = new Float32Array(nx * ny);
  for (const r of visible) {
    const hm = heightmapFor(r, Math.max(0.5, step));
    const i0 = Math.max(0, Math.ceil(r.x / dx));
    const i1 = Math.min(nx - 1, Math.floor((r.x + r.width) / dx));
    const j0 = Math.max(0, Math.ceil(r.y / dy));
    const j1 = Math.min(ny - 1, Math.floor((r.y + r.height) / dy));
    for (let j = j0; j <= j1; j++) {
      const v = (j * dy - r.y) / r.height;
      for (let i = i0; i <= i1; i++) {
        const u = (i * dx - r.x) / r.width;
        const zz = (sample(hm, u, v) - 1) * r.depth;
        const k = j * nx + i;
        if (zz < z[k]) z[k] = zz;
      }
    }
  }
  return { nx, ny, z };
}

const thumbs = new Map<string, string>();

/** Skuggad miniatyr (hillshade) av en relief, som data-URL. */
export function reliefThumbnail(def: ReliefDefinition, size = 112, color = [214, 178, 128]): string {
  const key = `${def.id}:${size}:${color.join(',')}`;
  const hit = thumbs.get(key);
  if (hit) return hit;
  const w = def.aspect >= 1 ? size : Math.round(size * def.aspect);
  const h = def.aspect >= 1 ? Math.round(size / def.aspect) : size;
  const hm = sampleRelief(def, w, h);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const L = [-0.45, 0.55, 0.7];
  const ll = Math.hypot(L[0], L[1], L[2]);
  const relief = 6;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const j = h - 1 - y; // höjdkartan är nerifrån, bilden uppifrån
      const at = (i: number, jj: number) => hm[Math.min(h - 1, Math.max(0, jj)) * w + Math.min(w - 1, Math.max(0, i))];
      const gx = (at(x + 1, j) - at(x - 1, j)) * relief;
      const gy = (at(x, j + 1) - at(x, j - 1)) * relief;
      const nl = Math.hypot(gx, gy, 1);
      const shade = Math.max(0, (-gx * L[0] - gy * L[1] + L[2]) / (nl * ll));
      const height = at(x, j);
      const k = 0.45 + 0.45 * shade + 0.12 * height;
      const o = (y * w + x) * 4;
      img.data[o] = Math.min(255, color[0] * k);
      img.data[o + 1] = Math.min(255, color[1] * k);
      img.data[o + 2] = Math.min(255, color[2] * k);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL();
  thumbs.set(key, url);
  return url;
}

/** Skuggad bild (hillshade) av ett höjdfält, som data-URL – för förhandsvisning av bildreliefer. */
export function shadeHeights(hm: Float32Array, w: number, h: number, color = [214, 178, 128]): string {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const L = [-0.45, 0.55, 0.7];
  const ll = Math.hypot(L[0], L[1], L[2]);
  const relief = Math.max(w, h) / 40;
  const at = (i: number, j: number) => hm[Math.min(h - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const j = h - 1 - y;
      const gx = (at(x + 1, j) - at(x - 1, j)) * relief;
      const gy = (at(x, j + 1) - at(x, j - 1)) * relief;
      const nl = Math.hypot(gx, gy, 1);
      const shade = Math.max(0, (-gx * L[0] - gy * L[1] + L[2]) / (nl * ll));
      const k = 0.35 + 0.5 * shade + 0.25 * at(x, j);
      const o = (y * w + x) * 4;
      img.data[o] = Math.min(255, color[0] * k);
      img.data[o + 1] = Math.min(255, color[1] * k);
      img.data[o + 2] = Math.min(255, color[2] * k);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}
