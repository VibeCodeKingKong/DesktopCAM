import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { materialName, useT, type GuideKey } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { placeFloating, type FloatingPosition } from './position';

const WIDTH = 320;

/**
 * "?"-ikon bredvid avancerade parametrar. Syns bara i Nybörjarläge.
 * Öppnar en stegvis guide med rekommenderade värden för materialen.
 */
export function InfoHint({ topic }: { topic: GuideKey }) {
  const beginner = useAppStore((s) => s.beginnerMode);
  const materials = useAppStore((s) => s.materials);
  const currentMaterial = useAppStore((s) => s.material.presetId);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<FloatingPosition | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const t = useT();
  const guide = t.guides.items[topic];
  const recommend = t.guides.recommend[topic];

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !popRef.current) return;
    setPos(placeFloating(btnRef.current.getBoundingClientRect(), WIDTH, popRef.current.offsetHeight, 6));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!beginner) return null;

  const rows = recommend
    ? materials.map((m) => ({ id: m.id, name: materialName(t, m.id, m.name), value: recommend(m) })).filter((r) => r.value)
    : [];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={guide.title}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
          setPos(null);
        }}
        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-accent/50 text-[9px] font-bold leading-none text-accent hover:bg-accent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        ?
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={guide.title}
            style={{ width: WIDTH, left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
            className="fixed z-[60] rounded-lg bg-surface p-4 text-left shadow-pop"
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold">{guide.title}</h3>
              <button className="text-muted hover:text-ink" onClick={() => setOpen(false)} aria-label={t.common.close}>
                <X size={14} />
              </button>
            </div>
            <p className="text-xs leading-relaxed text-muted">{guide.body}</p>
            {guide.steps && (
              <ol className="mt-3 space-y-1.5">
                {guide.steps.map((step, i) => (
                  <li key={step} className="flex gap-2 text-xs">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-semibold text-accent">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            )}
            {rows.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-md border border-line">
                <p className="border-b border-line bg-app px-2 py-1 text-2xs font-medium text-muted">{t.guides.rec}</p>
                <table className="w-full text-xs">
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className={r.id === currentMaterial ? 'bg-accent/10 font-medium' : ''}>
                        <td className="px-2 py-1">{r.name}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
