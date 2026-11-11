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
  type ReliefPlug,
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

/**
 * Fickans yta som den blir fräst och sedan förskjuten med limspalten, i mm
 * (0 = materialets ovansida), på fickans eget rutnät. Kulfräsen når inte ner
 * i dalar som är smalare än den, så fickan blir "fylligare" än ritningen –
 * pluggen formas efter det verkliga resultatet. Cachas: den är tung.
 */
const plugSurfaceCache = new Map<string, { s: Float32Array; nx: number; ny: number }>();
function plugSurface(p: ReliefPlug, spacing: number) {
  const src = p.source;
  const key = `${JSON.stringify({ ...src, image: src.image ? src.image.gray.length + JSON.stringify(src.image.settings) : '' })}:${p.gap}:${p.toolRadius}:${spacing}`;
  const hit = plugSurfaceCache.get(key);
  if (hit) return hit;
  const pocket = heightmapFor({ ...src, id: 'plug-src', name: '', visible: true }, spacing);
  const { nx, ny } = pocket;
  const dx = src.width / (nx - 1), dy = src.height / (ny - 1);
  const S = new Float32Array(nx * ny);
  for (let k = 0; k < S.length; k++) S[k] = (pocket.heights[k] - 1) * src.depth;
  const at = (a: Float32Array, i: number, j: number, outside: number) => (i < 0 || j < 0 || i >= nx || j >= ny ? outside : a[j * nx + i]);
  /** Kulans form: lyft (mm) vid avstånd d från mitten, eller null utanför radien. */
  const kernel = (r: number) => {
    const out: { di: number; dj: number; b: number }[] = [];
    if (r <= 0) return [{ di: 0, dj: 0, b: 0 }];
    const ki = Math.ceil(r / dx), kj = Math.ceil(r / dy);
    for (let dj = -kj; dj <= kj; dj++) for (let di = -ki; di <= ki; di++) {
      const d2 = (di * dx) ** 2 + (dj * dy) ** 2;
      if (d2 <= r * r) out.push({ di, dj, b: r - Math.sqrt(r * r - d2) });
    }
    return out;
  };
  // 1. Fräsens spets över varje punkt (fräsen får inte gå under ytan), 2. det som blir kvar.
  const ball = kernel(p.toolRadius);
  const T = new Float32Array(S.length);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let m = -Infinity;
    for (const k of ball) m = Math.max(m, at(S, i + k.di, j + k.dj, 0) - k.b);
    T[j * nx + i] = m;
  }
  const M = new Float32Array(S.length);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let m = Infinity;
    for (const k of ball) m = Math.min(m, at(T, i - k.di, j - k.dj, 0) + k.b);
    M[j * nx + i] = Math.min(0, m);
  }
  // 3. Förskjut ytan med limspalten åt alla håll. I sidled ett rutnätssteg extra,
  //    så att branta väggar får spel även med rutnätets osäkerhet (ellipsoid:
  //    limspalten i höjdled, spalten + ett steg i sidled).
  const side = p.gap + Math.max(dx, dy);
  const gapBall: { di: number; dj: number; up: number }[] = [];
  if (p.gap > 0) {
    const ki = Math.ceil(side / dx), kj = Math.ceil(side / dy);
    for (let dj = -kj; dj <= kj; dj++) for (let di = -ki; di <= ki; di++) {
      const q = ((di * dx) ** 2 + (dj * dy) ** 2) / (side * side);
      if (q <= 1) gapBall.push({ di, dj, up: p.gap * Math.sqrt(1 - q) });
    }
  } else gapBall.push({ di: 0, dj: 0, up: 0 });
  const out = new Float32Array(S.length);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let m = -Infinity;
    for (const k of gapBall) m = Math.max(m, at(M, i + k.di, j + k.dj, 0) + k.up);
    out[j * nx + i] = m;
  }
  const res = { s: out, nx, ny };
  if (plugSurfaceCache.size > 6) plugSurfaceCache.delete(plugSurfaceCache.keys().next().value!);
  plugSurfaceCache.set(key, res);
  return res;
}

/**
 * Pluggens höjdfält (pluggens totala djup D' = fickans djup + 2·spalt + frigång).
 * Vänd upp och ner (och spegelvänd tillbaka) ligger pluggens yta på fickans
 * frästa yta plus limspalten, och marginalen runt om går fri från grundträet.
 */
