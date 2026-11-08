import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  actions?: ReactNode;
  footer?: ReactNode;
  width?: string;
  children: ReactNode;
}

/** Modalt fönster med samma ram som resten av appen (inspirerat av macOS-ark). */
export function Dialog({ open, title, onClose, actions, footer, width = 'max-w-3xl', children }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[90vh] w-full ${width} flex-col overflow-hidden rounded-xl bg-surface shadow-pop`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-line px-5 py-3">
          <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
          <div className="flex flex-1 items-center gap-2">{actions}</div>
          <button className="rounded-md p-1 text-muted hover:bg-app hover:text-ink" onClick={onClose} aria-label="Stäng">
            <X size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        {footer && <footer className="flex items-center gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
