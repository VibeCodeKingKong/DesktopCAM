import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { placeFloating, type FloatingPosition } from './position';

export interface SmartTooltipContent {
  title: string;
  description: string;
  shortcut?: string;
  /** Liten diagram/animation som förklarar funktionen. */
  illustration?: ReactNode;
  /** Visas när knappen är inaktiv, t.ex. "Kräver en laser". */
  disabledReason?: string;
}

interface Props {
  content: SmartTooltipContent;
  children: ReactNode;
  delay?: number;
  /** Klasser på omslaget, t.ex. "flex [&>*]:flex-1" för knappar som ska fylla en rutnätscell. */
  className?: string;
}

const WIDTH = 288;

/**
 * Rik tooltip för Ribbon-knappar: titel, beskrivning, kortkommando och en
 * illustration. I Nybörjarläge visas den snabbare och med längre text.
 */
export function SmartTooltip({ content, children, delay, className = 'inline-flex' }: Props) {
  const beginner = useAppStore((s) => s.beginnerMode);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<FloatingPosition | null>(null);

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay ?? (beginner ? 350 : 700));
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
    setPos(null);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !tipRef.current) return;
    setPos(placeFloating(anchorRef.current.getBoundingClientRect(), WIDTH, tipRef.current.offsetHeight));
  }, [open]);

  return (
    <span
      ref={anchorRef}
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onMouseDown={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            style={{ width: WIDTH, left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
            className="pointer-events-none fixed z-[60] overflow-hidden rounded-lg bg-surface text-left shadow-pop"
          >
            {content.illustration && (
              <div className="flex h-24 items-center justify-center border-b border-line bg-app text-accent">
                {content.illustration}
              </div>
            )}
            <div className="space-y-1 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">{content.title}</p>
                {content.shortcut && <kbd className="kbd shrink-0">{content.shortcut}</kbd>}
              </div>
              <p className="text-xs leading-relaxed text-muted">{content.description}</p>
              {content.disabledReason && <p className="pt-1 text-xs font-medium text-warn">{content.disabledReason}</p>}
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
