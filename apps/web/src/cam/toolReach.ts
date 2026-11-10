/**
 * Kontrollerar att verktyget räcker till banans djup: skärlängden ska räcka,
 * och spännhylsan får inte slå i materialet.
 */
import type { ToolDefinition, ToolpathStats } from '@desktopcam/core';
import type { Dict } from '../i18n';

/** Skärande höjd för ett verktyg (mm), om den är känd. */
export function cuttingLength(tool: ToolDefinition): number | undefined {
  if (tool.fluteLength && tool.fluteLength > 0) return tool.fluteLength;
  // V-fräs: konan är skärlängden.
  if (tool.kind === 'vbit') return tool.diameter / 2 / Math.tan(((tool.angle ?? 90) * Math.PI) / 360);
  return undefined;
}

export function toolReachWarnings(tool: ToolDefinition | undefined, stats: ToolpathStats, t: Dict): string[] {
  if (!tool || tool.kind === 'laser') return [];
  const depth = Math.max(0, -stats.bounds.min.z);
  if (depth <= 0) return [];
  const out: string[] = [];
  const cut = cuttingLength(tool);
  // Spännhylsan sitter vid utsticket; lämna 1 mm marginal.
  if (tool.stickout && depth > tool.stickout - 1) out.push(t.reach.collet(depth, tool.stickout));
  else if (cut && depth > cut + 0.01) out.push(tool.kind === 'vbit' ? t.reach.vbit(depth, cut) : t.reach.flute(depth, cut));
  return out;
}
