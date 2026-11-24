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
