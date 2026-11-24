/**
 * Kalibrering och provning av maskiner: gemensamma typer.
 *
 * Ett kalibreringstest beskrivs av sina parametrar och en byggfunktion som
 * ger en plan: geometrin (för förhandsvisning och SVG/DXF), testrutorna
 * (för mätning och bildanalys) och – där maskinen är känd – G-koden.
 * Geometri, maskinparametrar, G-kod och gränssnitt hålls isär, så att nya
 * maskintyper och tester kan läggas till utan att ändra resten.
 *
 * Egen kod och egna, fritt utformade provmönster. Inga mönster eller
 * algoritmer från andra program är kopierade.
 */
import type { MachineProfile, VectorShape } from '../types';
import type { PolylineInput } from '../protocol';

export type CalibrationCategory = 'laser' | 'router' | 'plasma';

export type CalUnit = 'mm' | '%' | 'mm/min' | 'rpm' | 's' | '';

/** En parameter i testets formulär. */
export type CalParam =
  | { key: string; kind: 'number'; min: number; max: number; step?: number; def: number; unit?: CalUnit; advanced?: boolean; integer?: boolean }
  | { key: string; kind: 'choice'; options: string[]; def: string; advanced?: boolean };

export type CalValues = Record<string, number | string>;

/** Vad generatorn vet om maskinen, materialet och verktyget. */
export interface CalibrationContext {
  machine: MachineProfile;
  /** Materialets tjocklek (mm). */
  thickness: number;
  /** Fräs: verktygets diameter och typ. Plasma: munstyckets snittbredd. */
  toolDiameter?: number;
  /** Plasma: riktvärden ur skärtabellen (startvärden för formuläret). */
  plasma?: { feedRate: number; kerf: number; pierceDelay: number; pierceHeight: number; cutHeight: number };
  /** Fräs: verktygets och materialets riktvärden (startvärden för formuläret). */
  router?: { feedRate: number; plungeRate: number; spindleRpm: number; stepDown: number };
}

/** En provruta: var den ligger (mm) och vilka värden den provar. */
export interface CalCell {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Kort etikett, t.ex. "40 %" eller "1200". */
  label: string;
  values: Record<string, number>;
}

/** Laserns arbete: en vektorlinje eller en fylld yta (rader med visst radavstånd). */
export interface LaserOp {
  kind: 'vector' | 'fill';
  polylines: PolylineInput[];
  /** fill: ytan som fylls (rektangel) och radavståndet (mm). */
  rect?: { x0: number; y0: number; x1: number; y1: number };
  interval?: number;
  powerPct: number;
  /** mm/min */
  speed: number;
  passes: number;
  /** Fokustest: laserhuvudets Z för just den här delen (annars oförändrad). */
  z?: number;
  /** Etiketter graveras med egen effekt; markeras så att förhandsvisningen kan tona ner dem. */
  label?: boolean;
}

/** Ett mått som användaren mäter upp på det färdiga provet. */
export interface CalMeasure {
  key: string;
  /** Det nominella (ritade) måttet, om det finns. */
  nominal?: number;
  unit: 'mm';
}

/** Ett resultat som räknas fram ur mätningarna. */
export interface CalOutcome {
  key: string;
  value: number;
  unit: CalUnit;
  /** Kan sparas som standard för maskin och material (t.ex. snittbredd, verktygsdiameter). */
  apply?: 'laserKerf' | 'plasmaKerf' | 'toolDiameter';
}

export interface CalibrationPlan {
  /** Mönstrets yta (mm), med nedre vänstra hörnet i (x, y). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Geometrin per lager (för förhandsvisning och SVG/DXF). */
  layers: { name: string; color: string; shapes: VectorShape[] }[];
  cells: CalCell[];
  /** Laser: arbetena i ordning (G-koden skrivs ur dem). */
  laser?: LaserOp[];
  /** Fräs och plasma: färdig G-kod från appens vanliga banmotorer. */
  gcode?: string;
  measures: CalMeasure[];
  /** Fokustest med Z-steg: kräver motoriserad Z-axel på lasern. */
  needsZ?: boolean;
}

export interface CalibrationTest {
  id: string;
  category: CalibrationCategory;
  params: CalParam[];
  /** Testet passar för bildanalys (jämförbara rutor i ett rutnät). */
  analyzable?: boolean;
  /** Startvärden som beror på maskin, material eller verktyg (ersätter parametrarnas def). */
  defaults?(ctx: CalibrationContext): Partial<CalValues>;
  build(values: CalValues, ctx: CalibrationContext): CalibrationPlan;
  /** Räknar fram resultat ur uppmätta värden (tom om testet bedöms med ögat). */
  evaluate?(plan: CalibrationPlan, measured: Record<string, number>, values: CalValues, ctx: CalibrationContext): CalOutcome[];
}

/** Standardvärdena för ett tests parametrar (anpassade till maskin, material och verktyg). */
export function defaultValues(test: CalibrationTest, ctx?: CalibrationContext): CalValues {
  const base: CalValues = Object.fromEntries(test.params.map((p) => [p.key, p.def]));
  const extra = ctx && test.defaults ? test.defaults(ctx) : {};
  for (const [k, v] of Object.entries(extra)) {
    const p = test.params.find((x) => x.key === k);
    if (p && p.kind === 'number' && typeof v === 'number') base[k] = Math.min(p.max, Math.max(p.min, +v.toFixed(3)));
    else if (v !== undefined) base[k] = v;
  }
  return base;
}

/** Jämnt fördelade värden från a till b (n steg, n ≥ 1). */
export function steps(a: number, b: number, n: number, decimals = 0): number[] {
  const k = Math.max(1, Math.round(n));
  if (k === 1) return [+a.toFixed(decimals)];
  return Array.from({ length: k }, (_, i) => +(a + ((b - a) * i) / (k - 1)).toFixed(decimals));
}

export const num = (v: CalValues, k: string) => Number(v[k]);
export const str = (v: CalValues, k: string) => String(v[k]);

/** Rektangel som sluten polylinje. */
export const rectPl = (x0: number, y0: number, x1: number, y1: number): PolylineInput => ({ points: [x0, y0, x1, y0, x1, y1, x0, y1], closed: true });

/** Cirkel som sluten polylinje (fin uppdelning). */
export function circlePl(cx: number, cy: number, r: number, seg = 0): PolylineInput {
  const n = seg || Math.max(24, Math.ceil((2 * Math.PI * r) / 0.3));
  const points: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    points.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return { points, closed: true };
}

/** Polylinjer som form (för förhandsvisning och vektorexport). */
export function plShape(name: string, pls: PolylineInput[]): VectorShape {
  return {
    id: name,
    name,
    kind: 'imported',
    paths: pls
      .filter((p) => p.points.length >= 4)
      .map((p, i) => {
        const pts: { x: number; y: number }[] = [];
        for (let k = 0; k + 1 < p.points.length; k += 2) pts.push({ x: p.points[k], y: p.points[k + 1] });
        const segments = pts.slice(1).map((to) => ({ type: 'line' as const, to }));
        if (p.closed) segments.push({ type: 'line', to: pts[0] });
        return { id: `${name}-${i}`, start: pts[0], segments, closed: p.closed };
      }),
  };
}
