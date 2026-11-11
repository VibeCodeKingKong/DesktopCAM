/**
 * Bild till relief i appen: läser bilden, skalar ner den, analyserar vilken
 * typ av bild det är och öppnar dialogen med förhandsvisning.
 */
import { create } from 'zustand';
import {
  analyzeImage,
  bytesToBase64,
  cropGray,
  downscaleGray,
  flattenBackground,
  grayToRgba,
  otsuThreshold,
  toBlackWhite,
  type CropRect,
  IMAGE_RELIEF_MAX,
  imageReliefPreset,
  rgbaToGray,
  uid,
  type ImageReliefSource,
  type ImageAnalysis,
} from '@desktopcam/core';
import { useAppStore } from '../store/useAppStore';
import { getT } from '../i18n';
import { pickFile } from '../utils/download';

/** Bilden som importeras, i arbetsupplösning (högst WORK_MAX punkter). */
export interface PendingImage {
  fileName: string;
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  gray: Uint8Array;
  /** Ljus bakgrund i hela bilden (för bakgrundsborttagningen). */
  lightBackground: boolean;
}

/** Förbehandling i importdialogen. */
export interface ImagePrep {
  crop: CropRect | null;
  removeBackground: boolean;
  blackWhite: boolean;
  /** Tröskel 0–255; null = automatisk (Otsu). */
  threshold: number | null;
}

/** Resultatet som blir reliefen: nedskalad gråskala och analysen av den. */
export interface PreparedImage {
  width: number;
  height: number;
  gray: Uint8Array;
  analysis: ImageAnalysis;
  /** Tröskeln som användes (automatisk eller vald). */
  threshold: number;
}

const WORK_MAX = 1000;

export const useImageRelief = create<{ pending: PendingImage | null; set: (p: PendingImage | null) => void }>()((set) => ({
  pending: null,
  set: (pending) => set({ pending }),
}));

export async function importImageRelief(file?: File | null) {
  const f = file ?? (await pickFile('image/png,image/jpeg,image/webp,image/bmp,image/gif'));
  if (!f) return;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(f);
  } catch {
    useAppStore.getState().setStatus(getT().imageRelief.unreadable(f.name));
    return;
  }
  const k = Math.min(1, WORK_MAX / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(2, Math.round(bitmap.width * k));
  const height = Math.max(2, Math.round(bitmap.height * k));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const gray = rgbaToGray(rgba, width, height);
  // Bakgrunden: ljusare än mitten av bilden? (papper med streck)
  const sorted = Float32Array.from(gray).sort();
  const lightBackground = sorted[Math.floor(sorted.length * 0.5)] >= 110;
  useImageRelief.getState().set({ fileName: f.name, width, height, rgba, gray, lightBackground });
  useAppStore.getState().openDialog('imageRelief');
}

/** Bakgrundsborttagning på hela bilden (cachad – den är den tyngsta delen). */
let flatCache: { src: Uint8Array; light: boolean; out: Uint8Array } | null = null;
export function flattenedGray(p: PendingImage): Uint8Array {
  if (!flatCache || flatCache.src !== p.gray || flatCache.light !== p.lightBackground) {
    flatCache = { src: p.gray, light: p.lightBackground, out: flattenBackground(p.gray, p.width, p.height, p.lightBackground) };
  }
  return flatCache.out;
}

/**
 * Gråskalan i arbetsupplösning efter bakgrundsborttagning och svartvitt, för
 * hela bilden (förhandsvisning) – tröskeln räknas på det beskurna området.
 */
export function processedFull(p: PendingImage, prep: ImagePrep): { gray: Uint8Array; threshold: number } {
  const base = prep.removeBackground ? flattenedGray(p) : p.gray;
  if (!prep.blackWhite) return { gray: base, threshold: 128 };
  const area = prep.crop ? cropGray(base, p.width, p.height, prep.crop) : { gray: base, w: p.width, h: p.height };
  const threshold = prep.threshold ?? otsuThreshold(area.gray);
  const minArea = Math.round(area.w * area.h * 0.0003);
  return { gray: toBlackWhite(base, p.width, p.height, threshold, minArea), threshold };
}

/** Förbehandlar, beskär, skalar ner och analyserar – det som blir reliefen. */
export function prepareImage(p: PendingImage, prep: ImagePrep): PreparedImage {
  const full = processedFull(p, prep);
  const area = prep.crop ? cropGray(full.gray, p.width, p.height, prep.crop) : { gray: full.gray, w: p.width, h: p.height };
  const small = downscaleGray(area.gray, area.w, area.h, IMAGE_RELIEF_MAX);
  let analysis: ImageAnalysis;
  if (prep.removeBackground || prep.blackWhite) analysis = analyzeImage(grayToRgba(small.gray), small.w, small.h);
  else {
    // Ingen förbehandling: analysera färgerna i det beskurna området.
    const c = prep.crop ?? { x: 0, y: 0, w: p.width, h: p.height };
    const x0 = Math.round(c.x), y0 = Math.round(c.y), cw = Math.round(c.w), ch = Math.round(c.h);
    const step = Math.max(1, Math.ceil(Math.max(cw, ch) / IMAGE_RELIEF_MAX));
    const sw = Math.max(2, Math.floor(cw / step)), sh = Math.max(2, Math.floor(ch / step));
    const rgba = new Uint8Array(sw * sh * 4);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const si = 4 * ((y0 + y * step) * p.width + x0 + x * step), di = 4 * (y * sw + x);
      rgba[di] = p.rgba[si]; rgba[di + 1] = p.rgba[si + 1]; rgba[di + 2] = p.rgba[si + 2]; rgba[di + 3] = p.rgba[si + 3];
    }
    analysis = analyzeImage(rgba, sw, sh);
  }
  return { width: small.w, height: small.h, gray: small.gray, analysis, threshold: full.threshold };
}

/** Placerar bildreliefen mitt på materialet. */
export function addImageRelief(fileName: string, p: PreparedImage, settings: ImageReliefSource['settings'], size: { width: number; height: number; depth: number }) {
  const s = useAppStore.getState();
  const t = getT();
  const name = fileName.replace(/\.[^.]+$/, '').slice(0, 32) || t.imageRelief.title;
  s.addRelief({
    id: uid('relief'),
    name,
    reliefId: 'image',
    x: Math.max(0, (s.material.width - size.width) / 2),
    y: Math.max(0, (s.material.height - size.height) / 2),
    ...size,
    invert: false,
    mirror: false,
    visible: true,
    image: { fileName, width: p.width, height: p.height, gray: bytesToBase64(p.gray), detected: p.analysis.kind, lightBackground: p.analysis.lightBackground, settings },
  });
  s.setStatus(size.depth > s.material.thickness ? t.status.reliefTooDeep(name) : t.status.reliefPlaced(name));
}

export { imageReliefPreset };