function plugHeightmap(r: ReliefInstance & { plug: ReliefPlug }, spacing: number): Heightmap {
  const p = r.plug;
  const src = p.source;
  const surf = plugSurface(p, spacing);
  const nx = Math.min(MAX_SAMPLES, Math.max(16, Math.round(r.width / spacing) + 1));
  const ny = Math.min(MAX_SAMPLES, Math.max(16, Math.round(r.height / spacing) + 1));
  const total = r.depth;
  const c = -(src.depth + p.gap); // var pluggbrädans ovansida hamnar när den vänts
  const heights = new Float32Array(nx * ny);
  const hm: Heightmap = { heights: surf.s, nx: surf.nx, ny: surf.ny };
  for (let j = 0; j < ny; j++) {
    const ys = ((j / (ny - 1)) * r.height - p.margin) / src.height;
    for (let i = 0; i < nx; i++) {
      const xs = ((i / (nx - 1)) * r.width - p.margin) / src.width;
      if (xs < 0 || xs > 1 || ys < 0 || ys > 1) continue; // marginalen: fullt djup (0)
      const sd = sample(hm, 1 - xs, ys); // spegelvänt: pluggen vänds runt Y-axeln
      const z = c - sd;
      heights[j * nx + i] = Math.min(1, Math.max(0, 1 + z / total));
    }
  }
  return { heights, nx, ny };
}

/** Ligger reliefens kant på ovansidan? Annars passar inte en plugg längs kanten. */
export function reliefEdgeAtTop(r: ReliefInstance): boolean {
  const hm = heightmapFor(r, 1);
  let sum = 0, n = 0;
  for (let i = 0; i < hm.nx; i++) { sum += hm.heights[i] + hm.heights[(hm.ny - 1) * hm.nx + i]; n += 2; }
  for (let j = 0; j < hm.ny; j++) { sum += hm.heights[j * hm.nx] + hm.heights[j * hm.nx + hm.nx - 1]; n += 2; }
  return sum / n > 0.9;
}

/** Klot på rutnätet: förskjutning i rutor och höjd (mm) vid avståndet från mitten. */
function ballKernel(r: number, dx: number, dy: number) {
  const out: { di: number; dj: number; h: number }[] = [];
  const ki = Math.ceil(r / dx), kj = Math.ceil(r / dy);
  for (let dj = -kj; dj <= kj; dj++) for (let di = -ki; di <= ki; di++) {
    const d2 = (di * dx) ** 2 + (dj * dy) ** 2;
    if (d2 <= r * r) out.push({ di, dj, h: Math.sqrt(r * r - d2) });
  }
  return out;
}

/**
 * Rundar av toppar som är vassare än ett klot med radien R underifrån
 * (morfologisk öppning). Används för fickan i ett reliefinlägg: pluggens fräs
 * kommer från andra hållet och kan bara följa toppar som är minst så runda.
 */
function roundPeaks(hm: Heightmap, width: number, height: number, depth: number, R: number): Heightmap {
  const { nx, ny } = hm;
  const dx = width / (nx - 1), dy = height / (ny - 1);
  const S = new Float32Array(nx * ny);
  for (let k = 0; k < S.length; k++) S[k] = (hm.heights[k] - 1) * depth;
  const ball = ballKernel(R, dx, dy);
  const at = (a: Float32Array, i: number, j: number) => (i < 0 || j < 0 || i >= nx || j >= ny ? 0 : a[j * nx + i]);
  // Klotets mitt så högt det går utan att sticka upp genom ytan…
  const C = new Float32Array(S.length);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let m = Infinity;
    for (const k of ball) m = Math.min(m, at(S, i + k.di, j + k.dj) - k.h);
    C[j * nx + i] = m;
  }
  // …och ytan som klotet når.
  const heights = new Float32Array(S.length);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let m = -Infinity;
    for (const k of ball) {
      const ii = i - k.di, jj = j - k.dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
      m = Math.max(m, C[jj * nx + ii] + k.h);
    }
    heights[j * nx + i] = Math.min(1, Math.max(0, 1 + Math.min(S[j * nx + i], m) / depth));
  }
  return { heights, nx, ny };
}

const roundedCache = new Map<string, Heightmap>();

export function heightmapFor(r: ReliefInstance, spacing = CAM_SPACING): Heightmap {
  if (r.plug) return plugHeightmap(r as ReliefInstance & { plug: ReliefPlug }, spacing);
  if (r.inlayRadius && r.inlayRadius > 0) {
    const key = `${r.reliefId}:${r.image ? r.image.gray.length + JSON.stringify(r.image.settings) : ''}:${r.invert}:${r.mirror}:${r.width}:${r.height}:${r.depth}:${r.inlayRadius}:${spacing}`;
    let hm = roundedCache.get(key);
    if (!hm) {
      hm = roundPeaks(heightmapFor({ ...r, inlayRadius: 0 }, spacing), r.width, r.height, r.depth, r.inlayRadius);
      if (roundedCache.size > 6) roundedCache.delete(roundedCache.keys().next().value!);
      roundedCache.set(key, hm);
    }
    return hm;
  }
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
