import { useEffect, useRef } from 'react';
import { CircleCheck } from 'lucide-react';
import type { FeatureIssue, ToolpathConfig } from '@desktopcam/core';
import { useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { FEATURE_COLORS, featureMachine, featureWidth, issueAdvice, issueTitle, severityLabel } from '../../cam/featureCheck';

/**
 * Små detaljer som verktyget inte klarar. Samma färg och nummer som
 * markeringarna i vyn: peka på en rad för att lysa upp markeringen, klicka
 * för att zooma dit.
 */
export function FeatureList({ tp, features }: { tp: ToolpathConfig; features: FeatureIssue[] | undefined }) {
  const t = useT();
  const f = t.featureCheck;
  const hover = useAppStore((s) => s.featureHover);
  const pick = useAppStore((s) => s.featurePick);
  const tools = useAppStore((s) => s.tools);
  const thickness = useAppStore((s) => s.material.thickness);
  const setHover = useAppStore((s) => s.setFeatureHover);
  const pickFeature = useAppStore((s) => s.pickFeature);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);

  // Klick på en markering i vyn: visa raden.
  useEffect(() => {
    if (pick?.from === 'view') rows.current[pick.index]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [pick]);
  useEffect(() => () => setHover(null), [setHover]);

  if (!features) return null;
  if (!features.length)
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <CircleCheck size={13} className="shrink-0 text-ok" /> {f.allOk}
      </p>
    );
  const machine = featureMachine(tp);
  const toolId = 'toolId' in tp ? (tp as { toolId?: string }).toolId : undefined;
  const width = featureWidth(tp, tools.find((x) => x.id === toolId)?.diameter);
  return (
    <div className="space-y-1" data-testid="feature-list">
      <div className="flex items-baseline justify-between text-xs font-medium">
        <span>{f.title}</span>
        <span className="tabular-nums text-muted">{features.length}</span>
      </div>
      <ul className="space-y-1">
        {features.map((it, i) => {
          const c = FEATURE_COLORS[it.severity];
          const active = hover === i || pick?.index === i;
          return (
            <li key={i}>
              <button
                ref={(el) => {
                  rows.current[i] = el;
                }}
                type="button"
                className={`flex w-full gap-2 rounded-md border px-2 py-1.5 text-left text-xs leading-snug transition-colors ${active ? 'border-accent bg-accent/10' : 'border-line hover:bg-app'}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => {
                  pickFeature(i, 'list');
                  // Telefon: panelen täcker vyn – stäng den så att detaljen syns.
                  if (window.matchMedia?.('(max-width: 1023px)').matches) useAppStore.getState().setMobilePanel(null);
                }}
              >
                <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold tabular-nums" style={{ background: c.fill, color: c.text }} aria-hidden>
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">
                    {issueTitle(t, it)} · <span style={{ color: it.severity === 'thin' ? undefined : c.fill }}>{severityLabel(t, it.severity, machine)}</span>
                  </span>
                  <span className="block text-muted">{issueAdvice(t, it, tp, width, thickness)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-2xs text-muted">{f.hint}</p>
    </div>
  );
}
