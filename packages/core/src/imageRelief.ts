/**
 * Bild till relief: ljusstyrkan blir höjd.
 *
 * Bilden analyseras först och klassas som logotyp, teckning, höjdkarta eller
 * foto. Varje typ får egna standardinställningar (vilket håll som är högt,
 * utjämning, kontrast, platt bakgrund), som användaren sedan kan ändra.
 *
 * Gråskalan sparas i projektet (nedskalad, base64) så att reliefen finns
 * kvar när projektet öppnas igen.
 */

export type ImageReliefKind = 'logo' | 'drawing' | 'depthmap' | 'photo';

export interface ImageReliefSettings {
  kind: ImageReliefKind;
  /** Mörkt är högt (annars ljust är högt). */
  invert: boolean;
  /** Utjämning, 0–10 (ungefär bildpunkter vid 360 punkters bredd). */
  smoothing: number;
  /** Kontrast runt mellantonerna, 0,5–3. */
  contrast: number;
  /** Gamma: under 1 lyfter mellantonerna, över 1 sänker dem. */
  gamma: number;
  /** Platt bakgrund: allt under denna nivå (0–0,6) blir botten. */
  background: number;
}

export interface ImageReliefSource {
  fileName: string;
  width: number;
  height: number;
  /** Gråskala 0–255, rad för rad uppifrån, base64. */
  gray: string;
  /** Vad analysen kom fram till. */
  detected: ImageReliefKind;
  /** Ljus bakgrund (styr förinställningarna när bildtypen byts). */
  lightBackground?: boolean;
  settings: ImageReliefSettings;
}

export interface ImageAnalysis {
  kind: ImageReliefKind;
  /** Är bakgrunden ljus (vanligt för logotyper och teckningar)? */
  lightBackground: boolean;
  metrics: { saturation: number; tones: number; texture: number; foreground: number; edgeRatio: number };
}

/** Största sida för den sparade gråskalan. */
export const IMAGE_RELIEF_MAX = 360;

/* ───────── Base64 ───────── */

// Finns i webbläsare, workers och Node 16+ (kärnan bygger utan DOM-typerna).
declare function btoa(data: string): string;
declare function atob(data: string): string;

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/* ───────── Analys ───────── */

/** Gråskala (0–255) från RGBA, med vit bakgrund under genomskinliga delar. */
export function rgbaToGray(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Uint8Array {
  const g = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = rgba[4 * i + 3] / 255;
    const l = 0.2126 * rgba[4 * i] + 0.7152 * rgba[4 * i + 1] + 0.0722 * rgba[4 * i + 2];
    g[i] = Math.round(l * a + 255 * (1 - a));
  }
  return g;
}

/**
 * Klassar bilden:
 *  - logotyp: få tydliga toner med stora ytor (t.ex. svart på vitt)
 *  - teckning: få toner men tunna linjer på enfärgad bakgrund
 *  - höjdkarta: gråskala med mjuka övergångar och lite brus
 *  - foto: färger, många toner och struktur
 */
export function analyzeImage(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): ImageAnalysis {
  const n = w * h;
  const gray = rgbaToGray(rgba, w, h);
  let sat = 0;
  for (let i = 0; i < n; i++) {
    if (rgba[4 * i + 3] < 16) continue;
    const r = rgba[4 * i], g = rgba[4 * i + 1], b = rgba[4 * i + 2];
    sat += (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  }
  const saturation = sat / n;

  // Bakgrund: medianen av kantpunkterna.
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(gray[x], gray[(h - 1) * w + x]);
  for (let y = 0; y < h; y++) border.push(gray[y * w], gray[y * w + w - 1]);
  border.sort((a, b) => a - b);
  const bg = border[border.length >> 1];
  const lightBackground = bg >= 128;

  // Toner: hur stor del av bilden ryms i de tre största topparna i histogrammet?
  const hist = new Array(32).fill(0);
  for (let i = 0; i < n; i++) hist[gray[i] >> 3]++;
  const peaks: number[] = [];
  const used = new Array(32).fill(false);
  for (let k = 0; k < 3; k++) {
    let best = -1;
    for (let b = 0; b < 32; b++) if (!used[b] && (best < 0 || hist[b] > hist[best])) best = b;
    if (best < 0) break;
    let sum = 0;
    for (let d = -1; d <= 1; d++) {
      const b = best + d;
      if (b >= 0 && b < 32 && !used[b]) { sum += hist[b]; used[b] = true; }
    }
    peaks.push(sum);
  }
  const tones = peaks.reduce((a, b) => a + b, 0) / n;

  // Struktur: medelvärdet av |laplace| (brus och fina detaljer).
  let lap = 0, edges = 0, fg = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const c = gray[i];
      lap += Math.abs(4 * c - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w]);
      const gx = gray[i + 1] - gray[i - 1], gy = gray[i + w] - gray[i - w];
      if (Math.hypot(gx, gy) > 60) edges++;
      if (Math.abs(c - bg) > 40) fg++;
    }
  }
  const inner = Math.max(1, (w - 2) * (h - 2));
  const texture = lap / inner / 255;
  const foreground = fg / inner;
  const edgeRatio = edges / Math.max(1, fg);

  let kind: ImageReliefKind;
  // Få toner räcker inte: ytorna ska också vara släta (foton med stora enfärgade
  // partier, som himmel, har brus och struktur).
  const flat = texture < 0.07 || tones > 0.97;
  if (tones > 0.85 && flat && foreground > 0.005) kind = edgeRatio > 0.45 || foreground < 0.08 ? 'drawing' : 'logo';
  else if (saturation < 0.06 && texture < 0.035) kind = 'depthmap';
  else kind = 'photo';
  return { kind, lightBackground, metrics: { saturation, tones, texture, foreground, edgeRatio } };
}

