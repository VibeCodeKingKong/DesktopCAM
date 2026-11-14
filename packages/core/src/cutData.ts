/**
 * Riktvärden anpassade efter maskinen och materialets tjocklek.
 *
 * Materialens värden i materials.json gäller en referens:
 *   Fräs:  3,175 mm tvåskärs pinnfräs på en styv hobbyfräs.
 *   Laser: 10 W optisk diodlaser, skärtabell per tjocklek.
 *   Plasma: hobbyaggregat 40–60 A med tryckluft, skärtabell per tjocklek.
 * Här skalas de till den valda maskinen (spindelns varvtal, maxfart,
 * lätt eller styv fräs, laserns effekt, plasmaaggregatets ström).
 */
import type { MachineProfile, MaterialPreset, ToolDefinition } from './types';
import { plasmaChartAt } from './plasma';

export interface LaserChartRow {
  thickness: number;
  /** Skärhastighet vid 10 W optisk effekt (mm/min). */
  speed: number;
  passes: number;
  /** Effekt i procent. */
  power: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const round = (v: number, step: number) => Math.round(v / step) * step;

/** Lätta fräsar (MPCNC, LowRider, 3018): grundare pass och lägre matning. */
export const isLightRouter = (m: MachineProfile) => m.kind === 'router' && !(m.maxFeed.xy >= 3000 || /4040|shapeoko|longmill|onefinity/i.test(m.name));

/** Laserns skärdata för en tjocklek vid 10 W, interpolerad i tabellen. */
function laserRowAt(rows: LaserChartRow[], t: number): LaserChartRow {
  const r = [...rows].sort((a, b) => a.thickness - b.thickness);
  if (t <= r[0].thickness) return { ...r[0], thickness: t };
  const last = r[r.length - 1];
  if (t >= last.thickness) {
    // Tjockare än tabellen: fler pass i samma takt som tjockleken.
    return { ...last, thickness: t, passes: Math.ceil((last.passes * t) / last.thickness) };
  }
  const i = r.findIndex((x) => x.thickness >= t);
  const a = r[i - 1], b = r[i];
  const k = (t - a.thickness) / (b.thickness - a.thickness);
  return { thickness: t, speed: a.speed + (b.speed - a.speed) * k, passes: Math.round(a.passes + (b.passes - a.passes) * k), power: a.power + (b.power - a.power) * k };
}

/** Största tjocklek lasern skär rimligt (i flera pass), utifrån tabellen vid 10 W. */
export function laserMaxThickness(rows: LaserChartRow[] | undefined, watts: number): number {
  if (!rows?.length) return 0;
  const max = Math.max(...rows.map((r) => r.thickness));
  return +(max * Math.pow(Math.max(1, watts) / 10, 0.6)).toFixed(1);
}

/**
 * Materialet med värden för den här maskinen och tjockleken. Samma form som
 * MaterialPreset, så att allt som visar riktvärden kan använda den direkt.
 */
export function effectiveMaterial(preset: MaterialPreset, machine: MachineProfile, thickness: number): MaterialPreset & { laserTooThick?: boolean } {
  const out: MaterialPreset & { laserTooThick?: boolean } = { ...preset };

  if (preset.router && machine.kind === 'router') {
    const r = { ...preset.router };
    // Varvtalet inom spindelns område; matningen följer med så att spånet blir lika tjockt.
    const sp = machine.spindle;
    if (sp && sp.maxRpm > 0) {
      const rpm = clamp(r.spindleRpm, sp.minRpm || 0, sp.maxRpm);
      if (rpm !== r.spindleRpm) {
        r.feedRate *= rpm / r.spindleRpm;
        r.plungeRate *= rpm / r.spindleRpm;
        r.spindleRpm = rpm;
      }
    }
    if (isLightRouter(machine)) {
      r.feedRate *= 0.8;
      r.stepDownFactor *= 0.6;
    }
    r.feedRate = Math.min(r.feedRate, machine.maxFeed.xy * 0.9);
    r.plungeRate = Math.min(r.plungeRate, (machine.maxFeed.z || r.plungeRate) * 0.9, r.feedRate);
    out.router = { feedRate: round(r.feedRate, 10), plungeRate: round(r.plungeRate, 10), spindleRpm: round(r.spindleRpm, 500), stepDownFactor: +r.stepDownFactor.toFixed(2) };
  }

  const chart = preset.laser.chart;
  if (machine.kind === 'laser') {
    const watts = machine.laser?.opticalPowerW ?? 10;
    const maxFeed = machine.maxFeed.xy;
    const l = { ...preset.laser };
    if (chart?.length && l.canCut !== false) {
      const row = laserRowAt(chart, thickness);
      // Mer effekt: både fortare och färre pass (energin per mm fördelas på båda).
      const k = Math.max(0.5, watts / 10);
      l.cutSpeed = round(Math.min(row.speed * Math.pow(k, 0.7), maxFeed), 10);
      l.cutPasses = Math.max(1, Math.ceil(row.passes * Math.pow(1 / k, 0.5) - 0.15));
      l.cutPowerPct = Math.round(row.power);
      out.laserTooThick = thickness > laserMaxThickness(chart, watts);
    }
    // Gravyr: kraftigare laser går fortare (upp till 2×) och med lägre effekt.
    const speed = Math.min(l.engraveSpeed * clamp(watts / 10, 1, 2), maxFeed);
    l.engraveSpeed = round(speed, 100);
    l.engravePowerPct = Math.round(clamp(((l.engravePowerPct * 10) / watts) * (speed / preset.laser.engraveSpeed), 5, 100));
    out.laser = l;
  }
  return out;
}

/**
 * Plasmaskärdata för tjockleken, begränsad till aggregatets ström. Med lägre
 * ström än tabellen sänks matningen ungefär i proportion.
 */
export function plasmaDataFor(preset: MaterialPreset, machine: MachineProfile, thickness: number) {
  const row = plasmaChartAt(preset.plasma, thickness);
  if (!row) return null;
  const maxAmps = machine.plasma?.maxAmps ?? row.amps;
  if (row.amps <= maxAmps) return row;
  return { ...row, amps: maxAmps, feedRate: round((row.feedRate * maxAmps) / row.amps, 10), limited: true as const };
}

/**
 * Fräsdata för ett visst verktyg: matningen skalas efter antal skär och
 * diameter (större fräs tål tjockare spån), skärdjupet efter diametern.
 */
export function routerParamsFor(eff: MaterialPreset, tool: ToolDefinition, machine: MachineProfile) {
  const r = eff.router;
  if (!r) return null;
  const flutes = tool.flutes ?? 2;
  const scale = (flutes / 2) * clamp(tool.diameter / 3.175, 0.5, 1.8);
  return {
    feedRate: round(Math.min(r.feedRate * scale, machine.maxFeed.xy * 0.9), 10),
    plungeRate: round(Math.min(r.plungeRate * clamp(tool.diameter / 3.175, 0.6, 1.5), r.feedRate * scale), 10),
    spindleRpm: r.spindleRpm,
    stepDown: +(tool.diameter * r.stepDownFactor).toFixed(2),
  };
}
