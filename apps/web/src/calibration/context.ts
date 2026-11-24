/**
 * Provets sammanhang ur projektet: vald maskin, materialet och dess tjocklek,
 * fräsen och riktvärdena (samma som när en vanlig bana skapas).
 */
import { plasmaDataFor, routerParamsFor, type CalibrationContext, type ToolDefinition } from '@desktopcam/core';
import { getEffectiveMaterial, getMachine, getMaterialPreset, useAppStore } from '../store/useAppStore';

/** Fräsen för fräsproven: den valda om den är en pinn- eller kulfräs, annars den första pinnfräsen. */
export function calibrationTool(): ToolDefinition | undefined {
  const s = useAppStore.getState();
  const active = s.tools.find((t) => t.id === s.activeToolId);
  if (active && (active.kind === 'endmill' || active.kind === 'ballnose')) return active;
  return s.tools.find((t) => t.kind === 'endmill');
}

export function calibrationContext(): CalibrationContext {
  const s = useAppStore.getState();
  const machine = getMachine();
  const preset = getMaterialPreset();
  const tool = calibrationTool();
  const rp = tool ? routerParamsFor(getEffectiveMaterial(), tool, machine) : null;
  const plasma = machine.kind === 'plasma' ? plasmaDataFor(preset, machine, s.material.thickness) : null;
  return {
    machine,
    thickness: s.material.thickness,
    toolDiameter: tool?.diameter,
    router: rp ?? (tool ? { feedRate: tool.defaults.feedRate, plungeRate: tool.defaults.plungeRate, spindleRpm: tool.defaults.spindleRpm ?? 18000, stepDown: tool.defaults.stepDown } : undefined),
    plasma: plasma ? { feedRate: plasma.feedRate, kerf: plasma.kerf, pierceDelay: plasma.pierceDelay, pierceHeight: plasma.pierceHeight, cutHeight: plasma.cutHeight } : undefined,
  };
}
