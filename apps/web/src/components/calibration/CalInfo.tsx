import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useT } from '../../i18n';
import { placeFloating, type FloatingPosition } from '../smartguide/position';

const WIDTH = 300;

/**
 * "i" bredvid en inställning i kalibreringen: en kort förklaring och, där det
 * finns, en animation. Syns alltid (inte bara i nybörjarläge).
 */
export function CalInfo({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<FloatingPosition | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current || !pop.current) return;
    setPos(placeFloating(btn.current.getBoundingClientRect(), WIDTH, pop.current.offsetHeight, 6));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node;
      if (!pop.current?.contains(n) && !btn.current?.contains(n)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={t.calib.infoAbout(title)}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
          setPos(null);
        }}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-accent/60 font-serif text-[10px] font-bold italic leading-none text-accent hover:bg-accent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        i
      </button>
      {open &&
        createPortal(
          <div
            ref={pop}
            role="dialog"
            aria-label={title}
            style={{ width: WIDTH, left: pos?.left ?? -9999, top: pos?.top ?? -9999, maxWidth: 'calc(100vw - 16px)' }}
            className="fixed z-[80] space-y-2 rounded-lg border border-line bg-raised p-3 text-xs leading-relaxed shadow-pop"
          >
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 font-semibold">{title}</p>
              <button className="rounded p-0.5 text-muted hover:bg-app hover:text-ink" onClick={() => setOpen(false)} aria-label={t.common.close}>
                <X size={13} />
              </button>
            </div>
            <p className="whitespace-pre-line">{body}</p>
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
