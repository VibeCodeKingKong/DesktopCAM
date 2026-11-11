import { Box, Maximize, Minus, Plus, RectangleHorizontal, Square } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { SmartTooltip } from '../smartguide/SmartTooltip';
import { tip } from '../ribbon/tip';
import { IlluViewFit, IlluViewIso, IlluViewTop, IlluZoom } from '../smartguide/illustrations';
import { useAppStore, type ViewCommand } from '../../store/useAppStore';
import { useT } from '../../i18n';

/** Vertikal verktygsrad i vyn. */
export function ViewportToolbar() {
  const t = useT();
  const cmd = useAppStore((s) => s.sendViewCommand);
  const h = t.hover;
  const buttons: { kind: ViewCommand; icon: LucideIcon; label: string; info: { title: string; desc: string }; illu: ReactNode; key?: string }[] = [
    { kind: 'zoomIn', icon: Plus, label: t.viewport.zoomIn, info: h.zoomIn, illu: <IlluZoom /> },
    { kind: 'zoomOut', icon: Minus, label: t.viewport.zoomOut, info: h.zoomOut, illu: <IlluZoom out /> },
    { kind: 'fit', icon: Maximize, label: t.viewport.fit, info: h.fit, illu: <IlluViewFit />, key: 'F' },
    { kind: 'top', icon: Square, label: t.viewport.top, info: h.top, illu: <IlluViewTop />, key: '1' },
    { kind: 'iso', icon: Box, label: t.viewport.iso, info: h.iso, illu: <IlluViewIso />, key: '2' },
    { kind: 'front', icon: RectangleHorizontal, label: t.viewport.front, info: h.front, illu: <IlluViewIso />, key: '3' },
  ];
  return (
    <div className="absolute right-2 top-2 flex flex-col gap-0.5 rounded-lg border border-line bg-surface/90 p-1 shadow-sm backdrop-blur sm:right-3 sm:top-3">
      {buttons.map(({ kind, icon: Icon, label, info, illu, key }, i) => (
        <SmartTooltip key={kind} content={tip(info, { illustration: illu, shortcut: key })}>
        <button
          onClick={() => cmd(kind)}
          aria-label={label}
          className={`flex h-8 w-8 items-center justify-center rounded-md text-ink/80 hover:bg-app hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:h-7 sm:w-7 ${
            i === 2 ? 'mb-1 border-b border-line pb-1' : ''
          }`}
        >
          <Icon size={15} strokeWidth={1.8} />
        </button>
        </SmartTooltip>
      ))}
    </div>
  );
}
