import { chainRapids } from '../../cam/rapidChain';

/** Samma linjer med Z = 0 (minns resultatet per array). */
const flatCache = new WeakMap<Float32Array, Float32Array>();
function flatZ(a: Float32Array): Float32Array {
  let out = flatCache.get(a);
  if (!out) {
    out = new Float32Array(a);
    for (let i = 2; i < out.length; i += 3) out[i] = 0;
    flatCache.set(a, out);
  }
  return out;
}
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { shapeToPolylines } from '@desktopcam/core';
import { useAppStore, useMachine, useMaterialPreset } from '../../store/useAppStore';
import { SCENE_THEMES, SceneController, type ImageDisplay, type ToolpathDisplay, type VectorDisplay } from './SceneController';
import { ViewportToolbar } from './ViewportToolbar';
import { ViewportOverlay } from './ViewportOverlay';
import { composeStockSurface } from '../../cam/reliefs';
import { importVectorFile } from '../../cam/commands';
import { importGcodeFile, isGcodeFileName } from '../../cam/gcodeImport';
import { imageHeightMm, importImage } from '../../cam/imageObjects';
import { EditController } from '../../editing/EditController';
import { useT } from '../../i18n';
import { DrawingBar } from './DrawingBar';
import { SimulationBar } from './SimulationBar';
import { attachSimulationScene } from '../../cam/simController';
import { plugBlankLayout } from '../../cam/toolpathService';

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
  const tools = useAppStore((s) => s.tools);
  const simActive = useAppStore((s) => s.sim.active);
  const [dragging, setDragging] = useState(false);

  // 1. Skapa scenen en gång
  useEffect(() => {
    const ctl = new SceneController(hostRef.current!);
    ctl.onCursor = (p) => useAppStore.getState().setCursor(p);
    ctlRef.current = ctl;
    // Utvecklingsläge: scripts/build-examples.cjs beskär bilderna efter ämnets läge på skärmen.
    if (import.meta.env.DEV) Object.assign(window, { __scene: ctl });
    const editor = new EditController(ctl);
    attachSimulationScene(ctl);
    return () => {
      attachSimulationScene(null);
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
    ctlRef.current?.setStock(material.width, material.height, material.thickness, preset.color, view.showStock && !simActive, surface);
  }, [theme, material.width, material.height, material.thickness, preset.color, view.showStock, surface, simActive]);

  // Inläggsträ för pluggarna, bredvid grundträet.
  const materials = useAppStore((s) => s.materials);
  const blanks = useMemo(() => plugBlankLayout(), [toolpaths, layers, material, materials, reliefs]);
  useEffect(() => {
    const extras = view.showStock && !simActive ? [...blanks.values()].map((b) => ({ x: b.displayX, y: b.displayY, width: b.width, height: b.height, thickness: b.thickness, color: b.color })) : [];
    ctlRef.current?.setExtraStocks(extras);
  }, [theme, blanks, view.showStock, simActive]);

  // Bilderna i ritningen; tonas ner när en synlig bana redan ritar bilden.
  const imageObjects = useAppStore((s) => s.imageObjects);
  const imageCache = useAppStore((s) => s.images);
  useEffect(() => {
    const drawn = (id: string) =>
      view.showToolpaths && toolpaths.some((t) => (t.operation === 'laserRaster' || t.operation === 'penImage') && t.imageId === id && t.visible && results[t.id]);
    const display: ImageDisplay[] = simActive
      ? []
      : imageObjects
          .filter((im) => im.visible && imageCache[im.id])
          .map((im) => ({ bitmap: imageCache[im.id].bitmap, x: im.x, y: im.y, width: im.widthMm, height: imageHeightMm(im), opacity: drawn(im.id) ? 0.35 : 1, rotation: ((im.rotation ?? 0) * Math.PI) / 180 }));
    ctlRef.current?.setImages(display);
  }, [theme, imageObjects, imageCache, simActive, toolpaths, results, view.showToolpaths]);

  const vectors = useMemo<VectorDisplay[]>(
    () =>
      layers
        .filter((l) => l.visible)
        .flatMap((l) => l.shapes)
        .flatMap((sh) => shapeToPolylines(sh).map((pl) => ({ ...pl, selected: selected.includes(sh.id) }))),
    [layers, selected],
  );
  useEffect(() => ctlRef.current?.setVectors(simActive ? [] : vectors), [theme, vectors, simActive]);

  useEffect(() => {
    if (!ctlRef.current) return;
    const display: ToolpathDisplay[] = view.showToolpaths && !simActive
      ? toolpaths
          .filter((t) => (t.visible || t.id === selectedToolpathId) && results[t.id])
          .map((t) => ({
            // Plasma: brännarens höjd över plåten saknar betydelse för var den skär –
            // rita banan i plåtens plan, annars förskjuts den i perspektiv och ser sned ut.
            cuts: t.operation === 'plasmaCut' ? flatZ(results[t.id].cuts) : results[t.id].cuts,
            rapids: t.operation === 'plasmaCut' ? flatZ(results[t.id].rapids) : results[t.id].rapids,
            laser: t.operation === 'laserCut' || t.operation === 'laserRaster',
            highlighted: !selectedToolpathId || selectedToolpathId === t.id,
            color: tools.find((x) => x.id === t.toolId && x.kind === 'pen')?.color,
            // Pennan ritar strax under papperets yta (tryck) – lyft linjerna så att de syns ovanpå papperet.
            offset: blanks.has(t.id)
              ? { x: blanks.get(t.id)!.displayX, y: blanks.get(t.id)!.displayY }
              : tools.some((x) => x.id === t.toolId && x.kind === 'pen')
                ? { x: 0, y: 0, z: 1 }
                : t.operation === 'laserRaster'
                  ? { x: 0, y: 0, z: 0.1 }
                  : undefined,
          }))
      : [];
    // Banor utan egen förskjutning körs efter varandra: koppla ihop förflyttningarna.
    const chained = display.filter((d) => !d.offset || (d.offset.x === 0 && d.offset.y === 0));
    chainRapids(chained.map((d) => d.rapids)).forEach((r, i) => (chained[i].rapids = r));
    ctlRef.current.setToolpaths(display, view.showRapids);
  }, [theme, toolpaths, results, selectedToolpathId, view.showToolpaths, view.showRapids, simActive, blanks, tools]);

  useEffect(() => {
    if (viewCommand) ctlRef.current?.command(viewCommand.kind);
  }, [viewCommand]);

  // Vald liten detalj i egenskaperna: zooma in på den uppifrån.
  const featurePick = useAppStore((s) => s.featurePick);
  useEffect(() => {
    if (!featurePick || featurePick.from !== 'list') return;
    const s = useAppStore.getState();
    const f = s.selectedToolpathId ? s.results[s.selectedToolpathId]?.features?.[featurePick.index] : undefined;
    if (f) ctlRef.current?.focusOn(f.x, f.y, Math.max(30, f.r * 6));
  }, [featurePick]);

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
        if (file && /^image\/(png|jpeg|webp|bmp|gif)$/.test(file.type)) void importImage(file);
        else if (file && isGcodeFileName(file.name)) void importGcodeFile(file);
        else if (file) void importVectorFile(file);
      }}
    >
      <div ref={hostRef} className="absolute inset-0 touch-none select-none" />
      <ViewportToolbar />
      <ViewportOverlay />
      <DrawingBar />
      <SimulationBar />
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
