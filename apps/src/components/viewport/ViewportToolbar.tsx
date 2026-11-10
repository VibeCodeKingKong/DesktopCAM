import { Box, Maximize, Minus, Plus, RectangleHorizontal, Square } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppStore, type ViewCommand } from '../../store/useAppStore';
import { useT } from '../../i18n';

/** Vertikal verktygsrad i vyn. */
export function ViewportToolbar() {
  const t = useT();
  const cmd = useAppStore((s) => s.sendViewCommand);
  const buttons: { kind: ViewCommand; icon: LucideIcon; label: string }[] = [
    { kind: 'zoomIn', icon: Plus, label: t.viewport.zoomIn },
    { kind: 'zoomOut', icon: Minus, label: t.viewport.zoomOut },
    { kind: 'fit', icon: Maximize, label: t.viewport.fit },
    { kind: 'top', icon: Square, label: t.viewport.top },
    { kind: 'iso', icon: Box, label: t.viewport.iso },
    { kind: 'front', icon: RectangleHorizontal, label: t.viewport.front },
  ];
  return (
    <div className="absolute right-2 top-2 flex flex-col gap-0.5 rounded-lg border border-line bg-surface/90 p-1 shadow-sm backdrop-blur sm:right-3 sm:top-3">
      {buttons.map(({ kind, icon: Icon, label }, i) => (
        <button
          key={kind}
          onClick={() => cmd(kind)}
          title={label}
          aria-label={label}
          className={`flex h-8 w-8 items-center justify-center rounded-md text-ink/80 hover:bg-app hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:h-7 sm:w-7 ${
            i === 2 ? 'mb-1 border-b border-line pb-1' : ''
          }`}
        >
          <Icon size={15} strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}
