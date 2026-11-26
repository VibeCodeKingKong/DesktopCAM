/**
 * Kalibreringshistorik: sparade prov med mätningar, bildanalys och anteckningar.
 *
 * Lagras i webbläsaren (IndexedDB via idb-keyval, Apache-2.0 – samma som
 * Senaste projekt och autosparningen). Ingenting skickas någonstans.
 * Värden som användaren uttryckligen godkänt (t.ex. uppmätt snittbredd)
 * används som standard när nya banor skapas för samma maskin och material.
 */
import { get, set } from 'idb-keyval';
import { create } from 'zustand';
import type { CalibrationCategory, CalOutcome, CalValues } from '@desktopcam/core';

export interface CalibrationRecord {
  id: string;
  /** ISO-datum. */
  date: string;
  testId: string;
  category: CalibrationCategory;
  machineId: string;
  machineName: string;
  materialId: string;
  materialName: string;
  thickness: number;
  toolName?: string;
  toolDiameter?: number;
  values: CalValues;
  measured: Record<string, number>;
  outcomes: CalOutcome[];
  /** Bildanalysen (visuella observationer, inte mått). */
  analysis?: {
    confidence: 'low' | 'medium' | 'high';
    target: number;
    readings: { label: string; darkness: number; unevenness: number; values: Record<string, number> }[];
    best: string[];
  };
  /** Liten JPEG av det upprätade fotot (data-URL). */
  photo?: string;
  notes: string;
  /** Inställningar som användaren valt som bäst (t.ex. effekt och hastighet ur en ruta). */
  chosen?: Record<string, number>;
  /** Resultat som användaren godkänt som standard (nycklar ur outcomes, t.ex. "kerf"). */
  approved?: string[];
}

const KEY = 'desktopcam.calibration.v1';

interface CalibrationState {
  records: CalibrationRecord[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (r: CalibrationRecord) => void;
  update: (id: string, patch: Partial<CalibrationRecord>) => void;
  remove: (id: string) => void;
}

const persist = (records: CalibrationRecord[]) => {
  void set(KEY, records).catch(() => {
    /* privat läge eller full lagring – historiken finns kvar i minnet */
  });
};

export const useCalibration = create<CalibrationState>()((setState, getState) => ({
  records: [],
  loaded: false,
  load: async () => {
    if (getState().loaded) return;
    try {
      const r = await get<CalibrationRecord[]>(KEY);
      const stored = Array.isArray(r) ? r : [];
      // Prov som sparats medan inläsningen pågick ska inte skrivas över.
      const fresh = getState().records;
      const records = [...fresh, ...stored.filter((x) => !fresh.some((y) => y.id === x.id))];
      setState({ records, loaded: true });
      if (fresh.length) persist(records);
    } catch {
      setState({ loaded: true });
    }
  },
  add: (r) => {
    const records = [r, ...getState().records];
    setState({ records });
    // Innan sparade prov lästs in skrivs inget – det skulle radera dem. Inläsningen sparar sammanslaget.
    if (getState().loaded) persist(records);
  },
  update: (id, patch) => {
    const records = getState().records.map((x) => (x.id === id ? { ...x, ...patch } : x));
    setState({ records });
    // Innan sparade prov lästs in skrivs inget – det skulle radera dem. Inläsningen sparar sammanslaget.
    if (getState().loaded) persist(records);
  },
  remove: (id) => {
    const records = getState().records.filter((x) => x.id !== id);
    setState({ records });
    // Innan sparade prov lästs in skrivs inget – det skulle radera dem. Inläsningen sparar sammanslaget.
    if (getState().loaded) persist(records);
  },
}));

/**
 * Senast godkända uppmätta värde för maskin och material (närmast i tjocklek,
 * högst `maxThicknessDiff` mm ifrån), annars undefined.
 */
export function approvedValue(apply: NonNullable<CalOutcome['apply']>, machineId: string, materialId: string, thickness: number, maxThicknessDiff = 1): number | undefined {
  let best: { v: number; d: number; date: string } | undefined;
  for (const r of useCalibration.getState().records) {
    if (r.machineId !== machineId || (apply !== 'toolDiameter' && r.materialId !== materialId)) continue;
    for (const o of r.outcomes) {
      if (o.apply !== apply || !r.approved?.includes(o.key)) continue;
      const d = Math.abs(r.thickness - thickness);
      if (apply !== 'toolDiameter' && d > maxThicknessDiff) continue;
      if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) < 1e-9 && r.date > best.date)) best = { v: o.value, d, date: r.date };
    }
  }
  return best?.v;
}

