/**
 * Snabbförflyttningar för flera banor i följd, som i den exporterade filen:
 * där körs banorna efter varandra utan att maskinen åker hem emellan (slutet
 * på varje bana utom den sista tas bort). Varje bana räknas ut för sig och
 * börjar och slutar i nollpunkten – här ersätts de vägarna med en rak
 * förflyttning från förra banans slut till nästa banas början.
 */
const atOrigin = (x: number, y: number) => Math.abs(x) < 1e-3 && Math.abs(y) < 1e-3;

export function chainRapids(list: Float32Array[]): Float32Array[] {
  if (list.length < 2) return list;
  const trimmed = list.map((r, i) => {
    let a = 0, b = r.length;
    // Början: förflyttningar som utgår från nollpunkten (inte för första banan).
    if (i > 0) while (a < b && atOrigin(r[a], r[a + 1])) a += 6;
    // Slutet: förflyttningar som slutar i nollpunkten (inte för sista banan).
    if (i < list.length - 1) while (b > a && atOrigin(r[b - 3], r[b - 2])) b -= 6;
    return r.subarray(a, b);
  });
  return trimmed.map((r, i) => {
    if (i === 0) return r;
    const prev = trimmed.slice(0, i).reverse().find((p) => p.length);
    if (!prev || !r.length) return r;
    const out = new Float32Array(r.length + 6);
    out.set(prev.subarray(prev.length - 3), 0);
    out.set(r.subarray(0, 3), 3);
    out.set(r, 6);
    return out;
  });
}
