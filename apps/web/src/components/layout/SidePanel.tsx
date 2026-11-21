import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAppStore, type MobilePanel } from '../../store/useAppStore';
import { useT } from '../../i18n';

/**
 * Sidopanel som ligger fast bredvid 3D-vyn på stora skärmar och glider in
 * som ett ark på surfplatta. På telefon är högerpanelen (Egenskaper) ett ark
 * nerifrån: halvhögt så att vyn syns ovanför, dra upp för helt, ned för att
 * stänga.
 */
export function SidePanel({
  id,
  side,
  title,
  wide,
  children,
}: {
  id: Exclude<MobilePanel, null>;
  side: 'left' | 'right';
  title: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const open = useAppStore((s) => s.mobilePanel === id);
  const close = () => useAppStore.getState().setMobilePanel(null);
  const width = wide ? 'lg:w-72' : 'lg:w-60';
  const sheet = side === 'right';
  const [full, setFull] = useState(false);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const [dy, setDy] = useState(0);
  useEffect(() => {
    if (!open) setFull(false);
  }, [open]);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, dy: 0 };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current.dy = e.clientY - drag.current.y;
    setDy(drag.current.dy);
  };
  const onUp = () => {
    const d = drag.current?.dy ?? 0;
    drag.current = null;
    setDy(0);
    if (Math.abs(d) < 6) setFull((f) => !f);
    else if (d < -40) setFull(true);
    else if (d > 40) {
      if (full) setFull(false);
      else close();
    }
  };

  return (
    <>
      {open && <div className={`fixed inset-0 z-30 bg-black/25 lg:hidden ${sheet ? 'max-sm:hidden' : ''}`} onClick={close} aria-hidden="true" />}
      <aside
        aria-label={title}
        data-tour={`panel-${id}`}
        style={sheet && dy ? { transform: `translateY(${Math.max(dy, full ? -0 : -80)}px)` } : undefined}
        className={`${open ? 'flex' : 'hidden'} fixed inset-y-0 z-40 w-[min(88vw,340px)] flex-col bg-surface shadow-pop lg:static lg:z-auto lg:flex lg:shadow-none ${width} shrink-0 ${
          side === 'left' ? 'left-0 border-r border-line' : 'right-0 border-l border-line'
        } pt-[env(safe-area-inset-top)] lg:pt-0 ${
          sheet
            ? `max-sm:top-auto max-sm:w-full max-sm:rounded-t-2xl max-sm:border-l-0 max-sm:border-t max-sm:pt-0 max-sm:transition-[height] max-sm:duration-200 ${full ? 'max-sm:h-[88dvh]' : 'max-sm:h-[46dvh]'}`
            : ''
        }`}
      >
        {sheet && (
          <div
            className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center sm:hidden"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            role="button"
            aria-label={title}
            aria-expanded={full}
          >
            <span className="h-1.5 w-10 rounded-full bg-line" />
          </div>
        )}
        <div className="panel-heading">
          <span className="truncate">{title}</span>
          <button className="rounded p-1 text-muted hover:bg-app hover:text-ink lg:hidden" onClick={close} aria-label={t.common.close}>
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
      </aside>
    </>
  );
}
