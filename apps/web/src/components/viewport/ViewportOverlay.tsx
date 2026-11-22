import { AlignVerticalSpaceAround, Copy, Group, ListChecks, RotateCcw, RotateCw, SlidersHorizontal, Trash2, Ungroup, X } from 'lucide-react';
import { deleteSelection, duplicateSelection, groupSelection, rotateSelection, straightenSelection, ungroupSelection } from '../../cam/commands';
import { useEffect, useState, type ReactNode } from 'react';
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
  const hasSelection = useAppStore((s) => s.selectedShapeIds.length > 0 || !!s.selectedToolpathId || !!s.selectedReliefId || !!s.selectedImageId);
  const nShapes = useAppStore((s) => s.selectedShapeIds.length);
  const imageSel = useAppStore((s) => !!s.selectedImageId);
  const multi = useAppStore((s) => s.multiSelect);
  const hasGroup = useAppStore((s) => s.layers.some((l) => l.shapes.some((sh) => sh.groupId && s.selectedShapeIds.includes(sh.id))));
  const setMulti = (on: boolean) => {
    useAppStore.getState().setMultiSelect(on);
    if (on) useAppStore.getState().setStatus(t.group.multiHint);
  };
  const panelOpen = useAppStore((s) => s.mobilePanel !== null);
  const openProps = () => useAppStore.getState().setMobilePanel('props');
  // På pekskärm försvinner navigeringstipset efter en stund (det visas igen när verktyget byts).
  const [navShown, setNavShown] = useState(true);
  useEffect(() => {
    setNavShown(true);
    if (!coarse) return;
    const id = setTimeout(() => setNavShown(false), 8000);
    return () => clearTimeout(id);
  }, [tool]);
  const propsButton = hasSelection && !panelOpen && !simActive;
  const nav = tool === 'select' ? (coarse ? t.viewport.navTouch : `${t.viewport.navMouse} ${t.group.boxHint}`) : coarse ? t.viewport.navDrawTouch : t.viewport.navMouse;

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
      {multi && (
        <div className="absolute left-1/2 top-2 z-10 flex max-w-[calc(100%-5rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-accent/40 bg-surface/95 py-1 pl-3 pr-1 text-xs shadow-sm backdrop-blur" role="status">
          <ListChecks size={14} className="shrink-0 text-accent" />
          <span className="truncate" title={t.group.multiHint}>{t.group.multi}</span>
          <button className="rounded-full p-1 text-muted hover:bg-app hover:text-ink" onClick={() => setMulti(false)} aria-label={`${t.group.multi}: ${t.common.close}`}>
            <X size={14} />
          </button>
        </div>
      )}
      {propsButton && (
        // Telefon och surfplatta: snabbknappar för det vanligaste, utan att öppna panelen.
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-line bg-surface/95 p-1 shadow-pop backdrop-blur lg:hidden" role="toolbar" aria-label={t.header.properties}>
          {(nShapes > 0 || imageSel) && (
            <>
              <QuickButton label={`${t.props.rotate} +15°`} onClick={() => rotateSelection(15)}>
                <RotateCcw size={18} />
              </QuickButton>
              <QuickButton label={`${t.props.rotate} −15°`} onClick={() => rotateSelection(-15)}>
                <RotateCw size={18} />
              </QuickButton>
            </>
          )}
          {nShapes > 0 && (
            <>
              <QuickButton label={t.group.multi} onClick={() => setMulti(!multi)} pressed={multi}>
                <ListChecks size={18} />
              </QuickButton>
              {nShapes > 1 && !hasGroup && (
                <QuickButton label={t.buttons.group.label} onClick={groupSelection}>
                  <Group size={18} />
                </QuickButton>
              )}
              {hasGroup && (
                <QuickButton label={t.buttons.ungroup.label} onClick={ungroupSelection}>
                  <Ungroup size={18} />
                </QuickButton>
              )}
              <QuickButton label={t.contour.straighten} onClick={straightenSelection}>
                <AlignVerticalSpaceAround size={18} />
              </QuickButton>
              <QuickButton label={t.buttons.duplicate.label} onClick={duplicateSelection}>
                <Copy size={18} />
              </QuickButton>
            </>
          )}
          <QuickButton label={t.buttons.remove.label} onClick={deleteSelection}>
            <Trash2 size={18} />
          </QuickButton>
          <button
            onClick={openProps}
            aria-label={t.header.properties}
            title={t.header.properties}
            className="ml-0.5 flex h-10 items-center gap-1.5 rounded-full bg-accent px-3.5 text-sm font-medium text-white"
          >
            <SlidersHorizontal size={16} /> <span className="hidden min-[400px]:inline">{t.header.properties}</span>
          </button>
        </div>
      )}
      {beginner && !simActive && navShown && (
        <p className={`pointer-events-none absolute bottom-3 left-3 right-14 ${propsButton ? 'hidden lg:block' : ''} rounded-md bg-surface/85 px-2 py-1 text-2xs text-muted backdrop-blur sm:right-auto`}>{nav}</p>
      )}
    </>
  );
}

function QuickButton({ label, onClick, children, pressed }: { label: string; onClick: () => void; children: ReactNode; pressed?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-app active:bg-line/60 ${pressed ? 'bg-accent/15 text-accent' : 'text-ink/80'}`}
    >
      {children}
    </button>
  );
}
