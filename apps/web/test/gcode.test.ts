/**
 * Regressionstester för G-koden. Varje exempelprojekts CAM-jobb (fångade med
 * scripts/capture-gcode-fixtures.cjs) räknas om med samma kod som CAM-workern
 * använder, och G-koden jämförs med facit i gcode.golden.json.
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
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createReferenceEngine, type CamRequest } from '@desktopcam/core';
import { handle } from '../src/workers/camHandler';

const DIR = new URL('./fixtures/', import.meta.url);
const GOLDEN = new URL('./gcode.golden.json', import.meta.url);
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
    const word = (c: string) => {
      const m = code.match(new RegExp(`${c}(-?\\d*\\.?\\d+)`));
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

function summarize(gcode: string): Summary {
  const ms = moves(gcode);
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

const fixtures: Fixture[] = existsSync(DIR)
  ? readdirSync(DIR)
      .filter((f) => f.endsWith('.json.gz'))
      .sort()
      .map((f) => JSON.parse(gunzipSync(readFileSync(new URL(f, DIR))).toString('utf8')) as Fixture)
  : [];
const golden: Record<string, Summary> = existsSync(GOLDEN) ? JSON.parse(readFileSync(GOLDEN, 'utf8')) : {};
const updated: Record<string, Summary> = {};
const engine = createReferenceEngine();

describe('G-kod för exempelprojekten', () => {
  it('har testdata', () => expect(fixtures.length).toBeGreaterThan(0));

  for (const fx of fixtures) {
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
        const margin = 1;
        for (const m of ms) {
          const where = `rad ${m.line}`;
          expect(m.to.x, where).toBeGreaterThanOrEqual(-margin);
          expect(m.to.y, where).toBeGreaterThanOrEqual(-margin);
          expect(m.to.x, where).toBeLessThanOrEqual(fx.workArea.x + margin);
          expect(m.to.y, where).toBeLessThanOrEqual(fx.workArea.y + margin);
          if (fx.machineKind === 'router') {
            expect(m.to.z, `${where}: för djupt`).toBeGreaterThanOrEqual(-(fx.thickness + 1));
            const sideways = Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y) > 1e-6;
            if (m.rapid && sideways) expect(Math.min(m.from.z, m.to.z), `${where}: snabbförflyttning i materialet`).toBeGreaterThanOrEqual(0);
          }
          if (fx.machineKind === 'plasma') expect(m.to.z, `${where}: brännaren under plåten`).toBeGreaterThanOrEqual(0);
        }

        const sum = summarize(gcode);
        updated[key] = sum;
        if (UPDATE) return;
        expect(golden[key], `facit saknas för ${key} – kör pnpm test:update`).toBeDefined();
        // Jämför först de begripliga måtten (ger tydligare fel), sedan exakt innehåll.
        expect({ lines: sum.lines, x: sum.x, y: sum.y, z: sum.z }).toEqual({ lines: golden[key].lines, x: golden[key].x, y: golden[key].y, z: golden[key].z });
        expect(sum.sha256, `G-koden för ${key} har ändrats`).toBe(golden[key].sha256);
      }, 120_000);
    });
  }

  it.runIf(UPDATE)('sparar nytt facit', () => {
    const sorted = Object.fromEntries(Object.keys(updated).sort().map((k) => [k, updated[k]]));
    writeFileSync(GOLDEN, JSON.stringify(sorted, null, 2) + '\n');
  });
});
