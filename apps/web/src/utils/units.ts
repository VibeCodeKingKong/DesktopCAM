/**
 * Visningsenheter: millimeter eller tum. Allt räknas och sparas internt i mm
 * (och G-koden skrivs i mm, G21) – bara det som visas och matas in räknas om.
 * Egen modul utan beroende till store, så att formatering kan läsa den överallt.
 */
export type Units = 'mm' | 'in';
const KEY = 'desktopcam.units';
const MM_PER_IN = 25.4;

function read(): Units {
  try {
    return localStorage.getItem(KEY) === 'in' ? 'in' : 'mm';
  } catch {
    return 'mm';
  }
}

let current: Units = read();
const listeners = new Set<() => void>();

export const getUnits = (): Units => current;
export function setUnits(u: Units) {
  current = u;
  try {
    localStorage.setItem(KEY, u);
  } catch {
    /* privat läge – gäller bara den här sessionen */
  }
  for (const l of listeners) l();
}
export function onUnitsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Enheter som räknas om vid tum: längd, matning och yta. */
const LENGTH_UNITS: Record<string, { factor: number; imperial: string }> = {
  mm: { factor: 1 / MM_PER_IN, imperial: 'in' },
  'mm/min': { factor: 1 / MM_PER_IN, imperial: 'in/min' },
  'mm²': { factor: 1 / (MM_PER_IN * MM_PER_IN), imperial: 'in²' },
};

/** Visad enhet för en intern enhet ('mm' → 'in' vid tum). */
export const displayUnit = (unit: string | undefined, u: Units = current): string | undefined =>
  unit && u === 'in' && LENGTH_UNITS[unit] ? LENGTH_UNITS[unit].imperial : unit;
/** Internt värde → visat värde. */
export const toDisplay = (v: number, unit: string | undefined, u: Units = current): number =>
  unit && u === 'in' && LENGTH_UNITS[unit] ? v * LENGTH_UNITS[unit].factor : v;
/** Visat värde → internt värde. */
export const fromDisplay = (v: number, unit: string | undefined, u: Units = current): number =>
  unit && u === 'in' && LENGTH_UNITS[unit] ? v / LENGTH_UNITS[unit].factor : v;
/** Steg för pilarna: ett jämnt steg i tum som motsvarar ungefär samma storlek. */
export function displayStep(step: number, unit: string | undefined, u: Units = current): number {
  if (!(unit && u === 'in' && LENGTH_UNITS[unit])) return step;
  const s = step * LENGTH_UNITS[unit].factor;
  for (const nice of [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50, 100]) if (s <= nice * 1.5) return nice;
  return Math.round(s);
}
/** Decimaler som visas: tum behöver fler (0,001 in ≈ 0,025 mm). */
export const displayDecimals = (mmDecimals: number, u: Units = current) => (u === 'in' ? Math.min(4, mmDecimals + 2) : mmDecimals);

/** En längd (mm) som text i vald enhet, t.ex. "12,5 mm" eller "0,492 in". */
export function fmtLength(mm: number, locale: string, mmDecimals = 1, u: Units = current): string {
  const v = u === 'in' ? mm / MM_PER_IN : mm;
  return `${v.toLocaleString(locale, { maximumFractionDigits: displayDecimals(mmDecimals, u) })} ${u === 'in' ? 'in' : 'mm'}`;
}
/** Bara talet (utan enhet) i vald enhet. */
export function fmtLengthNumber(mm: number, locale: string, mmDecimals = 1, u: Units = current): string {
  const v = u === 'in' ? mm / MM_PER_IN : mm;
  return v.toLocaleString(locale, { maximumFractionDigits: displayDecimals(mmDecimals, u) });
}

/** En matning (mm/min) som text i vald enhet, t.ex. "1 200 mm/min" eller "47,2 in/min". */
export function fmtFeed(mmPerMin: number, locale: string, u: Units = current): string {
  const v = u === 'in' ? mmPerMin / MM_PER_IN : mmPerMin;
  return `${v.toLocaleString(locale, { maximumFractionDigits: u === 'in' ? 1 : 0 })} ${u === 'in' ? 'in/min' : 'mm/min'}`;
}
