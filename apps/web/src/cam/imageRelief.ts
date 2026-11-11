/**
 * Bild till relief i appen: läser bilden, skalar ner den, analyserar vilken
 * typ av bild det är och öppnar dialogen med förhandsvisning.
 */
import { create } from 'zustand';
import {
  analyzeImage,
  bytesToBase64,
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

interface PendingImage {
  fileName: string;
  width: number;
  height: number;
  gray: Uint8Array;
  analysis: ImageAnalysis;
}

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
  const k = Math.min(1, IMAGE_RELIEF_MAX / Math.max(bitmap.width, bitmap.height));
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
  useImageRelief.getState().set({ fileName: f.name, width, height, gray: rgbaToGray(rgba, width, height), analysis: analyzeImage(rgba, width, height) });
  useAppStore.getState().openDialog('imageRelief');
}

/** Placerar bildreliefen mitt på materialet. */
export function addImageRelief(p: PendingImage, settings: ImageReliefSource['settings'], size: { width: number; height: number; depth: number }) {
  const s = useAppStore.getState();
  const t = getT();
  const name = p.fileName.replace(/\.[^.]+$/, '').slice(0, 32) || t.imageRelief.title;
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
    image: { fileName: p.fileName, width: p.width, height: p.height, gray: bytesToBase64(p.gray), detected: p.analysis.kind, lightBackground: p.analysis.lightBackground, settings },
  });
  s.setStatus(size.depth > s.material.thickness ? t.status.reliefTooDeep(name) : t.status.reliefPlaced(name));
}

export { imageReliefPreset };
