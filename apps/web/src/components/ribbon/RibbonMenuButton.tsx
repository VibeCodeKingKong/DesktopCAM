import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { SmartTooltip, type SmartTooltipContent } from '../smartguide/SmartTooltip';

export interface RibbonMenuItem {
  icon: LucideIcon;
  label: string;
  desc?: string;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Stor bandknapp som öppnar en meny med alternativ (som Office-bandets
 * rullgardinsknappar). Menyn ritas i en portal eftersom bandet rullar i sidled.
 */
export function RibbonMenuButton({ icon: Icon, label, tooltip, items }: { icon: LucideIcon; label: string; tooltip: SmartTooltipContent; items: RibbonMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const w = 260;
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), top: r.bottom + 4 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key);
    window.addEventListener('resize', () => setOpen(false), { once: true });
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  const button = (
    <button
      ref={btn}
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-haspopup="menu"
      aria-expanded={open}
      className={`flex h-[62px] min-w-[54px] select-none flex-col items-center justify-start gap-1 rounded-md px-1.5 pt-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${open ? 'bg-accent/10 ring-1 ring-inset ring-accent/30' : 'hover:bg-app active:bg-line/60'}`}
    >
      <Icon size={24} strokeWidth={1.6} className="text-accent" />
      <span className="flex max-w-[72px] items-center gap-0.5 text-center text-2xs leading-tight">
        {label}
        <ChevronDown size={10} className="shrink-0 text-muted" />
      </span>
    </button>
  );

  return (
    <>
      {open ? button : <SmartTooltip content={tooltip}>{button}</SmartTooltip>}
      {open &&
        createPortal(
          <div ref={menu} role="menu" aria-label={label} className="fixed z-[60] w-[260px] rounded-lg border border-line bg-surface p-1 shadow-pop" style={pos}>
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-app disabled:opacity-40"
              >
                <it.icon size={18} strokeWidth={1.7} className="mt-0.5 shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block text-xs font-medium">{it.label}</span>
                  {it.desc && <span className="block text-2xs leading-snug text-muted">{it.desc}</span>}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
