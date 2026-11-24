/**
 * Kontroller innan ett prov sparas: parametrarna mot maskinens gränser och
 * den färdiga G-koden mot arbetsytan och säkerhetsreglerna.
 *
 * En godkänd kontroll betyder bara att inget av det som kontrolleras är fel
 * – inte att filen är säker för varje maskin. Det säger gränssnittet också.
 */
import { parseGcode } from '../gcode';
import type { CalibrationCategory, CalibrationContext, CalibrationPlan, CalValues } from './types';

export type CalIssueCode =
  | 'outsideArea'
  | 'speedAboveMax'
  | 'spindleRange'
  | 'noTool'
  | 'depthThrough'
  | 'needsZ'
  | 'noZ'
  | 'badNumber'
  | 'gcodeOutside'
  | 'gcodeTooDeep'
  | 'gcodeBelowZero'
  | 'gcodeEmpty'
  | 'wrongMachine'
  | 'rangeOrder'
  | 'noLaserPower';

export interface CalIssue {
  level: 'error' | 'warning';
  code: CalIssueCode;
  /** Värden att sätta in i texten (t.ex. gränsen). */
  data?: Record<string, number | string>;
}

const EPS = 0.01;

/** Parametrarna och planen mot maskinen (före G-koden). */
export function validatePlan(category: CalibrationCategory, values: CalValues, plan: CalibrationPlan, ctx: CalibrationContext): CalIssue[] {
  const out: CalIssue[] = [];
  const m = ctx.machine;
  const machineKind = m.kind === 'router' ? 'router' : m.kind;
  if (machineKind !== category) out.push({ level: 'warning', code: 'wrongMachine', data: { kind: m.kind } });
  for (const [k, v] of Object.entries(values)) if (typeof v === 'number' && !Number.isFinite(v)) out.push({ level: 'error', code: 'badNumber', data: { key: k } });
  // Intervall åt fel håll (min > max) – tillåtet, men troligen ett misstag.
  for (const k of Object.keys(values))
    if (k.endsWith('Min')) {
      const base = k.slice(0, -3), max = values[`${base}Max`];
      if (typeof max === 'number' && Number(values[k]) > max) out.push({ level: 'warning', code: 'rangeOrder', data: { key: base } });
    }
  if (plan.x < -EPS || plan.y < -EPS || plan.x + plan.width > m.workArea.x + EPS || plan.y + plan.height > m.workArea.y + EPS)
    out.push({ level: 'error', code: 'outsideArea', data: { w: Math.round(plan.width), h: Math.round(plan.height), aw: m.workArea.x, ah: m.workArea.y } });
  const speeds = [...(plan.laser ?? []).filter((o) => o.polylines.length).map((o) => o.speed), ...['feed', 'feedMax', 'speed', 'speedMax', 'labelSpeed'].map((k) => Number(values[k])).filter((v) => v > 0)];
  const top = Math.max(0, ...speeds);
  if (m.maxFeed?.xy && top > m.maxFeed.xy + EPS) out.push({ level: 'warning', code: 'speedAboveMax', data: { v: top, max: m.maxFeed.xy } });
  if (category === 'laser' && !m.laser) out.push({ level: 'warning', code: 'noLaserPower' });
  if (category === 'router') {
    if (!(ctx.toolDiameter && ctx.toolDiameter > 0)) out.push({ level: 'error', code: 'noTool' });
    const depth = Math.max(0, ...['depth', 'depthMax'].map((k) => Number(values[k])).filter((v) => v > 0));
    if (depth >= ctx.thickness - EPS) out.push({ level: 'warning', code: 'depthThrough', data: { d: depth, t: ctx.thickness } });
    const rpm = Number(values.rpm);
    if (m.spindle && rpm > 0 && (rpm < m.spindle.minRpm - EPS || rpm > m.spindle.maxRpm + EPS)) out.push({ level: 'warning', code: 'spindleRange', data: { v: rpm, min: m.spindle.minRpm, max: m.spindle.maxRpm } });
  }
  if (plan.needsZ) {
    const hasZ = category === 'plasma' ? m.plasma?.zAxis !== false : m.workArea.z > 0;
    out.push(hasZ ? { level: 'warning', code: 'needsZ' } : { level: 'error', code: 'noZ' });
  }
  return out;
}

/** Den färdiga G-koden: inga ogiltiga tal, inom arbetsytan, inte djupare än tillåtet. */
export function validateGcode(gcode: string, category: CalibrationCategory, ctx: CalibrationContext): CalIssue[] {
  const out: CalIssue[] = [];
  if (!gcode.trim()) return [{ level: 'error', code: 'gcodeEmpty' }];
  if (/NaN|Infinity/.test(gcode)) out.push({ level: 'error', code: 'badNumber', data: { key: 'G-code' } });
  const { stats } = parseGcode(gcode);
  const b = stats.bounds;
  const a = ctx.machine.workArea;
  if (b.min.x < -EPS || b.min.y < -EPS || b.max.x > a.x + EPS || b.max.y > a.y + EPS) out.push({ level: 'error', code: 'gcodeOutside' });
  if (category === 'router' && b.min.z < -(ctx.thickness + 1) - EPS) out.push({ level: 'error', code: 'gcodeTooDeep', data: { z: +b.min.z.toFixed(2) } });
  if (category === 'plasma' && b.min.z < -EPS) out.push({ level: 'error', code: 'gcodeBelowZero', data: { z: +b.min.z.toFixed(2) } });
  return out;
}

export const hasErrors = (issues: CalIssue[]) => issues.some((i) => i.level === 'error');
