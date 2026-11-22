/**
 * Gemensamt för kontrollen av små detaljer: färger, vilken maskin en bana
 * gäller och texterna – så att vyn, förklaringen och listan stämmer överens.
 */
import { minHoleDiameter, minPartWidth, withPlasmaDefaults, type ToolpathConfig, type FeatureIssue, type FeatureMachine, type FeatureSeverity } from '@desktopcam/core';
import type { Dict } from '../i18n';


export const FEATURE_COLORS: Record<FeatureSeverity, { fill: string; text: string }> = {
  fail: { fill: '#e5484d', text: '#ffffff' },
  poor: { fill: '#f76b15', text: '#ffffff' },
  thin: { fill: '#f5c518', text: '#1d1d1f' },
};

export function featureMachine(tp: ToolpathConfig | undefined): FeatureMachine {
  if (tp?.operation === 'plasmaCut') return 'plasma';
  if (tp?.operation === 'laserCut') return 'laser';
  return 'router';
}

export function severityLabel(t: Dict, sev: FeatureSeverity, machine: FeatureMachine): string {
  const f = t.featureCheck.severity;
  return sev === 'thin' ? (machine === 'router' ? f.thinRouter : f.thin) : f[sev];
}

export function issueTitle(t: Dict, f: FeatureIssue): string {
  return t.featureCheck.kind[f.kind](f.size);
}

/** Råd för en detalj, anpassat till maskinen (och för plasma till valet för små hål). */
export function issueAdvice(t: Dict, f: FeatureIssue, tp: ToolpathConfig, width: number, thickness: number): string {
  const a = t.featureCheck.advice;
  const m = featureMachine(tp);
  const minHole = minHoleDiameter(m, width, thickness);
  const minPart = minPartWidth(m, width, thickness);
  if (f.severity === 'thin') return m === 'plasma' ? a.plasmaThin(minPart) : m === 'laser' ? a.laserThin(minPart) : a.routerThin(minPart);
  if (m === 'router') return a.routerFail(width);
  if (m === 'laser') return f.severity === 'fail' ? a.laserFail(width) : a.laserPoor(f.kind === 'hole' ? minHole : 2 * width);
  if (f.kind === 'hole' && tp.operation === 'plasmaCut') {
    const mode = withPlasmaDefaults(tp.plasma).smallHoles;
    return mode === 'mark' ? a.plasmaHoleMark(minHole) : mode === 'cut' ? a.plasmaHoleCut(minHole) : a.plasmaHoleSkip;
  }
  return f.severity === 'fail' ? a.plasmaGapFail(width, 2 * width) : a.plasmaGapPoor(2 * width);
}

/** Bredden kontrollen räknade med: snittbredd eller fräsdiameter. */
export function featureWidth(tp: ToolpathConfig, toolDiameter: number | undefined): number {
  if (tp.operation === 'plasmaCut' || tp.operation === 'laserCut') return tp.kerf;
  return toolDiameter ?? 0;
}
