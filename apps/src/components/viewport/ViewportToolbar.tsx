import { Box, Maximize, Minus, Plus, Square, RectangleHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppStore, type ViewCommand } from '../../store/useAppStore';

const BUTTONS: { kind: ViewCommand; icon: LucideIcon; label: string }[] = [
  { kind: 'zoomIn', icon: Plus, label: 'Zooma in' },
  { kind: 'zoomOut', icon: Minus, label: 'Zooma ut' },
  { kind: 'fit', icon: Maximize, label: 'Anpassa vy (F)' },
  { kind: 'top', icon: Square, label: 'Uppifrån (1)' },
  { kind: 'iso', icon: Box, label: 'Isometrisk (2)' },
  { kind: 'front', icon: RectangleHorizontal, label: 'Framifrån (3)' },
];

/** Vertikal verktygsrad i vyn, som i skissen. */
export function ViewportToolbar() {
  const cmd = useAppStore((s) => s.sendViewCommand);
  return (
    <div className="absolute right-3 top-3 flex flex-col gap-0.5 rounded-lg border border-line bg-surface/90 p-1 shadow-sm backdrop-blur">
      {BUTTONS.map(({ kind, icon: Icon, label }, i) => (
        <button
          key={kind}
          onClick={() => cmd(kind)}
          title={label}
          aria-label={label}
          className={`flex h-7 w-7 items-center justify-center rounded-md text-ink/80 hover:bg-app hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
            i === 2 ? 'mb-1 border-b border-line pb-1' : ''
          }`}
        >
          <Icon size={15} strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}
