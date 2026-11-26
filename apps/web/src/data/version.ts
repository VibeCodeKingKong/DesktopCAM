/** Appens version (från package.json, inbyggd av Vite). */
export const APP_VERSION = __APP_VERSION__;

/** Jämför versionsnummer (1.2.10 > 1.2.9). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}
