import { SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';

const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/** Förloppsindikator för pågående beräkningar och navigeringshjälp för nybörjare. */
export function ViewportOverlay() {
  const t = useT();
  const progress = useAppStore((s) => s.progress);
  const toolpaths = useAppStore((s) => s.toolpaths);
  const beginner = useAppStore((s) => s.beginnerMode);
  const tool = useAppStore((s) => s.editTool);
  const simActive = useAppStore((s) => s.sim.active);
  const jobs = Object.entries(progress);
  const hasSelection = useAppStore((s) => s.selectedShapeIds.length > 0 || !!s.selectedToolpathId || !!s.selectedReliefId);
  const panelOpen = useAppStore((s) => s.mobilePanel !== null);
  const openProps = () => useAppStore.getState().setMobilePanel('props');
  const nav = tool === 'select' ? (coarse ? t.viewport.navTouch : t.viewport.navMouse) : coarse ? t.viewport.navDrawTouch : t.viewport.navMouse;

  return (
    <>
      {jobs.length > 0 && (
        <div className="absolute left-1/2 top-3 w-64 -translate-x-1/2 space-y-1.5 rounded-lg border border-line bg-surface/95 p-3 shadow-sm backdrop-blur" role="status">
          {jobs.map(([id, p]) => (
            <div key={id}>
              <div className="mb-1 flex justify-between gap-2 text-2xs">
                <span className="truncate font-medium">{toolpaths.find((x) => x.id === id)?.name ?? ''}</span>
                <span className="shrink-0 text-muted">{p.message}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${Math.round(p.value * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {hasSelection && !panelOpen && (
        <button
          onClick={openProps}
          className="absolute bottom-3 right-3 flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-white shadow-pop lg:hidden"
        >
          <SlidersHorizontal size={16} /> {t.header.properties}
        </button>
      )}
      {beginner && !simActive && (
        <p className="pointer-events-none absolute bottom-3 left-3 right-14 rounded-md bg-surface/85 px-2 py-1 text-2xs text-muted backdrop-blur sm:right-auto">{nav}</p>
      )}
    </>
  );
}
