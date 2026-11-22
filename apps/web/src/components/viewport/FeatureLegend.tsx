import type { FeatureSeverity } from '@desktopcam/core';
import { useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { FEATURE_COLORS, featureMachine, severityLabel } from '../../cam/featureCheck';

const ORDER: FeatureSeverity[] = ['fail', 'poor', 'thin'];

/** Vad färgerna på markeringarna betyder, för den markerade banan. */
export function FeatureLegend() {
  const t = useT();
  const id = useAppStore((s) => s.selectedToolpathId);
  const features = useAppStore((s) => (s.selectedToolpathId ? s.results[s.selectedToolpathId]?.features : undefined));
  const tp = useAppStore((s) => s.toolpaths.find((x) => x.id === id));
  const show = useAppStore((s) => s.view.showToolpaths);
  if (!features?.length || !tp || !show) return null;
  const machine = featureMachine(tp);
  const present = ORDER.filter((sev) => features.some((f) => f.severity === sev));
  return (
    <div className="pointer-events-none absolute left-2 top-12 z-10 rounded-lg border border-line bg-surface/90 px-2.5 py-2 text-2xs shadow-sm backdrop-blur sm:left-3 sm:top-3" data-testid="feature-legend">
      <p className="mb-1 font-medium text-ink">
        {t.featureCheck.legend} <span className="tabular-nums text-muted">({features.length})</span>
      </p>
      <ul className="space-y-0.5">
        {present.map((sev) => (
          <li key={sev} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: FEATURE_COLORS[sev].fill }} aria-hidden />
            <span>{severityLabel(t, sev, machine)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
