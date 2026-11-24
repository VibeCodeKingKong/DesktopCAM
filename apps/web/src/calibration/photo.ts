/**
 * Fotot av ett färdigt prov: läses in, hörnen föreslås automatiskt (samma
 * pappersdetektering som fotospårningen) och bilden rätas upp till provets
 * proportioner. Allt sker i webbläsaren – bilden lämnar aldrig datorn.
 */
import { detectPaper, orderQuad, warpQuad, type P2 } from '@desktopcam/core';

export interface Photo {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  url: string;
}

const MAX = 1600;

/** Läser in fotot nedskalat (längsta sidan högst 1600 px). */
export async function readPhoto(file: File): Promise<Photo> {
  // createImageBitmap följer bildens EXIF-rotation (som ett foto från telefonen).
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, MAX / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  return { rgba, width: w, height: h, url: c.toDataURL('image/jpeg', 0.85) };
}

const grayOf = (rgba: Uint8ClampedArray, n: number) => {
  const g = new Uint8Array(n);
  for (let i = 0; i < n; i++) g[i] = Math.round(0.299 * rgba[4 * i] + 0.587 * rgba[4 * i + 1] + 0.114 * rgba[4 * i + 2]);
  return g;
};

/** Hörnförslag (bildpunkter): det ljusa materialets hörn, annars en ruta en bit in i bilden. */
export function suggestCorners(p: Photo): P2[] {
  const found = detectPaper(grayOf(p.rgba, p.width * p.height), p.width, p.height);
  if (found) return orderQuad(found);
  const mx = p.width * 0.1, my = p.height * 0.1;
  return [
    [mx, my],
    [p.width - mx, my],
    [p.width - mx, p.height - my],
    [mx, p.height - my],
  ];
}

/** Rätar upp provet (hörnen i ordning uppe vänster, uppe höger, nere höger, nere vänster) till gråskala. */
export function rectify(p: Photo, corners: P2[], aspect: number): { gray: Uint8Array; width: number; height: number; url: string } {
  const width = 600, height = Math.max(20, Math.round(600 / Math.max(0.05, aspect)));
  const out = warpQuad(p.rgba, p.width, p.height, orderQuad(corners), width, height);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(out), width, height), 0, 0);
  // Liten kopia för historiken.
  const t = document.createElement('canvas');
  const k = Math.min(1, 360 / Math.max(width, height));
  t.width = Math.round(width * k);
  t.height = Math.round(height * k);
  t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height);
  return { gray: grayOf(out, width * height), width, height, url: t.toDataURL('image/jpeg', 0.7) };
}
