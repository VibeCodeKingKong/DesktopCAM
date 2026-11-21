/**
 * Geometri för en (eventuellt vriden) bild i ritningen. x, y och widthMm
 * beskriver den ovridna bilden (nedre vänstra hörnet); bilden vrids runt sin
 * mitt. Inga beroenden, så att store, vy, redigering och banor kan dela den.
 */
export interface ImageGeom {
  x: number;
  y: number;
  widthMm: number;
  pxWidth: number;
  pxHeight: number;
  rotation?: number;
}

export interface ImageFrame {
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Radianer, moturs. */
  angle: number;
  /** Hörnen i ordningen nere vänster, nere höger, uppe höger, uppe vänster. */
  corners: { x: number; y: number }[];
  /** Omslutande rektangel (axelparallell). */
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export function imageFrame(im: ImageGeom): ImageFrame {
  const w = im.widthMm, h = (im.widthMm * im.pxHeight) / im.pxWidth;
  const cx = im.x + w / 2, cy = im.y + h / 2;
  const angle = ((im.rotation ?? 0) * Math.PI) / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  const corners = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([dx, dy]) => ({ x: cx + dx * c - dy * s, y: cy + dx * s + dy * c }));
  const xs = corners.map((p) => p.x), ys = corners.map((p) => p.y);
  return { cx, cy, w, h, angle, corners, bbox: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } };
}

/** Ligger punkten (mm) på bilden? */
export function insideImage(im: ImageGeom, x: number, y: number): boolean {
  const f = imageFrame(im);
  const c = Math.cos(-f.angle), s = Math.sin(-f.angle);
  const dx = x - f.cx, dy = y - f.cy;
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  return Math.abs(lx) <= f.w / 2 && Math.abs(ly) <= f.h / 2;
}

/**
 * Bilden vriden, ritad på en canvas som täcker den omslutande rektangeln
 * (vit bakgrund utanför bilden) med `pxPerMm` bildpunkter per mm. Ovriden
 * bild ritas bara om i rätt storlek.
 */
export function renderImage(source: CanvasImageSource & { width: number; height: number }, im: ImageGeom, pxPerMm: number): { canvas: HTMLCanvasElement; frame: ImageFrame } {
  const f = imageFrame(im);
  const W = Math.max(1, Math.round((f.bbox.x1 - f.bbox.x0) * pxPerMm)), H = Math.max(1, Math.round((f.bbox.y1 - f.bbox.y0) * pxPerMm));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  g.imageSmoothingQuality = 'high';
  // Bildens y uppåt i ritningen, nedåt på canvasen: vridning moturs i mm = medurs på canvasen.
  g.translate(W / 2, H / 2);
  g.rotate(-f.angle);
  g.drawImage(source, (-f.w / 2) * pxPerMm, (-f.h / 2) * pxPerMm, f.w * pxPerMm, f.h * pxPerMm);
  return { canvas, frame: f };
}