/** Standardinställningar per bildtyp. */
export function imageReliefPreset(kind: ImageReliefKind, lightBackground: boolean): ImageReliefSettings {
  switch (kind) {
    case 'logo':
      // Motivet lyfts från bakgrunden som en platå med mjukt rundade kanter.
      return { kind, invert: lightBackground, smoothing: 1.5, contrast: 1, gamma: 1, background: 0.2 };
    case 'drawing':
      return { kind, invert: lightBackground, smoothing: 1, contrast: 1.2, gamma: 0.8, background: 0.12 };
    case 'depthmap':
      // Höjdkartor är nästan alltid ljust = högt och ska tas som de är.
      return { kind, invert: false, smoothing: 0.5, contrast: 1, gamma: 1, background: 0 };
    case 'photo':
      // Foton är brusiga: utjämna mer, annars blir ytan som sandpapper.
      return { kind, invert: false, smoothing: 3, contrast: 1.2, gamma: 1, background: 0 };
  }
}

/* ───────── Höjdfält ───────── */

/** Tre lådfilter i följd ≈ gaussisk utjämning. */
function blur(v: Float32Array, w: number, h: number, radius: number) {
  const r = Math.round(radius);
  if (r < 1) return;
  const tmp = new Float32Array(v.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += v[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = acc / (2 * r + 1);
        acc += v[y * w + Math.min(w - 1, x + r + 1)] - v[y * w + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        v[y * w + x] = acc / (2 * r + 1);
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
  }
}

/**
 * Höjdfält 0–1 (1 = materialets ovansida), rad för rad nerifrån som
 * reliefbiblioteket. Bildens översta rad hamnar alltså överst på materialet.
 */
export function imageReliefHeights(gray: Uint8Array, w: number, h: number, s: ImageReliefSettings): Float32Array {
  const n = w * h;
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = s.invert ? 1 - gray[i] / 255 : gray[i] / 255;
  // Sträck ut så att det lägsta blir 0 och det högsta 1 (2:a–98:e percentilen).
  const sorted = Float32Array.from(v).sort();
  const lo = sorted[Math.floor(n * 0.02)], hi = sorted[Math.min(n - 1, Math.floor(n * 0.98))];
  const span = hi - lo > 1e-3 ? hi - lo : 1;
  const c = Math.max(0.1, s.contrast), g = Math.max(0.1, s.gamma), th = Math.min(0.9, Math.max(0, s.background));
  for (let i = 0; i < n; i++) {
    let x = Math.min(1, Math.max(0, (v[i] - lo) / span));
    x = Math.min(1, Math.max(0, (x - 0.5) * c + 0.5));
    x = Math.pow(x, g);
    x = x <= th ? 0 : (x - th) / (1 - th);
    v[i] = x;
  }
  blur(v, w, h, (s.smoothing * Math.max(w, h)) / IMAGE_RELIEF_MAX);
  // Vänd raderna: bilden uppifrån, höjdfältet nerifrån.
  const out = new Float32Array(n);
  for (let y = 0; y < h; y++) out.set(v.subarray(y * w, y * w + w), (h - 1 - y) * w);
  return out;
}

/** Bilinjär omsampling av ett höjdfält till nx × ny punkter. */
export function resampleHeights(src: Float32Array, w: number, h: number, nx: number, ny: number): Float32Array {
  const out = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const fy = ny > 1 ? (j / (ny - 1)) * (h - 1) : 0;
    const y0 = Math.min(h - 2, Math.max(0, Math.floor(fy))), ty = fy - y0;
    for (let i = 0; i < nx; i++) {
      const fx = nx > 1 ? (i / (nx - 1)) * (w - 1) : 0;
      const x0 = Math.min(w - 2, Math.max(0, Math.floor(fx))), tx = fx - x0;
      const a = src[y0 * w + x0] * (1 - tx) + src[y0 * w + x0 + 1] * tx;
      const b = src[(y0 + 1) * w + x0] * (1 - tx) + src[(y0 + 1) * w + x0 + 1] * tx;
      out[j * nx + i] = a * (1 - ty) + b * ty;
    }
  }
  return out;
}
