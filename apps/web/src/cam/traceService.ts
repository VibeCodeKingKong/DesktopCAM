/**
 * Smart Trace i appen: läser bilden, hittar papperet, rätar upp perspektivet,
 * spårar i workern och lägger in resultatet i ritningen. Algoritmerna finns i
 * @desktopcam/core (trace.ts); här är bara flödet och kopplingen till store.
 */
import { downscaleGray, rgbaToGray, uid, type PathSegment, type TraceOptions, type TraceResultMm, type VectorPath, type VectorShape } from '@desktopcam/core';
import { camClient } from '../engine/camClient';
import { useAppStore } from '../store/useAppStore';
import { getT } from '../i18n';
import { importImage } from './imageObjects';

export type P2 = [number, number];

/** Bilden som spåras: RGBA i arbetsupplösning. */
export interface TraceImage {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Referenspapper (mm, stående). */
export const PAPERS = { A4: [210, 297], A3: [297, 420], Letter: [215.9, 279.4] } as const;
export type PaperId = keyof typeof PAPERS | 'custom';

/** Största sida i arbetsupplösning – räcker för ~0,1–0,2 mm per pixel på ett A4. */
const WORK_MAX = 3000;
/** Spårningen görs på högst så här stor bild (snabbt; mått i mm påverkas inte). */
const TRACE_MAX = 2000;

/** Läser bildobjektets bild till RGBA (nedskalad till WORK_MAX). */
export function loadImageRgba(imageId: string): TraceImage | null {
  const img = useAppStore.getState().images[imageId];
  if (!img) return null;
  const k = Math.min(1, WORK_MAX / Math.max(img.bitmap.width, img.bitmap.height));
  const width = Math.max(2, Math.round(img.bitmap.width * k)), height = Math.max(2, Math.round(img.bitmap.height * k));
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img.bitmap, 0, 0, width, height);
  return { rgba: ctx.getImageData(0, 0, width, height).data, width, height };
}

/** Papperets hörn (i bildens pixlar), eller null. Söker på en nedskalad kopia. */
export async function detectPaperQuad(src: TraceImage): Promise<P2[] | null> {
  const small = downscaleGray(rgbaToGray(src.rgba, src.width, src.height), src.width, src.height, 1000);
  const q = await camClient.request({ type: 'traceDetect', gray: small.gray, width: small.w, height: small.h });
  if (!q) return null;
  const kx = src.width / small.w, ky = src.height / small.h;
  return q.map(([x, y]) => [x * kx, y * ky] as P2);
}

/**
 * Rätar upp papperet till en rektangel i rätt proportioner. Papperets
 * orientering avgörs av fyrhörningens sidor. Returnerar bilden och mm/pixel.
 */
export async function rectifyPaper(src: TraceImage, quad: P2[], paperMm: [number, number]): Promise<{ image: TraceImage; mmPerPx: number; widthMm: number; heightMm: number }> {
  const d = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const wide = d(quad[0], quad[1]) + d(quad[3], quad[2]) > d(quad[0], quad[3]) + d(quad[1], quad[2]);
  const [a, b] = paperMm;
  const widthMm = wide ? Math.max(a, b) : Math.min(a, b), heightMm = wide ? Math.min(a, b) : Math.max(a, b);
  const ppm = Math.min(8, WORK_MAX / Math.max(widthMm, heightMm));
  const outW = Math.round(widthMm * ppm), outH = Math.round(heightMm * ppm);
  const rgba = await camClient.request({ type: 'traceRectify', rgba: src.rgba, width: src.width, height: src.height, quad, outW, outH });
  return { image: { rgba, width: outW, height: outH }, mmPerPx: widthMm / outW, widthMm, heightMm };
}

/** Spårar bilden i workern. mmPerPx gäller `img`; bilden skalas ner vid behov. */
export function runTrace(img: TraceImage, options: TraceOptions, mmPerPx: number, offsetMm: number): Promise<TraceResultMm> {
  const small = downscaleGray(rgbaToGray(img.rgba, img.width, img.height), img.width, img.height, TRACE_MAX);
  const k = img.width / small.w;
  // Inställningar i pixlar följer nedskalningen.
  const o: TraceOptions = { ...options, minArea: options.minArea / (k * k), smooth: options.smooth / k, simplify: options.simplify / k };
  return camClient.request({ type: 'trace', job: { gray: small.gray, width: small.w, height: small.h, options: o, mmPerPx: mmPerPx * k, offsetMm } });
}

/** RGBA → bildfil (för att lägga in den upprätade bilden i ritningen). */
async function rgbaToFile(img: TraceImage, name: string): Promise<File> {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.rgba), img.width, img.height), 0, 0);
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.92));
  return new File([blob], name, { type: 'image/jpeg' });
}

const toPath = (pts: number[], closed: boolean, dx: number, dy: number): VectorPath => {
  const segments: PathSegment[] = [];
  for (let i = 2; i < pts.length; i += 2) segments.push({ type: 'line', to: { x: pts[i] + dx, y: pts[i + 1] + dy } });
  return { id: uid('path'), start: { x: pts[0] + dx, y: pts[1] + dy }, segments, closed };
};

/**
 * Lägger in de valda objekten i ritningen som former i ett nytt lager, med
 * bildens nedre vänstra hörn i (x, y). Med en upprätad bild läggs den in som
 * ny bild på samma plats (den ursprungliga döljs), så att vektorerna ligger
 * rätt över fotot.
 */
export async function addTraceToDrawing(
  result: TraceResultMm,
  selected: Set<number>,
  placement: { x: number; y: number },
  source: { imageId: string; rectified: { image: TraceImage; widthMm: number } | null; widthMm: number },
): Promise<number> {
  const t = getT();
  const s = useAppStore.getState();
  const objects = result.objects.filter((o) => selected.has(o.id));
  if (!objects.length) return 0;
  const orig = s.imageObjects.find((im) => im.id === source.imageId);
  if (source.rectified) {
    const id = await importImage(await rgbaToFile(source.rectified.image, `${orig?.name ?? 'trace'} (${t.trace.rectifiedName})`));
    if (id) {
      useAppStore.getState().updateImageObject(id, { x: placement.x, y: placement.y, widthMm: source.rectified.widthMm });
      if (orig) useAppStore.getState().updateImageObject(orig.id, { visible: false });
    }
  } else if (orig && Math.abs(orig.widthMm - source.widthMm) > 1e-6) {
    // Kalibrerad med två punkter: bilden får den uppmätta storleken.
    useAppStore.getState().checkpoint();
    useAppStore.getState().updateImageObject(orig.id, { widthMm: source.widthMm, x: placement.x, y: placement.y });
  }
  const st = useAppStore.getState();
  const n = st.layers.filter((l) => l.name.startsWith(t.trace.layerName)).length + 1;
  const shapes: VectorShape[] = objects.map((o, i) => ({
    id: uid('shape'),
    name: `${t.trace.objectName} ${i + 1}`,
    kind: 'imported',
    paths: [...o.loops.map((l) => toPath(l, true, placement.x, placement.y)), ...o.lines.map((l) => toPath(l, false, placement.x, placement.y))],
  }));
  st.addLayers([{ id: uid('layer'), name: `${t.trace.layerName} ${n}`, color: '#d4572a', visible: true, locked: false, shapes }]);
  st.setStatus(t.trace.added(shapes.length));
  return shapes.length;
}