/** Förval ur kalibreringen för nya banor (värden användaren valt och godkänt). */
export interface CalibratedDefaults {
  /** Laserskärning: effekt (%), hastighet (mm/min), antal pass. */
  laserCut?: { power?: number; speed?: number; passes?: number };
  /** Lasergravyr: effekt, hastighet och radavstånd (mm). */
  laserEngrave?: { power?: number; speed?: number; interval?: number };
  /** Plasma: matning, väntetid vid genomstickning, skärhöjd. */
  plasma?: { feed?: number; pierceDelay?: number; cutHeight?: number };
  /** Fräs (samma fräsdiameter): matning och sidosteg (andel 0–1). */
  router?: { feed?: number; stepOver?: number };
  /** Datum för det senaste provet som används. */
  date?: string;
}

/** Prov vars valda inställning kan bli förval (rutorna har värden att välja mellan). */
export const CHOOSABLE_TESTS = ['laser-power', 'laser-speed', 'laser-matrix', 'laser-interval', 'laser-passes', 'plasma-speed', 'plasma-pierce', 'plasma-height', 'router-feed', 'router-finish'];

/**
 * Godkända förval för maskin och material (närmast i tjocklek, högst
 * `maxThicknessDiff` mm ifrån). Varje värde tas från det senaste provet som
 * har det. Fräsvärden bara för samma fräsdiameter.
 */
export function calibratedDefaults(machineId: string, materialId: string, thickness: number, toolDiameter?: number, maxThicknessDiff = 1): CalibratedDefaults {
  const out: CalibratedDefaults = {};
  const recs = useCalibration
    .getState()
    .records.filter((r) => r.chosen && r.approved?.includes('chosen') && r.machineId === machineId && r.materialId === materialId && Math.abs(r.thickness - thickness) <= maxThicknessDiff + 1e-9)
    .sort((a, b) => Math.abs(a.thickness - thickness) - Math.abs(b.thickness - thickness) || b.date.localeCompare(a.date));
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const put = <K extends keyof CalibratedDefaults>(k: K, field: string, v: number | undefined, date: string) => {
    if (v === undefined) return;
    const obj = (out[k] ??= {} as never) as Record<string, number>;
    if (obj[field] === undefined) {
      obj[field] = v;
      if (!out.date || date > out.date) out.date = date;
    }
  };
  for (const r of recs) {
    const c = r.chosen!;
    const v = r.values;
    if (r.category === 'laser') {
      if (r.testId === 'laser-interval') put('laserEngrave', 'interval', num(c.interval), r.date);
      else if (r.testId === 'laser-passes') {
        put('laserCut', 'passes', num(c.passes), r.date);
        put('laserCut', 'power', num(v.power), r.date);
        put('laserCut', 'speed', num(v.speed), r.date);
      } else {
        const k = v.mode === 'cut' ? 'laserCut' : 'laserEngrave';
        put(k, 'power', num(c.power) ?? num(v.power), r.date);
        put(k, 'speed', num(c.speed) ?? num(v.speed), r.date);
      }
    } else if (r.category === 'plasma') {
      put('plasma', 'feed', num(c.feed), r.date);
      put('plasma', 'pierceDelay', num(c.pierceDelay), r.date);
      put('plasma', 'cutHeight', num(c.cutHeight), r.date);
    } else if (r.category === 'router' && toolDiameter !== undefined && r.toolDiameter !== undefined && Math.abs(r.toolDiameter - toolDiameter) < 1e-6) {
      put('router', 'feed', num(c.feed), r.date);
      const so = num(c.stepOver);
      put('router', 'stepOver', so === undefined ? undefined : so / 100, r.date);
    }
  }
  return out;
}
