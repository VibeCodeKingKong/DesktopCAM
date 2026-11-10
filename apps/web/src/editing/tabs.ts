/**
 * Flikplacering i vyn, som i Estlcam: flikarna är punkter på detaljens kontur.
 * Klicka på konturen för att lägga till, klicka på en flik för att ta bort,
 * dra för att flytta.
 */
import { autoTabPositions, nearestOnContours, shapeToPolylines, type PolylineInput, type ProfileToolpath, type TabSettings, type Vec2 } from '@desktopcam/core';
import { allShapes, useAppStore } from '../store/useAppStore';
import { resolveProfile, scheduleCompute } from '../cam/toolpathService';

export interface TabContext {
  tp: ProfileToolpath;
  tabs: TabSettings;
  contours: PolylineInput[];
  groups: PolylineInput[][];
  toolDiameter: number;
  positions: Vec2[];
}

/** Flikdata för den markerade profilbanan, eller null om den inte har flikar. */
export function tabContext(): TabContext | null {
  const s = useAppStore.getState();
  const tp = s.toolpaths.find((x) => x.id === s.selectedToolpathId);
  if (!tp || tp.operation !== 'profile' || tp.side === 'on') return null;
  const { tabs } = resolveProfile(tp);
  if (!tabs.enabled) return null;
  const shapes = allShapes(s.layers).filter((sh) => tp.shapeIds.includes(sh.id));
  const groups = shapes.map((sh) => shapeToPolylines(sh).filter((p) => p.closed)).filter((g) => g.length);
  const toolDiameter = s.tools.find((x) => x.id === tp.toolId)?.diameter ?? 3;
  const positions = tabs.mode === 'manual' ? (tabs.positions ?? []) : autoTabPositions(groups, tabs, toolDiameter);
  return { tp, tabs, contours: groups.flat(), groups, toolDiameter, positions };
}

/** Sparar handplacerade flikar och räknar om banan. */
export function setTabPositions(ctx: TabContext, positions: Vec2[]) {
  useAppStore.getState().updateToolpath(ctx.tp.id, { tabs: { ...ctx.tabs, mode: 'manual', positions } });
  scheduleCompute(ctx.tp.id, 250);
}

/** Läge och riktning på konturen närmast punkten. */
export const onContour = (ctx: TabContext, p: Vec2) => nearestOnContours(ctx.contours, p.x, p.y);
