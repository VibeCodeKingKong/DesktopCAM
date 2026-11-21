/**
 * Regressionstester för G-koden. Varje exempelprojekts CAM-jobb (fångade med
 * scripts/capture-gcode-fixtures.cjs) räknas om med samma kod som CAM-workern
 * använder, och G-koden jämförs med facit i golden/<exempel>.json.
 *
 * En testfil per exempel (gcode/<exempel>.test.ts) så att Vitest kan köra dem
 * parallellt på flera kärnor.
 *
 * Utöver facit kontrolleras regler som alltid ska gälla, oavsett ändring:
 *  - ingen NaN/undefined/Infinity i koden
 *  - alla rörelser inom maskinens arbetsyta
 *  - fräs: aldrig djupare än materialet + 1 mm, och inga snabbförflyttningar
 *    i sidled under materialets ovansida
 *  - plasma: brännaren aldrig under plåtens ovansida
 *
 * Ändrar du G-koden med avsikt: kontrollera skillnaden (t.ex. i simuleringen)
 * och uppdatera facit med `pnpm test:update`.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createReferenceEngine, type CamRequest } from '@desktopcam/core';
import { handle } from '../src/workers/camHandler';

const DIR = new URL('./fixtures/', import.meta.url);
const UPDATE = !!process.env.UPDATE_GOLDEN;

interface Fixture {
  example: string;
  machineKind: 'router' | 'laser' | 'plasma' | 'plotter';
  workArea: { x: number; y: number; z?: number };
  thickness: number;
  requests: unknown[];
}

interface Summary {
  sha256: string;
  lines: number;
  x: [number, number];
  y: [number, number];
  z: [number, number];
}

/** Typade arrayer sparades som { __typed, b64 } – återskapa dem. */
function decode(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(decode);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.__typed === 'string' && typeof o.b64 === 'string') {
      const buf = Buffer.from(o.b64, 'base64');
      const bytes = new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      const Ctor = (globalThis as unknown as Record<string, new (b: ArrayBuffer) => ArrayBufferView>)[o.__typed];
      return new Ctor(bytes.buffer);
    }
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, decode(x)]));
  }
  return v;
}

interface Move {
  rapid: boolean;
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  line: number;
}

const WORD = { X: /X(-?\d*\.?\d+)/, Y: /Y(-?\d*\.?\d+)/, Z: /Z(-?\d*\.?\d+)/ };

/** Enkel modal tolkning av G0–G3 (absoluta koordinater, mm). */
function moves(gcode: string): Move[] {
  const out: Move[] = [];
  let pos = { x: 0, y: 0, z: 0 };
  // Laser och vissa plottrar saknar Z – räkna Z som 0 tills något annat sägs.
  let known = { x: false, y: false, z: true };
  let mode = 0;
  gcode.split('\n').forEach((raw, line) => {
    const code = raw.replace(/;.*$/, '').replace(/\(.*?\)/g, '').trim().toUpperCase();
    if (!code) return;
    const g = code.match(/\bG0*([0-3])\b/);
    if (g) mode = Number(g[1]);
    const word = (c: 'X' | 'Y' | 'Z') => {
      const m = code.match(WORD[c]);
      return m ? Number(m[1]) : undefined;
    };
    const x = word('X'), y = word('Y'), z = word('Z');
    if (x === undefined && y === undefined && z === undefined) return;
    if (/\bG(28|30|53|92)\b/.test(code)) return; // maskinkoordinater/referens – hoppa över
    const to = { x: x ?? pos.x, y: y ?? pos.y, z: z ?? pos.z };
    if (known.x && known.y && known.z) out.push({ rapid: mode === 0, from: pos, to, line: line + 1 });
    known = { x: known.x || x !== undefined, y: known.y || y !== undefined, z: known.z || z !== undefined };
    pos = to;
  });
  return out;
}

function summarize(gcode: string, ms: Move[]): Summary {
  const r = (a: number) => +a.toFixed(3);
  const range = (k: 'x' | 'y' | 'z'): [number, number] => {
    let lo = Infinity, hi = -Infinity;
    for (const m of ms) {
      lo = Math.min(lo, m.to[k]);
      hi = Math.max(hi, m.to[k]);
    }
    return ms.length ? [r(lo), r(hi)] : [0, 0];
  };
  return { sha256: createHash('sha256').update(gcode).digest('hex'), lines: gcode.split('\n').length, x: range('x'), y: range('y'), z: range('z') };
}

const engine = createReferenceEngine();

export function runExample(name: string) {
  const fx = JSON.parse(gunzipSync(readFileSync(new URL(`${name}.json.gz`, DIR))).toString('utf8')) as Fixture;
  const goldenUrl = new URL(`./golden/${name}.json`, import.meta.url);
  const golden: Record<string, Summary> = existsSync(goldenUrl) ? JSON.parse(readFileSync(goldenUrl, 'utf8')) : {};
  const updated: Record<string, Summary> = {};

  describe(`G-kod: ${name}`, () => {
    it('har jobb', () => expect(fx.requests.length).toBeGreaterThan(0));
    fx.requests.forEach((raw, i) => {
      const request = decode(raw) as CamRequest;
      const key = `${fx.example}#${i + 1} ${request.type}`;
      it(key, async () => {
        const { result } = await handle(engine, request, () => {});
        const gcode = (result as { gcode: string }).gcode;
        expect(gcode.length).toBeGreaterThan(0);
        expect(gcode).not.toMatch(/NaN|undefined|Infinity/);

        const ms = moves(gcode);
        expect(ms.length).toBeGreaterThan(0);
        // Reglerna kontrolleras i en vanlig loop (expect per rörelse är för långsamt
        // för 200 000 rader); de första överträdelserna rapporteras.
        const margin = 1;
        const problems: string[] = [];
        const fail = (m: Move, why: string) => problems.length < 5 && problems.push(`rad ${m.line}: ${why} (X${m.to.x} Y${m.to.y} Z${m.to.z})`);
        for (const m of ms) {
          if (m.to.x < -margin || m.to.y < -margin || m.to.x > fx.workArea.x + margin || m.to.y > fx.workArea.y + margin) fail(m, 'utanför arbetsytan');
          if (fx.machineKind === 'router') {
            if (m.to.z < -(fx.thickness + 1)) fail(m, 'för djupt');
            const sideways = Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y) > 1e-6;
            if (m.rapid && sideways && Math.min(m.from.z, m.to.z) < 0) fail(m, 'snabbförflyttning i materialet');
          }
          if (fx.machineKind === 'plasma' && m.to.z < 0) fail(m, 'brännaren under plåten');
        }
        expect(problems).toEqual([]);

        const sum = summarize(gcode, ms);
        updated[key] = sum;
        if (UPDATE) return;
        expect(golden[key], `facit saknas för ${key} – kör pnpm test:update`).toBeDefined();
        // Jämför först de begripliga måtten (ger tydligare fel), sedan exakt innehåll.
        expect({ lines: sum.lines, x: sum.x, y: sum.y, z: sum.z }).toEqual({ lines: golden[key].lines, x: golden[key].x, y: golden[key].y, z: golden[key].z });
        expect(sum.sha256, `G-koden för ${key} har ändrats`).toBe(golden[key].sha256);
      }, 120_000);
    });

    it.runIf(UPDATE)('sparar nytt facit', () => {
      writeFileSync(goldenUrl, JSON.stringify(updated, null, 2) + '\n');
    });
  });
}
