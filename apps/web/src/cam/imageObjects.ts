/**
 * Bilder i ritningen (Design → Bild). Bilden skalas ner till högst
 * IMAGE_MAX_PX och sparas i färg som JPEG i projektet; i minnet finns den
 * avkodad som ImageBitmap i `images` under samma id.
 *
 * Egen kod: webbläsarens createImageBitmap och canvas.toDataURL räcker,
 * inget bibliotek behövs.
 */
import { uid } from '@desktopcam/core';
import { useAppStore, type ImageObject } from '../store/useAppStore';
import { getT } from '../i18n';
import { pickFile } from '../utils/download';
import { importImageRelief } from './imageRelief';

export const IMAGE_MAX_PX = 2000;
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/bmp,image/gif';

/** Läser bildfilen, skalar ner den och lägger genomskinliga partier på vit bakgrund. */
/** Avkodar bilden; faller tillbaka på ett img-element om createImageBitmap inte klarar filen (äldre iOS). */
async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

async function readImage(file: Blob) {
  const src = await decode(file);
  const k = Math.min(1, IMAGE_MAX_PX / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * k));
  const h = Math.max(1, Math.round(src.height * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  if ('close' in src) src.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  // Äldre iOS: createImageBitmap från canvas saknas ibland – canvasen duger lika bra att rita från.
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(canvas);
  } catch {
    bitmap = canvas as unknown as ImageBitmap;
  }
  return { dataUrl, bitmap, w, h };
}

/** Lagom storlek och läge: mitt på ämnet, högst 100 mm och inom ämnet. */
function placement(w: number, h: number) {
  const m = useAppStore.getState().material;
  const maxW = Math.max(10, m.width - 20), maxH = Math.max(10, m.height - 20);
  const widthMm = Math.round(Math.min(100, maxW, (maxH * w) / h));
  const heightMm = (widthMm * h) / w;
  return { widthMm, x: Math.round(Math.max(0, (m.width - widthMm) / 2)), y: Math.round(Math.max(0, (m.height - heightMm) / 2)) };
}

/** Importerar en bild till ritningen. Returnerar bildens id (null om avbrutet). */
export async function importImage(file?: File | null): Promise<string | null> {
  const f = file ?? (await pickFile(IMAGE_ACCEPT));
  if (!f) return null;
  const t = getT();
  let read: Awaited<ReturnType<typeof readImage>>;
  try {
    read = await readImage(f);
  } catch {
    useAppStore.getState().setStatus(t.imageRelief.unreadable(f.name));
    return null;
  }
  const id = uid('img');
  const s = useAppStore.getState();
  s.addImage({ id, name: f.name, bitmap: read.bitmap });
  const n = s.imageObjects.length + 1;
  const name = f.name.replace(/\.[a-z0-9]+$/i, '') || t.image.name(n);
  s.addImageObject({ id, name, dataUrl: read.dataUrl, pxWidth: read.w, pxHeight: read.h, ...placement(read.w, read.h), visible: true });
  if (s.activeTab !== 'design' && s.activeTab !== 'toolpaths') s.setTab('design');
  s.setStatus(t.image.imported(name));
  return id;
}

export const imageHeightMm = (im: Pick<ImageObject, 'widthMm' | 'pxWidth' | 'pxHeight'>) => (im.widthMm * im.pxHeight) / im.pxWidth;

/** Avkodar sparade bilder som saknas i minnet (efter att ett projekt öppnats). */
export async function decodeImageObjects() {
  const { imageObjects, images } = useAppStore.getState();
  await Promise.all(
    imageObjects
      .filter((im) => !images[im.id])
      .map(async (im) => {
        try {
          const blob = await (await fetch(im.dataUrl)).blob();
          const bitmap = await createImageBitmap(blob);
          useAppStore.getState().addImage({ id: im.id, name: im.name, bitmap });
        } catch {
          /* trasig bild: banan visar att bilden saknas */
        }
      }),
  );
}

/**
 * Bilden som en bild-bana ska använda: den markerade, annars den enda i
 * ritningen. Saknas den får användaren välja en bildfil, som blir en ny bild.
 */
export async function imageForNewToolpath(): Promise<ImageObject | null> {
  const s = useAppStore.getState();
  const chosen = s.imageObjects.find((im) => im.id === s.selectedImageId) ?? (s.imageObjects.length === 1 ? s.imageObjects[0] : null);
  if (chosen) return chosen;
  const id = await importImage();
  return id ? (useAppStore.getState().imageObjects.find((im) => im.id === id) ?? null) : null;
}

/** Bild till relief med en bild som redan finns i ritningen. */
export async function imageToRelief(id: string) {
  const im = useAppStore.getState().imageObjects.find((x) => x.id === id);
  if (!im) return;
  const blob = await (await fetch(im.dataUrl)).blob();
  await importImageRelief(new File([blob], `${im.name}.jpg`, { type: blob.type }));
}
