import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { shapeToPolylines } from '@desktopcam/core';
import { useAppStore, useMachine, useMaterialPreset } from '../../store/useAppStore';
import { SCENE_THEMES, SceneController, type ToolpathDisplay, type VectorDisplay } from './SceneController';
import { ViewportToolbar } from './ViewportToolbar';
import { ViewportOverlay } from './ViewportOverlay';
import { composeStockSurface } from '../../cam/reliefs';
import { importVectorFile } from '../../cam/commands';
import { EditController } from '../../editing/EditController';
import { useT } from '../../i18n';
import { DrawingBar } from './DrawingBar';

/** React-skal runt SceneController: översätter app-tillstånd till scenanrop. */
export function Viewport() {
  const hostRef = useRef<HTMLDivElement>(null);
  const ctlRef = useRef<SceneController | null>(null);
  const t = useT();
  const fitted = useRef(false);

  const theme = useAppStore((s) => s.theme);
  const machine = useMachine();
  const preset = useMaterialPreset();
  const material = useAppStore((s) => s.material);
  const layers = useAppStore((s) => s.layers);
  const selected = useAppStore((s) => s.selectedShapeIds);
  const toolpaths = useAppStore((s) => s.toolpaths);
  const results = useAppStore((s) => s.results);
  const selectedToolpathId = useAppStore((s) => s.selectedToolpathId);
  const view = useAppStore((s) => s.view);
  const viewCommand = useAppStore((s) => s.viewCommand);
  const reliefs = useAppStore((s) => s.reliefs);
  const [dragging, setDragging] = useState(false);

  // 1. Skapa scenen en gång
  useEffect(() => {
    const ctl = new SceneController(hostRef.current!);
    ctl.onCursor = (p) => useAppStore.getState().setCursor(p);
    ctlRef.current = ctl;
    const editor = new EditController(ctl);
    return () => {
      editor.dispose();
      ctl.dispose();
      ctlRef.current = null;
      fitted.current = false;
    };
  }, []);

  // 2. Tema först – övriga effekter bygger om med rätt färger
  useEffect(() => ctlRef.current?.setTheme(SCENE_THEMES[theme]), [theme]);

  useEffect(() => {
    const ctl = ctlRef.current;
    if (!ctl) return;
    ctl.setBed(machine.workArea.x, machine.workArea.y, -material.thickness);
    if (!fitted.current) {
      ctl.command('iso');
      fitted.current = true;
    }
  }, [theme, machine.workArea.x, machine.workArea.y, material.thickness]);

  const surface = useMemo(() => composeStockSurface(material, reliefs), [material, reliefs]);
  useEffect(() => {
    ctlRef.current?.setStock(material.width, material.height, material.thickness, preset.color, view.showStock, surface);
  }, [theme, material.width, material.height, material.thickness, preset.color, view.showStock, surface]);

  const vectors = useMemo<VectorDisplay[]>(
    () =>
      layers
        .filter((l) => l.visible)
        .flatMap((l) => l.shapes)
        .flatMap((sh) => shapeToPolylines(sh).map((pl) => ({ ...pl, selected: selected.includes(sh.id) }))),
    [layers, selected],
  );
  useEffect(() => ctlRef.current?.setVectors(vectors), [theme, vectors]);

  useEffect(() => {
    if (!ctlRef.current) return;
    const display: ToolpathDisplay[] = view.showToolpaths
      ? toolpaths
          .filter((t) => (t.visible || t.id === selectedToolpathId) && results[t.id])
          .map((t) => ({
            cuts: results[t.id].cuts,
            rapids: results[t.id].rapids,
            laser: t.operation === 'laserCut' || t.operation === 'laserRaster',
            highlighted: !selectedToolpathId || selectedToolpathId === t.id,
          }))
      : [];
    ctlRef.current.setToolpaths(display, view.showRapids);
  }, [theme, toolpaths, results, selectedToolpathId, view.showToolpaths, view.showRapids]);

  useEffect(() => {
    if (viewCommand) ctlRef.current?.command(viewCommand.kind);
  }, [viewCommand]);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) void importVectorFile(file);
      }}
    >
      <div ref={hostRef} className="absolute inset-0 touch-none select-none" />
      <ViewportToolbar />
      <ViewportOverlay />
      <DrawingBar />
      {dragging && (
        <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-accent/10">
          <p className="flex items-center gap-2 rounded-lg bg-surface px-4 py-2 text-sm font-medium shadow-pop">
            <FileUp size={16} className="text-accent" /> {t.viewport.drop}
          </p>
        </div>
      )}
    </div>
  );
}
