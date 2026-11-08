export const mm = (n: number, d = 1) => `${n.toLocaleString('sv-SE', { maximumFractionDigits: d })} mm`;

export function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '–';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min ${s} s`;
  return `${s} s`;
}
